import { eq, desc, like, or, and, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, registrations, adminUsers, InsertRegistration, Registration } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // استخدام createPool مع خيارات صريحة لضمان التوافق
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
      
      // فرض نمط MySQL بشكل صريح جداً في Drizzle
      _db = drizzle(pool, { logger: true });
      
      console.log("[Database] Initialized with MySQL pool");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Admin Users ──────────────────────────────────────────────────────────────

export async function getAdminByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAdminUser(username: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(adminUsers).values({ username, passwordHash });
}

export async function adminUserExists(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return result.length > 0;
}

// ─── Registrations ────────────────────────────────────────────────────────────

export async function createRegistration(data: InsertRegistration): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(registrations).values(data);
  return (result[0] as any).insertId as number;
}

export async function getRegistrations(opts: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: Registration[]; total: number }> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const conditions: SQL[] = [];

  if (opts.search && opts.search.trim() !== "") {
    const s = `%${opts.search.trim()}%`;
    conditions.push(
      or(
        like(registrations.fullName, s),
        like(registrations.phone, s),
        like(registrations.email, s)
      ) as SQL
    );
  }

  if (opts.status && opts.status !== "all") {
    conditions.push(eq(registrations.status, opts.status as Registration["status"]));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allRows = await db
    .select()
    .from(registrations)
    .where(whereClause)
    .orderBy(desc(registrations.createdAt));

  const total = allRows.length;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = allRows.slice(offset, offset + limit);

  return { rows, total };
}

export async function getAllRegistrationsForExport(): Promise<Registration[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(registrations).orderBy(desc(registrations.createdAt));
}

export async function updateRegistrationStatus(
  id: number,
  status: Registration["status"]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(registrations).set({ status }).where(eq(registrations.id, id));
}

export async function deleteRegistration(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(registrations).where(eq(registrations.id, id));
}

export async function getRegistrationStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, contacted: 0, enrolled: 0, rejected: 0 };
  const all = await db.select({ status: registrations.status }).from(registrations);
  const stats = { total: all.length, pending: 0, contacted: 0, enrolled: 0, rejected: 0 };
  for (const r of all) {
    if (r.status === "pending") stats.pending++;
    else if (r.status === "contacted") stats.contacted++;
    else if (r.status === "enrolled") stats.enrolled++;
    else if (r.status === "rejected") stats.rejected++;
  }
  return stats;
}
