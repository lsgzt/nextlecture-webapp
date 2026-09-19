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
 * Durable cache for official timetable + temporary-section PDFs + mark-attendance sessions.
 * Do not change the shape of this table — mark-attendance and temporary-sections depend on it.
 */
export const timetableCache = mysqlTable("timetable_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  payload: longtext("payload").notNull(),
  fetchedAt: timestamp("fetchedAt").notNull(),
});

/**
 * Durable cache for other external GNDEC sources (vacant rooms, campus holidays/notices).
 * Kept separate from timetable_cache so mark-attendance session keys stay isolated.
 */
export const externalSourceCache = mysqlTable("external_source_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  payload: longtext("payload").notNull(),
  fetchedAt: timestamp("fetchedAt").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ExternalSourceCache = typeof externalSourceCache.$inferSelect;
export type InsertExternalSourceCache = typeof externalSourceCache.$inferInsert;
