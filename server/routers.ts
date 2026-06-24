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
} from "./db";
import { sendRegistrationNotification } from "./email";

// ─── Admin JWT ────────────────────────────────────────────────────────────────
const ADMIN_COOKIE = "alc_admin_token";
const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET ?? ""
);

async function signAdminToken(username: string): Promise<string> {
  return new SignJWT({ username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
}

async function verifyAdminToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { username: payload.username as string };
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
  return next({ ctx: { ...ctx, adminUsername: payload.username } });
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

  // ─── Admin: المصادقة ─────────────────────────────────────────────────────
  admin: router({
    // التحقق من حالة الجلسة
    me: publicProcedure.query(async ({ ctx }) => {
      const token = ctx.req.cookies?.[ADMIN_COOKIE];
      if (!token) return null;
      const payload = await verifyAdminToken(token);
      return payload ? { username: payload.username } : null;
    }),

    // تسجيل الدخول
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const admin = await getAdminByUsername(input.username);
        if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });

        const valid = await bcrypt.compare(input.password, admin.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });

        const token = await signAdminToken(admin.username);
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
  }),
});

// ─── Bootstrap: إنشاء المدير الافتراضي عند أول تشغيل ─────────────────────────
async function bootstrapAdmin() {
  try {
    const hash = await bcrypt.hash("ALC@Admin2026#Secure", 12);
    const existingAdmin = await getAdminByUsername("yahya1019");
    
    if (!existingAdmin) {
      await createAdminUser("yahya1019", hash);
      console.log("[Bootstrap] Admin user created: yahya1019");
    } else {
      // تحديث كلمة المرور للمستخدم الحالي لضمان مطابقتها للمطلوب
      const db = await getDb();
      if (db) {
        const { adminUsers } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(adminUsers)
          .set({ passwordHash: hash })
          .where(eq(adminUsers.username, "yahya1019"));
        console.log("[Bootstrap] Admin password updated for: yahya1019");
      }
    }
  } catch (err) {
    console.error("[Bootstrap] Failed to bootstrap admin:", err);
  }
}

bootstrapAdmin();

export type AppRouter = typeof appRouter;
