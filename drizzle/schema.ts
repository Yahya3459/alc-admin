import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول المديرين (مصادقة مستقلة بـ username/password)
export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["superadmin", "admin", "teacher"]).default("admin").notNull(),
  isSuperAdmin: int("isSuperAdmin").default(0).notNull(), // 1 for the main account
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

// جدول طلبات التسجيل في العروض
export const registrations = mysqlTable("registrations", {
  id: int("id").autoincrement().primaryKey(),
  offerIndex: int("offerIndex").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "contacted", "enrolled", "rejected"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;

// جدول طلبات الشهادات
export const certificateRequests = mysqlTable("certificate_requests", {
  id: int("id").autoincrement().primaryKey(),
  courseName: varchar("courseName", { length: 255 }).notNull(),
  fullNameAr: varchar("fullNameAr", { length: 255 }).notNull(),
  fullNameEn: varchar("fullNameEn", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  birthPlace: varchar("birthPlace", { length: 255 }).notNull(),
  birthDate: varchar("birthDate", { length: 50 }).notNull(),
  gender: mysqlEnum("gender", ["male", "female"]).notNull(),
  idCardUrl: varchar("idCardUrl", { length: 500 }),
  // حقل الدرجات بتنسيق JSON لتخزين درجات كل دورة بشكل مرن
  grades: json("grades"),
  // حقل التقدير النهائي والمعدل
  finalGrade: varchar("finalGrade", { length: 50 }),
  average: varchar("average", { length: 50 }),
  total: varchar("total", { length: 50 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "rejected"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CertificateRequest = typeof certificateRequests.$inferSelect;
export type InsertCertificateRequest = typeof certificateRequests.$inferInsert;
