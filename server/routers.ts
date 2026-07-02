import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createRegistration,
  getRegistrations,
  getAllRegistrationsForExport,
  updateRegistrationStatus,
  deleteRegistration,
  getRegistrationStats,
  getAdminByUsername,
  createAdminUser,
  adminUserExists,
  pushSchema,
  createCertificateRequest,
  getCertificateRequests,
  updateCertificateStatus,
  deleteCertificateRequest,
  getAllAdminUsers,
  updateAdminUser,
  deleteAdminUser,
} from "./db";
import { sendRegistrationNotification } from "./email";

// ─── Admin JWT ────────────────────────────────────────────────────────────────
const ADMIN_COOKIE = "alc_admin_token";
const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "ALC_ADMIN_FALLBACK_SECRET_KEY_2026_DO_NOT_USE_IN_PROD_WITHOUT_ENV"
);

async function signAdminToken(username: string, role: string, isSuperAdmin: number): Promise<string> {
  return new SignJWT({ username, role, isSuperAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
}

async function verifyAdminToken(token: string): Promise<{ username: string, role: string, isSuperAdmin: number } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { 
      username: payload.username as string, 
      role: payload.role as string,
      isSuperAdmin: payload.isSuperAdmin as number 
    };
  } catch {
    return null;
  }
}

// ─── Admin Middleware ─────────────────────────────────────────────────────────
const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = ctx.req.cookies?.[ADMIN_COOKIE];
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" });
  
  const payload = await verifyAdminToken(token);
  if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "جلسة منتهية، يرجى تسجيل الدخول مجدداً" });

  // 🛡️ Smart Fix: Always fetch fresh user data from DB to avoid stale session permissions
  const admin = await getAdminByUsername(payload.username);
  if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "المستخدم غير موجود" });

  // If DB permissions differ from JWT, we use DB as the source of truth
  return next({ 
    ctx: { 
      ...ctx, 
      adminUsername: admin.username,
      adminRole: admin.role,
      isSuperAdmin: admin.isSuperAdmin
    } 
  });
});

const superAdminProcedure = adminProcedure.use(async ({ ctx, next }) => {
  // 🛡️ Absolute Override: Ensure yahya1019 is ALWAYS treated as SuperAdmin
  const isSuperAdmin = ctx.adminUsername === "yahya1019" || ctx.adminRole === "superadmin" || ctx.isSuperAdmin === 1;
  
  if (!isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء يتطلب صلاحيات مدير النظام" });
  }
  return next();
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Public: تسجيل طلب جديد ─────────────────────────────────────────────
  registration: router({
    submit: publicProcedure
      .input(
        z.object({
          offerIndex: z.number().int().positive(),
          fullName: z.string().min(2).max(255),
          phone: z.string().min(7).max(50),
          email: z.string().email().optional().or(z.literal("")),
          notes: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createRegistration({
          offerIndex: input.offerIndex,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email || null,
          notes: input.notes || null,
        });

        // إرسال إشعار البريد الإلكتروني بشكل غير متزامن
        sendRegistrationNotification({
          id,
          offerIndex: input.offerIndex,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email || null,
          notes: input.notes || null,
          createdAt: new Date(),
        }).catch((err) => console.error("[Email] Background send failed:", err));

        return { success: true, id };
      }),
  }),

  // ─── Public: طلب شهادة ───────────────────────────────────────────────────
  certificate: router({
    submit: publicProcedure
      .input(
        z.object({
          courseName: z.string().min(1),
          fullNameAr: z.string().min(2),
          fullNameEn: z.string().min(2),
          phone: z.string().min(7),
          birthPlace: z.string().min(2),
          birthDate: z.string().min(1),
          gender: z.enum(["male", "female"]),
          idCardUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await createCertificateRequest(input);
          return { success: true };
        } catch (error) {
          console.error("[Cert] Submit failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل إرسال طلب الشهادة، يرجى المحاولة لاحقاً",
          });
        }
      }),
  }),

  // ─── Admin: المصادقة ─────────────────────────────────────────────────────
  admin: router({
    // التحقق من حالة الجلسة
    me: publicProcedure.query(async ({ ctx }) => {
      const token = ctx.req.cookies?.[ADMIN_COOKIE];
      if (!token) return null;
      const payload = await verifyAdminToken(token);
      if (!payload) return null;

      // 🛡️ Source of truth is the database
      const admin = await getAdminByUsername(payload.username);
      if (!admin) return null;

      return { 
        username: admin.username, 
        role: admin.role, 
        isSuperAdmin: admin.isSuperAdmin 
      };
    }),

    // تسجيل الدخول
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await getAdminByUsername(input.username);
        if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });

        const valid = await bcrypt.compare(input.password, admin.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });

        const token = await signAdminToken(admin.username, admin.role, admin.isSuperAdmin);
        const isSecure = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";

        ctx.res.cookie(ADMIN_COOKIE, token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });

        return { success: true, username: admin.username };
      }),

    // تسجيل الخروج
    logout: adminProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { path: "/" });
      return { success: true };
    }),

    // ─── إدارة الطلبات ──────────────────────────────────────────────────────
    getRegistrations: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return getRegistrations(input);
      }),

    getStats: adminProcedure.query(async () => {
      return getRegistrationStats();
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["pending", "contacted", "enrolled", "rejected"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateRegistrationStatus(input.id, input.status);
        return { success: true };
      }),

    deleteRegistration: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteRegistration(input.id);
        return { success: true };
      }),

    exportAll: adminProcedure.query(async () => {
      const rows = await getAllRegistrationsForExport();
      return rows;
    }),

    // ─── إدارة طلبات الشهادات ──────────────────────────────────────────────────
    getCertificateRequests: adminProcedure.query(async () => {
      return await getCertificateRequests();
    }),

    updateCertificateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["pending", "processing", "completed", "rejected"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateCertificateStatus(input.id, input.status);
        return { success: true };
      }),

    deleteCertificateRequest: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCertificateRequest(input.id);
        return { success: true };
      }),

    updateCertificateGrades: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          grades: z.any(),
          finalGrade: z.string(),
          average: z.string(),
          total: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { updateCertificateGrades } = await import("./db");
        await updateCertificateGrades(input.id, {
          grades: input.grades,
          finalGrade: input.finalGrade,
          average: input.average,
          total: input.total,
        });
        return { success: true };
      }),

    // ─── إدارة المستخدمين (للمدير فقط) ──────────────────────────────────────────
    getAdminUsers: superAdminProcedure.query(async () => {
      return await getAllAdminUsers();
    }),

    createAdminUser: superAdminProcedure
      .input(z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        role: z.enum(["superadmin", "admin", "teacher"]),
      }))
      .mutation(async ({ input }) => {
        const hash = await bcrypt.hash(input.password, 12);
        await createAdminUser({
          username: input.username,
          passwordHash: hash,
          role: input.role,
          isSuperAdmin: 0,
        });
        return { success: true };
      }),

    updateAdminUser: superAdminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        username: z.string().min(3).optional(),
        password: z.string().min(6).optional(),
        role: z.enum(["superadmin", "admin", "teacher"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.username) data.username = input.username;
        if (input.role) data.role = input.role;
        if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);
        
        await updateAdminUser(input.id, data);
        return { success: true };
      }),

    deleteAdminUser: superAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteAdminUser(input.id);
        return { success: true };
      }),


  }),
});

// ─── Bootstrap: إنشاء المدير الافتراضي عند أول تشغيل ─────────────────────────
// 🛡️ Best Practice: Ensuring the main superadmin always exists with correct permissions
async function bootstrapAdmin() {
  try {
    await pushSchema();
    
    const username = "yahya1019";
    const hash = await bcrypt.hash("ALC@Admin2026#Secure", 12);
    const existingAdmin = await getAdminByUsername(username);
    
    if (!existingAdmin) {
      await createAdminUser({
        username,
        passwordHash: hash,
        role: "superadmin",
        isSuperAdmin: 1,
      });
      console.log(`[Bootstrap] SuperAdmin user created: ${username}`);
    } else {
      // Always ensure the main admin has superadmin rights in the database
      const db = await getDb();
      if (db) {
        const { adminUsers } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(adminUsers)
          .set({ 
            role: "superadmin",
            isSuperAdmin: 1
          })
          .where(eq(adminUsers.username, username));
        console.log(`[Bootstrap] SuperAdmin permissions verified for: ${username}`);
      }
    }
  } catch (err) {
    console.error("[Bootstrap] Failed to bootstrap admin:", err);
  }
}

bootstrapAdmin();

export type AppRouter = typeof appRouter;
