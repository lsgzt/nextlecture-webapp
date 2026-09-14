import { int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing the optional Manus auth flow.
 */
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

/**
 * A single validated server-side cache of the current official GNDEC timetable.
 * No student account or personal timetable data is stored here.
 */
export const timetableCache = mysqlTable("timetable_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  payload: longtext("payload").notNull(),
  fetchedAt: timestamp("fetchedAt").notNull(),
});

export const fcmTokens = mysqlTable("fcm_tokens", {
  token: varchar("token", { length: 4096 }).primaryKey(),
  platform: varchar("platform", { length: 32 }).notNull().default("android"),
  appVersion: varchar("appVersion", { length: 64 }),
  active: int("active").notNull().default(1),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
});

export const notificationState = mysqlTable("notification_state", {
  key: varchar("key", { length: 128 }).primaryKey(),
  fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
