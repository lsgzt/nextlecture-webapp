// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/timetable.ts
import { eq as eq2 } from "drizzle-orm";
import { load } from "cheerio";

// drizzle/schema.ts
import { int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var timetableCache = mysqlTable("timetable_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  payload: longtext("payload").notNull(),
  fetchedAt: timestamp("fetchedAt").notNull()
});
var externalSourceCache = mysqlTable("external_source_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  payload: longtext("payload").notNull(),
  fetchedAt: timestamp("fetchedAt").notNull()
});

// shared/config.ts
var TIMETABLE_OFFICIAL_INDEX_URL = "https://appsc.gndec.ac.in/time_tables";
var TIMETABLE_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-09/17_09_2026_subgroups_days_horizontal.html";
var TIMETABLE_SOURCE_FALLBACK_API_URL = "https://gndec-pyq-rag-api.vercel.app/api/timetable-source";
var TIMETABLE_EMERGENCY_SNAPSHOT_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663345189289/WkXeXlTJxEDfZTUg.html";
var ANDROID_STUDENT_DIRECTORY_URL = "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/app/src/main/res/raw/student_directory_permanent_2026.json";
var TEMPORARY_SECTION_SOURCE_PAGE_URL = "https://appsc.gndec.ac.in/time_tables";
var SYLLABUS_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-03/ss%20and%20Syllabus%20sem1%2C2%20Dec%202025%20unsigned.pdf";
var HOLIDAY_API_BASE_URL = "https://gndec-pyq-rag-api-lsgzts-projects.vercel.app";
var NOTICES_API_BASE_URL = "https://gndec-pyq-rag-api.vercel.app";
var TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1e3;
var TEMPORARY_SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var SYLLABUS_CACHE_TTL_MS = 24 * 60 * 60 * 1e3;

// shared/timetable.ts
var WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
var _db = null;
function createPoolFromDatabaseUrl(databaseUrl) {
  const cleaned = databaseUrl.replace(/[?&]ssl-mode=[^&]*/gi, "").replace(/[?&]ssl=[^&]*/gi, "").replace(/\?&/, "?").replace(/\?$/, "");
  return mysql.createPool({
    uri: cleaned,
    // Required for Aiven / similar hosts: "self-signed certificate in certificate chain"
    ssl: { rejectUnauthorized: false },
    connectionLimit: 4,
    enableKeepAlive: true
  });
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = createPoolFromDatabaseUrl(process.env.DATABASE_URL);
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/timetable.ts
var CACHE_KEY = "official-gnedc-timetable-v4";
var REVALIDATE_AFTER_MS = 2 * 60 * 1e3;
var REQUEST_TIMEOUT_MS = 25e3;
var SOURCE_RESOLUTION_TIMEOUT_MS = 15e3;
var OFFICIAL_TIMETABLE_HOST = "appsc.gndec.ac.in";
var EMERGENCY_SNAPSHOT_NOTICE = "The official GNDEC timetable source is temporarily unavailable. Showing a verified emergency snapshot while it recovers.";
var inMemoryCache = null;
var inFlightRefresh = null;
function normalizeText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function isWeekday(value) {
  return WEEKDAYS.includes(value);
}
function parseTimeToMinutes(value) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function cleanGroupCode(value) {
  return normalizeText(value).replace(/\s+Automatic Subgroup$/i, "").trim();
}
function asErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown source-resolution failure.";
}
function validateOfficialTimetableUrl(candidate, baseUrl = TIMETABLE_OFFICIAL_INDEX_URL) {
  if (!candidate || !candidate.trim()) return null;
  try {
    const parsed = new URL(candidate, baseUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== OFFICIAL_TIMETABLE_HOST || !parsed.pathname.toLowerCase().endsWith(".html")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
function scoreTimetableSourceUrl(url) {
  let score = 0;
  const folder = url.match(/\/(20\d{2})-(\d{2})\//);
  if (folder) score += Number(folder[1]) * 1e6 + Number(folder[2]) * 1e4;
  const fileDate = decodeURIComponent(url).match(/(\d{1,2})[_\s-](\d{1,2})[_\s-](20\d{2})/);
  if (fileDate) {
    const day = Number(fileDate[1]);
    const month = Number(fileDate[2]);
    const year = Number(fileDate[3]);
    score += year * 1e6 + month * 1e4 + day;
  }
  if (/subgroups_days_horizontal/i.test(url)) score += 500;
  return score;
}
function discoverTimetableSourceFromIndexHtml(html, indexUrl = TIMETABLE_OFFICIAL_INDEX_URL) {
  const $ = load(html);
  const candidates = [];
  $("a").each((_, anchor) => {
    const href = $(anchor).attr("href");
    const url = validateOfficialTimetableUrl(href, indexUrl);
    if (!url || !/subgroups_days_horizontal/i.test(url)) return;
    const visibleText = normalizeText($(anchor).text());
    if (visibleText && !/sub[-\s]?section/i.test(visibleText) && !/subgroups_days_horizontal/i.test(href ?? "")) {
      return;
    }
    candidates.push(url);
  });
  if (!candidates.length) return null;
  candidates.sort((left, right) => scoreTimetableSourceUrl(right) - scoreTimetableSourceUrl(left));
  return candidates[0] ?? null;
}
function buildTimetableRequestHeaders(previousCache, sourceUrl) {
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "NextLecture/1.0 (GNDEC timetable companion)"
  };
  if (previousCache?.sourceUrl !== sourceUrl) return headers;
  if (previousCache.validators?.etag) headers["If-None-Match"] = previousCache.validators.etag;
  if (previousCache.validators?.lastModified) headers["If-Modified-Since"] = previousCache.validators.lastModified;
  return headers;
}
async function resolveTimetableSource(options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const officialIndexUrl = options.officialIndexUrl ?? TIMETABLE_OFFICIAL_INDEX_URL;
  const fallbackApiUrl = options.fallbackApiUrl ?? TIMETABLE_SOURCE_FALLBACK_API_URL;
  let officialError = null;
  let fallbackError = null;
  try {
    const response = await fetcher(officialIndexUrl, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NextLecture/1.0 (official source discovery)" },
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_RESOLUTION_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`The official timetable index responded with ${response.status}.`);
    const discovered = discoverTimetableSourceFromIndexHtml(await response.text(), officialIndexUrl);
    if (!discovered) throw new Error("The official timetable index did not contain a valid Sub-section wise HTML link.");
    return { url: discovered, source: "official-index", officialError: null, fallbackError: null };
  } catch (error) {
    officialError = asErrorMessage(error);
  }
  try {
    const response = await fetcher(fallbackApiUrl, {
      headers: { Accept: "application/json", "User-Agent": "NextLecture/1.0 (timetable fallback)" },
      redirect: "error",
      signal: AbortSignal.timeout(SOURCE_RESOLUTION_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`The timetable fallback responded with ${response.status}.`);
    const payload = JSON.parse(await response.text());
    const discovered = typeof payload.url === "string" ? validateOfficialTimetableUrl(payload.url, officialIndexUrl) : null;
    if (!discovered) throw new Error("The timetable fallback did not provide a valid official GNDEC HTML URL.");
    const builtIn2 = validateOfficialTimetableUrl(TIMETABLE_SOURCE_URL, officialIndexUrl);
    const preferred = builtIn2 && scoreTimetableSourceUrl(builtIn2) > scoreTimetableSourceUrl(discovered) ? builtIn2 : discovered;
    return {
      url: preferred,
      source: preferred === discovered ? "vercel-fallback" : "built-in",
      officialError,
      fallbackError: null
    };
  } catch (error) {
    fallbackError = asErrorMessage(error);
  }
  const lastKnown = validateOfficialTimetableUrl(options.lastKnownSourceUrl, officialIndexUrl);
  const builtIn = validateOfficialTimetableUrl(TIMETABLE_SOURCE_URL, officialIndexUrl);
  const ranked = [];
  if (lastKnown) ranked.push({ url: lastKnown, source: "last-known-good", score: scoreTimetableSourceUrl(lastKnown) });
  if (builtIn) ranked.push({ url: builtIn, source: "built-in", score: scoreTimetableSourceUrl(builtIn) });
  ranked.sort((a, b) => b.score - a.score);
  if (ranked[0]) return { url: ranked[0].url, source: ranked[0].source, officialError, fallbackError };
  return { url: TIMETABLE_SOURCE_URL, source: "built-in", officialError, fallbackError };
}
function getSourceYears(html) {
  const $ = load(html);
  const sourceYears = /* @__PURE__ */ new Map();
  $("li").each((_, item) => {
    const listItem = $(item);
    const directCopy = listItem.clone();
    directCopy.children("ul").remove();
    const directText = normalizeText(directCopy.contents().first().text());
    if (!directText.startsWith("Year ")) return;
    listItem.find('a[href^="#table_"]').each((__, link) => {
      const href = $(link).attr("href");
      const label = cleanGroupCode($(link).text());
      if (href && label) sourceYears.set(href.slice(1), directText);
    });
  });
  return sourceYears;
}
function cellLines($, cell) {
  const structured = [];
  const subject = normalizeText(cell.find(".subject").first().text());
  const line1 = normalizeText(cell.find(".line1").first().text());
  const teacher = normalizeText(cell.find(".teacher").first().text());
  const room = normalizeText(cell.find(".room").first().text());
  if (subject || line1 || teacher || room) {
    if (subject || line1) structured.push(subject || line1);
    if (teacher) structured.push(teacher);
    if (room) structured.push(room);
    return structured;
  }
  const html = cell.html() ?? "";
  if (/<br\s*\/?\s*>/i.test(html)) {
    return html.split(/<br\s*\/?\s*>/i).map((fragment) => normalizeText(load(`<div>${fragment}</div>`).text())).filter(Boolean).filter((line) => line !== "---");
  }
  const raw = normalizeText(cell.text());
  return raw && raw !== "---" ? [raw] : [];
}
function looksLikeGroupPrefix(line) {
  return /^[A-Z]{1,6}\d{0,2}[A-Z]?\d{0,2}$/i.test(line) || /^D\d[A-Z]{1,6}\d{0,2}$/i.test(line);
}
function extractSubjectAndType(line) {
  const match = line.match(/^(.*?)(?:\s+([LPT]))$/i);
  if (match && match[1].trim()) {
    return { subject: normalizeText(match[1]), lectureType: match[2].toUpperCase() };
  }
  return { subject: line, lectureType: null };
}
function parseLectureCell($, cell, day, startTime, durationSlots) {
  const raw = normalizeText(cell.text());
  if (!raw || raw === "---" || cell.hasClass("empty")) return null;
  const structuredType = normalizeText(cell.find(".activitytag").first().text()).toUpperCase() || null;
  const lines = cellLines($, cell);
  if (!lines.length) return null;
  let working = [...lines];
  if (working.length >= 2 && looksLikeGroupPrefix(working[0])) working = working.slice(1);
  const head = working[0] ?? raw;
  const { subject: parsedSubject, lectureType: trailingType } = extractSubjectAndType(head);
  const lectureType = (structuredType && /^[LPT]$/.test(structuredType) ? structuredType : null) || (trailingType && /^[LPT]$/.test(trailingType) ? trailingType : null);
  let teacher = null;
  let venue = null;
  if (working.length >= 3) {
    teacher = working[1] || null;
    venue = working.slice(2).join(" ") || null;
  } else if (working.length === 2) {
    const second = working[1];
    if (/\b(lab|hall|block|dept|room)\b/i.test(second) || /^[A-Z]?\d{1,4}[A-Z]?\b/i.test(second)) {
      venue = second;
    } else {
      teacher = second;
    }
  }
  const subject = parsedSubject || raw;
  const startMinutes = parseTimeToMinutes(startTime);
  const endTime = startMinutes === null ? startTime : minutesToTime(startMinutes + durationSlots * 60);
  const confidence = cell.find(".subject").length > 0 || working.length >= 2 ? "structured" : "partial";
  return {
    day,
    startTime,
    endTime,
    subject,
    teacher,
    venue,
    lectureType,
    raw,
    confidence
  };
}
function parseTimetableHtml(html) {
  const $ = load(html);
  const sourceYears = getSourceYears(html);
  const timetables = [];
  const seenGroups = /* @__PURE__ */ new Set();
  let sourceGeneratedAt = null;
  $("table[id^='table_']").each((_, tableNode) => {
    const table = $(tableNode);
    const tableId = table.attr("id");
    const captionGroup = cleanGroupCode(table.find("caption .name").first().text());
    const dayHeaders = table.find("thead th.xAxis").map((__, header) => normalizeText($(header).text())).get().filter(isWeekday);
    if (!tableId || !captionGroup || dayHeaders.length !== WEEKDAYS.length || seenGroups.has(captionGroup)) return;
    const spanRemaining = Array.from({ length: WEEKDAYS.length }, () => 0);
    const lectures = [];
    const timeSlots = /* @__PURE__ */ new Set();
    table.find("tbody > tr").each((__, rowNode) => {
      const row = $(rowNode);
      const startTime = normalizeText(row.find("th.yAxis").first().text());
      if (!parseTimeToMinutes(startTime)) return;
      timeSlots.add(startTime);
      let dayIndex = 0;
      row.children("td").each((___, cellNode) => {
        while (dayIndex < dayHeaders.length && spanRemaining[dayIndex] > 0) {
          spanRemaining[dayIndex] -= 1;
          dayIndex += 1;
        }
        if (dayIndex >= dayHeaders.length) return;
        const cell = $(cellNode);
        const durationSlots = Math.max(1, Number(cell.attr("rowspan") ?? "1") || 1);
        const lecture = parseLectureCell($, cell, dayHeaders[dayIndex], startTime, durationSlots);
        if (lecture) lectures.push(lecture);
        spanRemaining[dayIndex] = durationSlots - 1;
        dayIndex += 1;
      });
      while (dayIndex < dayHeaders.length) {
        if (spanRemaining[dayIndex] > 0) spanRemaining[dayIndex] -= 1;
        dayIndex += 1;
      }
    });
    const footerText = normalizeText(table.find("tr.foot").text());
    if (!sourceGeneratedAt && footerText) sourceGeneratedAt = footerText;
    timetables.push({
      group: { code: captionGroup, sourceYear: sourceYears.get(tableId) ?? "Official GNDEC timetable" },
      timeSlots: Array.from(timeSlots).sort((a, b) => a.localeCompare(b)),
      lectures: lectures.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime))
    });
    seenGroups.add(captionGroup);
  });
  if (!timetables.length) throw new Error("The official timetable did not contain any valid group tables.");
  if (!timetables.some((item) => item.lectures.length > 0)) throw new Error("The official timetable did not contain enough valid lecture data.");
  return { groups: timetables.map((item) => item.group).sort((a, b) => a.code.localeCompare(b.code)), timetables, sourceGeneratedAt };
}
function isValidEnvelope(value) {
  if (!value || typeof value !== "object") return false;
  const envelope = value;
  return Boolean(envelope.data && Array.isArray(envelope.data.groups) && Array.isArray(envelope.data.timetables) && typeof envelope.fetchedAt === "number" && typeof envelope.sourceUrl === "string" && envelope.data.timetables.length > 0);
}
async function readPersistentCache() {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: timetableCache.payload, sourceUrl: timetableCache.sourceUrl }).from(timetableCache).where(eq2(timetableCache.id, CACHE_KEY)).limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    if (!isValidEnvelope(parsed)) return null;
    return { ...parsed, sourceUrl: parsed.sourceUrl || rows[0]?.sourceUrl };
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be read:", error);
    return null;
  }
}
async function persistCache(cache3) {
  const db = await getDb();
  if (!db) {
    console.warn("[Timetable] Persistent cache skipped: DATABASE_URL / db unavailable");
    return;
  }
  try {
    await db.insert(timetableCache).values({ id: CACHE_KEY, sourceUrl: cache3.sourceUrl, payload: JSON.stringify(cache3), fetchedAt: new Date(cache3.fetchedAt) }).onDuplicateKeyUpdate({
      set: { sourceUrl: cache3.sourceUrl, payload: JSON.stringify(cache3), fetchedAt: new Date(cache3.fetchedAt) }
    });
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be saved:", error);
  }
}
function assertTimetableIntegrity(data, requiredGroup) {
  if (!data.timetables.length || !data.timetables.some((item) => item.lectures.length > 0)) throw new Error("The resolved source did not contain a usable timetable.");
  if (requiredGroup && !findGroupTimetable(data, requiredGroup)) {
    throw new Error(`The resolved source does not contain the saved subsection ${cleanGroupCode(requiredGroup).toUpperCase()}.`);
  }
}
async function fetchAndParseOfficialTimetable(sourceUrl, previousCache, requiredGroup) {
  const response = await fetch(sourceUrl, {
    headers: buildTimetableRequestHeaders(previousCache, sourceUrl),
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (response.status === 304) {
    if (!previousCache || previousCache.sourceUrl !== sourceUrl) throw new Error("The official timetable returned an unusable not-modified response.");
    return { ...previousCache, fetchedAt: Date.now(), validators: { etag: response.headers.get("etag") ?? previousCache.validators?.etag ?? null, lastModified: response.headers.get("last-modified") ?? previousCache.validators?.lastModified ?? null } };
  }
  if (!response.ok) throw new Error(`The official timetable responded with ${response.status}.`);
  const html = await response.text();
  if (!html.trim()) throw new Error("The official timetable returned an empty response.");
  const data = parseTimetableHtml(html);
  assertTimetableIntegrity(data, requiredGroup);
  return {
    data,
    fetchedAt: Date.now(),
    sourceUrl,
    validators: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") }
  };
}
async function fetchEmergencyTimetableSnapshot(requiredGroup, fetcher = fetch) {
  const response = await fetcher(TIMETABLE_EMERGENCY_SNAPSHOT_URL, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`The verified emergency timetable snapshot responded with ${response.status}.`);
  const html = await response.text();
  if (!html.trim()) throw new Error("The verified emergency timetable snapshot was empty.");
  const data = parseTimetableHtml(html);
  assertTimetableIntegrity(data, requiredGroup);
  return {
    data,
    fetchedAt: Date.now(),
    sourceUrl: TIMETABLE_EMERGENCY_SNAPSHOT_URL,
    validators: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") }
  };
}
async function refreshCache(previousCache, forceDataRefresh, requiredGroup) {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const resolution = await resolveTimetableSource({ lastKnownSourceUrl: previousCache?.sourceUrl ?? null });
      console.info("[Timetable] Source resolved:", resolution.source, resolution.url, {
        officialError: resolution.officialError,
        fallbackError: resolution.fallbackError
      });
      const sourceChanged = previousCache?.sourceUrl !== resolution.url;
      const cacheIsFresh = Boolean(previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS);
      if (previousCache && !forceDataRefresh && !sourceChanged && cacheIsFresh) return previousCache;
      let cache3;
      try {
        cache3 = await fetchAndParseOfficialTimetable(resolution.url, sourceChanged ? null : previousCache, requiredGroup);
      } catch (sourceError) {
        console.warn("[Timetable] Live source unavailable; attempting verified emergency snapshot:", asErrorMessage(sourceError));
        cache3 = await fetchEmergencyTimetableSnapshot(requiredGroup);
      }
      inMemoryCache = cache3;
      await persistCache(cache3);
      return cache3;
    })().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}
async function getKnownCache() {
  if (inMemoryCache) return inMemoryCache;
  inMemoryCache = await readPersistentCache();
  return inMemoryCache;
}
async function getOfficialTimetable(forceRefresh = false, requiredGroup) {
  const previousCache = await getKnownCache();
  if (!forceRefresh && previousCache) {
    const age = Date.now() - previousCache.fetchedAt;
    if (age < REVALIDATE_AFTER_MS) {
      const emergency = previousCache.sourceUrl === TIMETABLE_EMERGENCY_SNAPSHOT_URL;
      return {
        cache: previousCache,
        freshness: emergency ? "stale" : "fresh",
        updateError: emergency ? EMERGENCY_SNAPSHOT_NOTICE : null
      };
    }
  }
  try {
    const cache3 = await refreshCache(previousCache, true, requiredGroup);
    const emergency = cache3.sourceUrl === TIMETABLE_EMERGENCY_SNAPSHOT_URL;
    return {
      cache: cache3,
      freshness: emergency ? "stale" : "fresh",
      updateError: emergency ? EMERGENCY_SNAPSHOT_NOTICE : null
    };
  } catch (error) {
    const message = asErrorMessage(error);
    if (previousCache) return { cache: previousCache, freshness: "stale", updateError: message };
    throw new Error(`Could not update the official timetable: ${message}`);
  }
}
function findGroupTimetable(data, requestedGroup) {
  const normalized = cleanGroupCode(requestedGroup).toUpperCase();
  return data.timetables.find((item) => item.group.code.toUpperCase() === normalized) ?? null;
}

// server/temporarySections.ts
import { load as load2 } from "cheerio";
import axios from "axios";
import { eq as eq3 } from "drizzle-orm";
import { getDocumentProxy } from "unpdf";

// shared/student-profile.ts
var TEMPORARY_SECTION_BRANCHES = ["CE", "CS", "EC", "EE", "IT", "ME", "RAI"];

// server/temporarySections.ts
var REQUEST_TIMEOUT_MS2 = 25e3;
var CACHE_PREFIX = "official-gnedc-permanent-section-2026-v4";
var PDF_RANGE_CHUNK_BYTES = 128 * 1024;
var PDF_RANGE_CONCURRENCY = 8;
var PDF_RANGE_TIMEOUT_MS = 25e3;
var PDF_RANGE_RETRIES = 2;
var MAX_OFFICIAL_PDF_BYTES = 4 * 1024 * 1024;
var inMemoryCache2 = /* @__PURE__ */ new Map();
var inFlightRefresh2 = /* @__PURE__ */ new Map();
var PERMANENT_SECTION_COLUMN_STARTS = [0, 20, 60, 110, 210, 290, 385, 410, 440, 485, 575, 690];
var BRANCH_DOCUMENT_URLS = {
  CE: "https://appsc.gndec.ac.in/sites/default/files/2026-09/CE%20Permanent%20Section%2015_09_2026.pdf",
  CS: "https://appsc.gndec.ac.in/sites/default/files/2026-09/CS%20Permanent%20Section%2015_09_2026.pdf",
  EC: "https://appsc.gndec.ac.in/sites/default/files/2026-09/EC%20Permanent%20Section%2015_09_2026.pdf",
  EE: "https://appsc.gndec.ac.in/sites/default/files/2026-09/EE%20Permanent%20Section%2015_09_2026.pdf",
  IT: "https://appsc.gndec.ac.in/sites/default/files/2026-09/IT%20Permanent%20Section%2015_09_2026.pdf",
  ME: "https://appsc.gndec.ac.in/sites/default/files/2026-09/ME%20Permanent%20Section%2015_09_2026_0.pdf",
  RAI: "https://appsc.gndec.ac.in/sites/default/files/2026-09/RAI%20Permanent%20Section%2015_09_2026.pdf"
};
function cacheKey(branch) {
  return `${CACHE_PREFIX}:${branch}`;
}
function normalizeText2(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeSearch(value) {
  return normalizeText2(value).toUpperCase().replace(/[^A-Z0-9 ]/g, "");
}
function isBranch(value) {
  return TEMPORARY_SECTION_BRANCHES.includes(value);
}
function isValidEnvelope2(value) {
  if (!value || typeof value !== "object") return false;
  const cache3 = value;
  return Boolean(
    cache3.data && isBranch(cache3.data.branch ?? "") && Array.isArray(cache3.data.students) && typeof cache3.fetchedAt === "number" && typeof cache3.sourceUrl === "string"
  );
}
function splitCrnAndBranch(value) {
  const normalized = normalizeText2(value);
  const match = normalized.match(/^(\d{6,10})\s*([A-Z]{2,4})$/i);
  if (!match) return [null, null];
  return [match[1], match[2].toUpperCase()];
}
function splitMobileAndVenue(value) {
  const normalized = normalizeText2(value);
  const match = normalized.match(/^(\d{10})\s*(.+)$/);
  if (match) {
    const venue = normalizeText2(match[2]);
    return [match[1], venue || null];
  }
  if (/^\d{10}$/.test(normalized)) return [normalized, null];
  if (normalized && !/^\d+$/.test(normalized)) return [null, normalized];
  return [normalized || null, null];
}
function parseTemporarySectionText(text2, expectedBranch, sourceUrl) {
  const students = [];
  for (const rawLine of text2.split(/\r?\n/)) {
    const columns = rawLine.split("	").map(normalizeText2);
    if (columns.length < 11) continue;
    const [
      ,
      registrationNumber,
      crnBranchCell,
      studentName,
      motherName,
      fatherName,
      section,
      subsection,
      mentoringGroup,
      mentorName,
      mobileVenueCell,
      classCoordinator
    ] = columns;
    const [crn, branchFromCell] = splitCrnAndBranch(crnBranchCell);
    let crnFinal = crn;
    let branchFinal = branchFromCell;
    if (!crnFinal && /^\d{6,16}$/.test(crnBranchCell)) {
      crnFinal = crnBranchCell;
    }
    if (!crnFinal || !studentName || !section || !subsection) continue;
    if (/^\d{6,16}\s/.test(studentName) || /^\d{6,16}$/.test(studentName)) continue;
    const recordBranch = (branchFinal ?? expectedBranch).toUpperCase();
    if (recordBranch !== expectedBranch) continue;
    const [mentorMobileNumber, venue] = splitMobileAndVenue(mobileVenueCell ?? "");
    students.push({
      studentName,
      crn: crnFinal,
      registrationNumber: /^\d{6,16}$/.test(registrationNumber) ? registrationNumber : null,
      fatherName: fatherName || null,
      motherName: motherName || null,
      branch: recordBranch,
      section: section.toUpperCase(),
      subsection: subsection.toUpperCase(),
      mentoringGroup: mentoringGroup || null,
      mentorName: mentorName || null,
      mentorMobileNumber: mentorMobileNumber || null,
      venue: venue || null,
      classCoordinator: classCoordinator || null,
      source: "official",
      sourceUrl,
      savedAt: Date.now()
    });
  }
  if (!students.length) {
    throw new Error(`The official ${expectedBranch} permanent-section document did not contain readable student rows.`);
  }
  const seen = /* @__PURE__ */ new Set();
  return students.filter((student) => {
    const key = student.crn;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.crn.localeCompare(right.crn, void 0, { numeric: true }));
}
function findBranchDocumentUrl(html, branch) {
  const $ = load2(html);
  const target = `${branch} BRANCH`;
  const href = $("a").toArray().map((node) => {
    const href2 = $(node).attr("href");
    return { href: href2, decodedHref: href2 ? decodeURIComponent(href2) : "", label: normalizeText2($(node).text()).toUpperCase() };
  }).find((link) => link.href && /\.pdf(?:$|\?)/i.test(link.href) && link.label.includes(target) && /PERMANENT\s+SECTION/i.test(link.decodedHref))?.href;
  if (!href) throw new Error(`The official website does not currently list a ${branch} permanent-section PDF.`);
  return new URL(href, TEMPORARY_SECTION_SOURCE_PAGE_URL).toString();
}
async function discoverBranchDocument(branch) {
  const known = BRANCH_DOCUMENT_URLS[branch];
  if (known) return known;
  const response = await fetch(TEMPORARY_SECTION_SOURCE_PAGE_URL, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NextLecture/1.0 (GNDEC profile companion)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS2)
  });
  if (!response.ok) throw new Error(`The official permanent-section page responded with ${response.status}.`);
  return findBranchDocumentUrl(await response.text(), branch);
}
function getTotalPdfBytes(contentRange) {
  const total = contentRange?.match(/\/(\d+)$/)?.[1];
  const size = total ? Number(total) : NaN;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_OFFICIAL_PDF_BYTES) {
    throw new Error("The official temporary-section PDF size could not be safely determined.");
  }
  return size;
}
async function fetchPdfRange(sourceUrl, start, end) {
  let lastError = null;
  for (let attempt = 0; attempt <= PDF_RANGE_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(sourceUrl, {
        headers: {
          Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
          Range: `bytes=${start}-${end}`,
          "User-Agent": "NextLecture/1.0 (GNDEC profile companion)"
        },
        responseType: "arraybuffer",
        timeout: PDF_RANGE_TIMEOUT_MS,
        maxContentLength: PDF_RANGE_CHUNK_BYTES + 256,
        maxBodyLength: PDF_RANGE_CHUNK_BYTES + 256
      });
      if (response.status !== 206) throw new Error(`The official PDF did not honour a bounded range request (${response.status}).`);
      const bytes = new Uint8Array(response.data);
      const expected = end - start + 1;
      if (bytes.byteLength !== expected) throw new Error("The official PDF returned an incomplete range response.");
      return { bytes, contentRange: response.headers["content-range"] ?? null };
    } catch (error) {
      lastError = error;
      if (attempt < PDF_RANGE_RETRIES) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The official PDF range request failed.");
}
async function fetchOfficialPdfBytes(sourceUrl) {
  const first = await fetchPdfRange(sourceUrl, 0, PDF_RANGE_CHUNK_BYTES - 1);
  const totalBytes = getTotalPdfBytes(first.contentRange);
  const ranges = Array.from({ length: Math.ceil(totalBytes / PDF_RANGE_CHUNK_BYTES) }, (_, index) => {
    const start = index * PDF_RANGE_CHUNK_BYTES;
    return { index, start, end: Math.min(totalBytes - 1, start + PDF_RANGE_CHUNK_BYTES - 1) };
  });
  const chunks = Array.from({ length: ranges.length });
  chunks[0] = first.bytes;
  let nextRange = 1;
  await Promise.all(Array.from({ length: Math.min(PDF_RANGE_CONCURRENCY, Math.max(0, ranges.length - 1)) }, async () => {
    while (nextRange < ranges.length) {
      const rangeIndex = nextRange;
      nextRange += 1;
      const range = ranges[rangeIndex];
      chunks[rangeIndex] = (await fetchPdfRange(sourceUrl, range.start, range.end)).bytes;
    }
  }));
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}
async function extractOfficialPdfText(sourceUrl) {
  const document = await getDocumentProxy(new Uint8Array(await fetchOfficialPdfBytes(sourceUrl)));
  try {
    const lines = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = /* @__PURE__ */ new Map();
      for (const item of content.items) {
        const value = normalizeText2(item.str ?? "");
        const transform = item.transform;
        if (!value || !transform) continue;
        const rowKey = Math.round(transform[5] ?? 0);
        rows.set(rowKey, [...rows.get(rowKey) ?? [], item]);
      }
      for (const [, row] of Array.from(rows.entries()).sort(([left], [right]) => right - left)) {
        const columns = Array.from({ length: PERMANENT_SECTION_COLUMN_STARTS.length }, () => "");
        for (const item of row.sort((left, right) => (left.transform?.[4] ?? 0) - (right.transform?.[4] ?? 0))) {
          const value = normalizeText2(item.str ?? "");
          const x = item.transform?.[4] ?? 0;
          let columnIndex = PERMANENT_SECTION_COLUMN_STARTS.findIndex((start, index) => {
            const nextStart = PERMANENT_SECTION_COLUMN_STARTS[index + 1] ?? Number.POSITIVE_INFINITY;
            return x >= start && x < nextStart;
          });
          if (columnIndex < 0) columnIndex = columns.length - 1;
          columns[columnIndex] = normalizeText2(`${columns[columnIndex]} ${value}`);
        }
        lines.push(columns.join("	"));
      }
    }
    return lines.join("\n");
  } finally {
    await document.destroy?.();
  }
}
async function readPersistentCache2(branch) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: timetableCache.payload }).from(timetableCache).where(eq3(timetableCache.id, cacheKey(branch))).limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidEnvelope2(parsed) && parsed.data.branch === branch ? parsed : null;
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be read:", error);
    return null;
  }
}
async function persistCache2(cache3) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timetableCache).values({
      id: cacheKey(cache3.data.branch),
      sourceUrl: cache3.sourceUrl,
      payload: JSON.stringify(cache3),
      fetchedAt: new Date(cache3.fetchedAt)
    }).onDuplicateKeyUpdate({
      set: { sourceUrl: cache3.sourceUrl, payload: JSON.stringify(cache3), fetchedAt: new Date(cache3.fetchedAt) }
    });
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be saved:", error);
  }
}
async function getKnownCache2(branch) {
  const existing = inMemoryCache2.get(branch);
  if (existing) return existing;
  const persistent = await readPersistentCache2(branch);
  if (persistent) inMemoryCache2.set(branch, persistent);
  return persistent;
}
async function clearStoredCache(branch) {
  inMemoryCache2.delete(branch);
  const db = await getDb();
  if (!db) return;
  const keys = [
    cacheKey(branch),
    // Legacy prefixes so force-refresh fully invalidates older layouts.
    `official-gnedc-permanent-section-2026-v3:${branch}`,
    `official-gnedc-permanent-section-2026-v2:${branch}`,
    `official-gnedc-permanent-section-2026-v1:${branch}`
  ];
  try {
    for (const id of keys) {
      await db.delete(timetableCache).where(eq3(timetableCache.id, id));
    }
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be cleared:", error);
  }
}
async function refreshCache2(branch) {
  const existing = inFlightRefresh2.get(branch);
  if (existing) return existing;
  const request = (async () => {
    const sourceUrl = await discoverBranchDocument(branch);
    const students = parseTemporarySectionText(await extractOfficialPdfText(sourceUrl), branch, sourceUrl);
    const cache3 = {
      data: { branch, students },
      fetchedAt: Date.now(),
      sourceUrl
    };
    inMemoryCache2.set(branch, cache3);
    await persistCache2(cache3);
    return cache3;
  })().finally(() => inFlightRefresh2.delete(branch));
  inFlightRefresh2.set(branch, request);
  return request;
}
async function getOfficialTemporarySections(branchInput, forceRefresh = false) {
  const branch = normalizeText2(branchInput).toUpperCase();
  if (!isBranch(branch)) throw new Error(`Temporary-section lookup is not available for ${branchInput || "this branch"}.`);
  if (forceRefresh) {
    await clearStoredCache(branch);
  }
  const previousCache = forceRefresh ? null : await getKnownCache2(branch);
  const fresh = previousCache && Date.now() - previousCache.fetchedAt < TEMPORARY_SECTION_CACHE_TTL_MS;
  if (!forceRefresh && fresh) return { cache: previousCache, freshness: "fresh", updateError: null };
  try {
    return { cache: await refreshCache2(branch), freshness: "fresh", updateError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official temporary-section update failed.";
    console.warn(`[Temporary sections] Official source refresh failed: ${message}`);
    const fallback = forceRefresh ? null : previousCache;
    if (fallback) return { cache: fallback, freshness: "stale", updateError: message };
    throw new Error(`Could not load the official temporary-section details: ${message}`);
  }
}
async function prepareTemporarySectionBranch(branch) {
  const result = await getOfficialTemporarySections(branch);
  return {
    branch: result.cache.data.branch,
    studentCount: result.cache.data.students.length,
    fetchedAt: result.cache.fetchedAt,
    sourceUrl: result.cache.sourceUrl,
    freshness: result.freshness,
    updateError: result.updateError
  };
}
async function searchTemporarySectionStudents(branch, query) {
  const result = await getOfficialTemporarySections(branch);
  const needle = normalizeSearch(query);
  const matches = result.cache.data.students.filter((student) => normalizeSearch(student.studentName).includes(needle)).slice(0, 20).map(({ studentName, crn, branch: studentBranch, section, subsection, mentoringGroup }) => ({
    studentName,
    crn,
    branch: studentBranch,
    section,
    subsection,
    mentoringGroup
  }));
  return { matches, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}
async function getTemporarySectionStudent(branch, crn) {
  const result = await getOfficialTemporarySections(branch);
  const student = result.cache.data.students.find((item) => item.crn === crn) ?? null;
  return { student, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}

// server/syllabus.ts
import axios2 from "axios";
var cache = null;
var inFlight = null;
var MAX_SYLLABUS_BYTES = 8 * 1024 * 1024;
var PDF_RANGE_CHUNK_BYTES2 = 128 * 1024;
var PDF_RANGE_CONCURRENCY2 = 8;
async function fetchSyllabusRange(start, end) {
  const response = await axios2.get(SYLLABUS_SOURCE_URL, {
    responseType: "arraybuffer",
    timeout: 25e3,
    maxContentLength: PDF_RANGE_CHUNK_BYTES2 + 1024,
    maxBodyLength: PDF_RANGE_CHUNK_BYTES2 + 1024,
    headers: {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      Range: `bytes=${start}-${end}`,
      "User-Agent": "NextLecture/1.0 (GNDEC syllabus companion)"
    }
  });
  return { bytes: Buffer.from(response.data), headers: response.headers, status: response.status };
}
function readTotalBytes(contentRange) {
  const match = String(contentRange ?? "").match(/bytes\s+\d+-\d+\/(\d+)/i);
  const total = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
async function fetchOfficialSyllabusBytes() {
  const first = await fetchSyllabusRange(0, PDF_RANGE_CHUNK_BYTES2 - 1);
  const totalBytes = readTotalBytes(first.headers["content-range"]);
  if (first.status !== 206 || !totalBytes) return first.bytes;
  if (totalBytes > MAX_SYLLABUS_BYTES) throw new Error("The official syllabus PDF is larger than the supported safety limit.");
  const chunks = [first.bytes];
  const ranges = Array.from({ length: Math.ceil(totalBytes / PDF_RANGE_CHUNK_BYTES2) - 1 }, (_, index) => {
    const start = (index + 1) * PDF_RANGE_CHUNK_BYTES2;
    return { start, end: Math.min(totalBytes - 1, start + PDF_RANGE_CHUNK_BYTES2 - 1) };
  });
  for (let offset = 0; offset < ranges.length; offset += PDF_RANGE_CONCURRENCY2) {
    const group = await Promise.all(ranges.slice(offset, offset + PDF_RANGE_CONCURRENCY2).map((range) => fetchSyllabusRange(range.start, range.end)));
    chunks.push(...group.map((result) => result.bytes));
  }
  return Buffer.concat(chunks).subarray(0, totalBytes);
}
async function getOfficialSyllabusPdfBuffer(force = false) {
  if (!force && cache && Date.now() - cache.fetchedAt < SYLLABUS_CACHE_TTL_MS) return cache;
  if (!force && inFlight) return inFlight;
  const load4 = async () => {
    const bytes = await fetchOfficialSyllabusBytes();
    if (!bytes.length || bytes.length > MAX_SYLLABUS_BYTES || !bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      throw new Error("The official syllabus source did not return a valid PDF document.");
    }
    cache = { bytes, fetchedAt: Date.now() };
    return cache;
  };
  inFlight = load4().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
async function getOfficialSyllabusDocument(force = false) {
  const syllabus = await getOfficialSyllabusPdfBuffer(force);
  return {
    base64: syllabus.bytes.toString("base64"),
    mimeType: "application/pdf",
    sourceUrl: SYLLABUS_SOURCE_URL,
    fetchedAt: syllabus.fetchedAt,
    byteLength: syllabus.bytes.length
  };
}

// shared/previous-papers.ts
var previousPaperSessionRows = [
  ["1py8IGO_sNeYgajnJk6vy0ZTCcV-j3Q6Q", "May 2013", 2013, "May", false],
  ["13MCtBVU6MWiCcf15gmdYZtMo6YIlXv4m", "November 2013", 2013, "November", false],
  ["1IZHoRc4wr1q3JKxP-lYH05CQyC9CzmYm", "May 2014", 2014, "May", false],
  ["1HCgF1W9oBEgFnbYkAOBMXnC5DCIawtDv", "November 2014", 2014, "November", false],
  ["1gKRXxg2MdqjEf0nwLxxPcQ8Jv2_Rty_j", "May 2015", 2015, "May", false],
  ["1e-4vxLOsF5YtfH6AK0ArzVtYXWvJ4QTU", "November 2015", 2015, "November", false],
  ["13Z6JJjDzwB1IkUnrTX7IkcNbqusz8Vjl", "May 2016", 2016, "May", false],
  ["18dw5bm0NMDo3NS_E9kJLC3aNGspbXm-z", "November 2016", 2016, "November", false],
  ["1r3NlwlvSD5j7XRfLeNUw3Bk0GmKPU7nq", "May 2017", 2017, "May", false],
  ["1ht6i3Xay8njX3zidqGWnkLrnhKWv5GyB", "November 2017", 2017, "November", false],
  ["1U8DE4mzC8GDPailf706H6yI6Sotayxvx", "May 2018", 2018, "May", false],
  ["1DDiS4zuZWEWciSGDjzn40t6LXKweQA8D", "November 2018", 2018, "November", false],
  ["1jsWeKxF6-5L-88snuhXdK3YqH7_5utZB", "May 2019", 2019, "May", false],
  ["1nHYLcQcKFTAbl73ByqKc7lL6tIMMcaz0", "November 2019", 2019, "November", false],
  ["1tSajo-ep5z4dFDmbdWU9sYDNPddmnz45", "November 2020", 2020, "November", false],
  ["1Sd_BehGiibgsQrpAoki4O0WTH39fnjwb", "May 2021", 2021, "May", false],
  ["1KTsdbyhOP79sFdLW-72630PyoQ9XU3UO", "November 2021", 2021, "November", false],
  ["1RrNrAQjHrDBBPngI-6vwdhbCkpWK4npf", "May 2022", 2022, "May", false],
  ["18he5n2Lk-rRGm3anCH-PYXpXk4yjBsDp", "Makeup \xB7 May 2022", 2022, "May", true],
  ["1fiwQAhuVSTiCcrywbNZqZD63S4OgrcXT", "November 2022", 2022, "November", false],
  ["1jXHxAcJq8qNtjuW8YXY-cNd1OSxvBxDy", "Makeup \xB7 November 2022", 2022, "November", true],
  ["12zlzuN-8PnJqF0W9ujUge-5Rg9_hwAFa", "May 2023", 2023, "May", false],
  ["1oOcj9DoufGnq2dG2Vfl72eC456xHZZt1", "Makeup \xB7 May 2023", 2023, "May", true],
  ["1HF_ThB2z1L_IcaePC0BRZ_qw4DwKBMYC", "November 2023", 2023, "November", false],
  ["1IRfXz75zO2IgLMVeowdFn11zczXnBznU", "Makeup \xB7 November 2023", 2023, "November", true],
  ["1-ejwgx8No0umWLv9KH5vlHfYTfwA9r-4", "May 2024", 2024, "May", false],
  ["1W-xcHyOyTRHWYulgkC-XqR5SL3hSBHIj", "Makeup \xB7 May 2024", 2024, "May", true],
  ["1G0GbKPN0oWlgXT4Lbukt-p58Zwny_kan", "November 2024", 2024, "November", false],
  ["1LBjMTooTYVCBX78idPgrHfIsjqpmLWwC", "Makeup \xB7 November 2024", 2024, "November", true],
  ["1xUqKfe8uVeYh-yxzOAIJReelVVGGkSAF", "May 2025", 2025, "May", false],
  ["1p9p79CFGPnVyT03vI1VfeX3SFfywjo1O", "Makeup \xB7 May 2025", 2025, "May", true],
  ["1BndBZ3VJgEIBRldbdh-COmh4Tvu0000L", "November 2025", 2025, "November", false],
  ["1sTQuhpZjkHU4wHuTvbkrGsdX80v9OC0Y", "Makeup \xB7 November 2025", 2025, "November", true]
];
var PREVIOUS_PAPER_SESSIONS = previousPaperSessionRows.map(([id, label, year, term, makeup]) => ({ id, label, year, term, makeup }));
function toGoogleDrivePaperLinks(id) {
  return { viewUrl: `https://drive.google.com/file/d/${id}/view`, downloadUrl: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` };
}

// server/previousPapers.ts
import axios3 from "axios";
var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var PAPER_FILE_ID = /^[A-Za-z0-9_-]{20,100}$/;
var cache2 = /* @__PURE__ */ new Map();
function decodeHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}
function parseGoogleDrivePapers(html) {
  const papers = [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of Array.from(html.matchAll(/\bdata-id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi))) {
    const id = match[1];
    const text2 = decodeHtml(match[2]);
    const name = (text2.match(/(?:^|\s)(?:PDF\s+)?(.+?\.pdf)(?=\s+(?:Shared|Partagé|Download|Télécharger)(?:\s|$)|$)/i)?.[1] ?? "").trim();
    if (!PAPER_FILE_ID.test(id) || !/\.pdf$/i.test(name) || seen.has(id)) continue;
    seen.add(id);
    papers.push({ id, name, ...toGoogleDrivePaperLinks(id) });
  }
  return papers.sort((left, right) => left.name.localeCompare(right.name, void 0, { numeric: true }));
}
function getPreviousPaperSessions() {
  return PREVIOUS_PAPER_SESSIONS;
}
async function getPreviousPapers(sessionId) {
  const session = PREVIOUS_PAPER_SESSIONS.find((item) => item.id === sessionId);
  if (!session) throw new Error("That paper archive session is not available.");
  const cached = cache2.get(session.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return { session, papers: cached.papers, fetchedAt: cached.fetchedAt, freshness: "fresh" };
  const response = await axios3.get(`https://drive.google.com/drive/folders/${session.id}`, {
    headers: { Accept: "text/html", "User-Agent": "NextLecture/1.0 (previous papers catalog)" },
    responseType: "text",
    timeout: 25e3,
    maxContentLength: 2 * 1024 * 1024
  });
  const papers = parseGoogleDrivePapers(response.data);
  const fetchedAt = Date.now();
  cache2.set(session.id, { fetchedAt, papers });
  return { session, papers, fetchedAt, freshness: "fresh" };
}

// server/androidProfileRecovery.ts
var CACHE_TTL_MS2 = 6 * 60 * 60 * 1e3;
var cachedDirectory = null;
function normalize(value) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ").replace(/[^A-Z0-9 ]/g, "");
}
function normalizeRecord(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  if (typeof record.crn !== "string" || typeof record.registrationNumber !== "string" || typeof record.candidateName !== "string" || typeof record.branch !== "string" || typeof record.subsection !== "string") return null;
  return record;
}
async function getAndroidStudentDirectory(fetcher = fetch) {
  if (cachedDirectory && Date.now() - cachedDirectory.fetchedAt < CACHE_TTL_MS2) return cachedDirectory.records;
  const response = await fetcher(ANDROID_STUDENT_DIRECTORY_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The Android student directory is unavailable.");
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("The Android student directory had an invalid format.");
  const records = payload.map(normalizeRecord).filter((record) => Boolean(record));
  if (!records.length) throw new Error("The Android student directory did not contain usable profiles.");
  cachedDirectory = { records, fetchedAt: Date.now() };
  return records;
}
async function recoverAndroidRegistrationNumber(input, fetcher = fetch) {
  const records = await getAndroidStudentDirectory(fetcher);
  const match = records.find(
    (record) => normalize(record.crn) === normalize(input.crn) && normalize(record.branch) === normalize(input.branch) && normalize(record.subsection) === normalize(input.subsection) && normalize(record.candidateName) === normalize(input.studentName)
  );
  return { registrationNumber: match?.registrationNumber?.trim() || null };
}

// server/vacantRooms.ts
import { load as load3 } from "cheerio";
import { eq as eq4 } from "drizzle-orm";

// shared/vacant-rooms.ts
var VACANT_ROOMS_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];
var LETTER_NUMBER = /^([A-Z]{1,3})[\s\-_]*(\d{1,4}[A-Z]{0,2})$/;
var LAB_SHORTHAND = /^(.+?)\s*\/\s*L\s*(\([^)]*\))?$/;
var PARENS = /\(([^)]*)\)/g;
var LAB_ANNOTATION = /^[A-Z]+\s*LAB\s*\S+$/;
var PUNCT = /[-_.,/]/g;
var WHITESPACE = /\s+/g;
var ROOM_ALIASES = {
  "WS SEMINAR HALL": "W S SEMINAR HALL",
  "W SHOP SEM HALL": "W S SEMINAR HALL",
  "W S SEM HALL": "W S SEMINAR HALL",
  "SEM HALL": "SEMINAR HALL BA",
  "MEAS LAB": "MEASUREMENT LAB",
  "ADV MEAS LAB": "ADVANCE MEASUREMENT LAB",
  "F102 AUTO BLK": "F102",
  "MBA COMP LAB": "COMP LAB MBA"
};
function canonicalRoomName(raw) {
  let s = raw.replace(/\u00a0/g, " ").replace(/\u202f/g, " ").toUpperCase().trim();
  if (!s) return null;
  s = s.replace(WHITESPACE, " ").trim().replace(/\.$/, "").trim();
  const shorthand = LAB_SHORTHAND.exec(s);
  if (shorthand) {
    const annotation = (shorthand[2] ?? "").replace(/[()]/g, "").trim();
    s = `${shorthand[1]} LAB ${annotation}`.trim();
  }
  s = s.replace(PARENS, (_m, inner) => {
    const t2 = String(inner).trim();
    return LAB_ANNOTATION.test(t2) ? ` ${t2} ` : " ";
  });
  s = s.replace(PUNCT, " ").replace(WHITESPACE, " ").trim();
  if (!s) return null;
  if (ROOM_ALIASES[s]) s = ROOM_ALIASES[s];
  const ln = LETTER_NUMBER.exec(s);
  if (ln) s = ln[1] + ln[2];
  return s;
}

// server/_core/background.ts
function scheduleBackground(task) {
  const guarded = task.catch((error) => {
    console.warn("[Background] Task failed:", error instanceof Error ? error.message : error);
  });
  try {
    const maybeWaitUntil = globalThis.waitUntil;
    if (typeof maybeWaitUntil === "function") {
      maybeWaitUntil(guarded);
      return;
    }
  } catch {
  }
  void guarded;
}

// server/vacantRooms.ts
var ROOM_SOURCE_ROOTS = [
  { id: "appsc", indexUrl: "https://appsc.gndec.ac.in/time_tables", host: "appsc.gndec.ac.in" },
  { id: "cse", indexUrl: "https://cse.gndec.ac.in/?q=node/5", host: "cse.gndec.ac.in" },
  { id: "ece", indexUrl: "https://ece.gndec.ac.in/?q=node/5", host: "ece.gndec.ac.in" },
  { id: "ee", indexUrl: "https://ee.gndec.ac.in/?q=node/5", host: "ee.gndec.ac.in" },
  { id: "me", indexUrl: "https://me.gndec.ac.in/?q=node/5", host: "me.gndec.ac.in" },
  { id: "ce", indexUrl: "https://ce.gndec.ac.in/?q=node/5", host: "ce.gndec.ac.in" },
  { id: "it", indexUrl: "https://it.gndec.ac.in/?q=node/5", host: "it.gndec.ac.in" },
  { id: "mca", indexUrl: "https://mca.gndec.ac.in/?q=node/5", host: "mca.gndec.ac.in" },
  { id: "mba", indexUrl: "https://mba.gndec.ac.in/?q=node/5", host: "mba.gndec.ac.in" }
];
var ROOT_ORDER = ["appsc", "cse", "ece", "ee", "me", "ce", "it", "mca", "mba"];
var REVALIDATE_AFTER_MS2 = 2 * 60 * 1e3;
var MAX_CANDIDATES = 3;
var REQUEST_TIMEOUT_MS3 = 2e4;
var USER_AGENT = "NextLecture/1.0 (GNDEC vacant rooms)";
var PERSISTENT_CACHE_KEY = "vacant-rooms-v1";
var memoryCache = null;
var inFlight2 = null;
function isValidCachedRoomData(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
  return Array.isArray(row.docs) && row.docs.length > 0 && Array.isArray(row.incompleteRoots) && typeof row.fetchedAtMillis === "number" && Number.isFinite(row.fetchedAtMillis);
}
async function readPersistentCache3() {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: externalSourceCache.payload }).from(externalSourceCache).where(eq4(externalSourceCache.id, PERSISTENT_CACHE_KEY)).limit(1);
    if (!rows[0]?.payload) return null;
    const parsed = JSON.parse(rows[0].payload);
    if (!isValidCachedRoomData(parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn("[Vacant rooms] Persistent cache could not be read:", error);
    return null;
  }
}
async function persistCache3(cache3) {
  if (!cache3.docs.length) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(externalSourceCache).values({
      id: PERSISTENT_CACHE_KEY,
      sourceUrl: "vacant-rooms-multi-root",
      payload: JSON.stringify(cache3),
      fetchedAt: new Date(cache3.fetchedAtMillis)
    }).onDuplicateKeyUpdate({
      set: {
        sourceUrl: "vacant-rooms-multi-root",
        payload: JSON.stringify(cache3),
        fetchedAt: new Date(cache3.fetchedAtMillis)
      }
    });
  } catch (error) {
    console.warn("[Vacant rooms] Persistent cache could not be saved:", error);
  }
}
async function getKnownCache3() {
  if (memoryCache?.docs.length) return memoryCache;
  const persistent = await readPersistentCache3();
  if (persistent) memoryCache = persistent;
  return persistent;
}
var PLACEHOLDERS = /* @__PURE__ */ new Set([
  "GHOST ROOM",
  "TEACH OFFICE",
  "TEACH OFFICE1",
  "FACULTY ROOM",
  "A OTHER DEPTT",
  "B OTHER DEPTT",
  "C OTHER DEPTT",
  "FIRST YEAR ROOM",
  "A",
  "B",
  "C"
]);
function isPlaceholder(key) {
  return PLACEHOLDERS.has(key);
}
function isRoomLike(key) {
  return /^[A-Z]{1,3}\d/.test(key);
}
function displayName(candidates) {
  return [...candidates].sort((a, b) => a.priority - b.priority || a.name.length - b.name.length || a.name.localeCompare(b.name))[0]?.name ?? "";
}
function isCandidateUrl(raw, root) {
  try {
    const parsed = new URL(raw.trim());
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.toLowerCase() === root.host.toLowerCase() && parsed.pathname.toLowerCase().endsWith(".html");
  } catch {
    return false;
  }
}
function classifyAnchor(label, href, root) {
  if (!isCandidateUrl(href, root)) return "NONE";
  let path = "";
  try {
    path = new URL(href).pathname.toLowerCase();
  } catch {
    return "NONE";
  }
  if (path.includes("rooms") || path.includes("room_")) return "ROOMS";
  if (path.includes("groups_days_horizontal") || path.includes("years_days_horizontal")) return "GROUPS";
  const l = label.toLowerCase();
  if (l.includes("class room") || l.includes("classroom")) return "ROOMS";
  if (["class", "student", "group"].some((t2) => l.includes(t2))) return "GROUPS";
  if (l.includes("room")) return "ROOMS";
  return "NONE";
}
async function fetchText(url) {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS3)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const body = await response.text();
  if (!body.trim()) throw new Error(`Empty body for ${url}`);
  return body;
}
function discoverRoot(root, html) {
  const $ = load3(html);
  const roomUrls = [];
  const groupUrls = [];
  const seen = /* @__PURE__ */ new Set();
  $("a[href]").each((_, el) => {
    const hrefAttr = $(el).attr("href") ?? "";
    let href = "";
    try {
      href = new URL(hrefAttr, root.indexUrl).toString();
    } catch {
      return;
    }
    if (!href || seen.has(href)) return;
    seen.add(href);
    const label = ($(el).text() ?? "").replace(/\u00a0/g, " ").trim();
    const kind = classifyAnchor(label, href, root);
    if (kind === "ROOMS") roomUrls.push(href);
    else if (kind === "GROUPS") groupUrls.push(href);
  });
  return { root, roomUrls, groupUrls };
}
async function discoverAll() {
  const results = await Promise.all(
    ROOM_SOURCE_ROOTS.map(async (root) => {
      try {
        const html = await fetchText(root.indexUrl);
        return [root.id, discoverRoot(root, html)];
      } catch {
        return [root.id, { root, roomUrls: [], groupUrls: [] }];
      }
    })
  );
  return new Map(results);
}
function isCurrentSession(generatedAtMillis, nowMillis) {
  if (generatedAtMillis == null) return true;
  const generated = new Date(generatedAtMillis);
  const now = new Date(nowMillis);
  if (generated.getTime() > now.getTime()) return true;
  const session = (d) => {
    const m = d.getMonth() + 1;
    return m >= 6 && m <= 12 ? `${d.getFullYear()}-2` : `${d.getFullYear()}-1`;
  };
  return session(generated) === session(now);
}
var GENERATED_ON = /generated with FET\s+\S+\s+on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})[\u202f\u00a0 ]*([AaPp][Mm])?/i;
var TIME_IN_LABEL = /(\d{1,2})[.:](\d{2})(?:\s*([AaPp][Mm]))?/;
var DIALECT_B_ACTIVITY = /\(?([LPT])\)?\s*\.?\s*$/;
var EMPTY_CELL_TEXT = /* @__PURE__ */ new Set(["---", "-x-", "-", "--", "x", "not available", "na", "n/a"]);
function slotStartMinutes(label) {
  const m = TIME_IN_LABEL.exec(label);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = (m[3] ?? "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  else if (!meridiem && hour <= 7) hour += 12;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}
function parseGeneratedAtMillis(html) {
  const m = GENERATED_ON.exec(html);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2e3;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const meridiem = (m[6] ?? "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}
function dayIndexFor(label, column, columnCount) {
  const token = (label.split(" ")[0] ?? "").toUpperCase();
  switch (token) {
    case "MONDAY":
      return 0;
    case "TUESDAY":
    case "TUES":
    case "TUE":
      return 1;
    case "WEDNESDAY":
    case "WED":
      return 2;
    case "THURSDAY":
    case "THURS":
    case "THU":
      return 3;
    case "FRIDAY":
    case "FRI":
      return 4;
    case "SATURDAY":
    case "SAT":
      return 5;
    case "SUNDAY":
    case "SUN":
      return 6;
  }
  if (token.length <= 2 && columnCount >= 5 && columnCount <= 6 && column < 6) return column;
  return null;
}
function tableName($, table) {
  const captionName = table.find("caption span.name").first().text().trim();
  if (captionName) return captionName;
  const colspanHeader = table.find("thead th[colspan]").first().text().trim();
  return colspanHeader || null;
}
function resolveDays($, table) {
  const labels = table.find("thead th.xAxis").map((_, el) => $(el).text().trim()).get();
  return labels.map((label, index) => dayIndexFor(label, index, labels.length));
}
function slotStartsOf($, table) {
  const starts = [];
  table.find("tbody tr").each((_, row) => {
    const label = $(row).find("th.yAxis").first().text();
    if (!label) return;
    const minutes = slotStartMinutes(label);
    if (minutes == null || starts.includes(minutes)) return;
    starts.push(minutes);
  });
  return starts;
}
function parseCell($, td) {
  const text2 = td.text().trim();
  if (td.hasClass("empty") || !text2 || EMPTY_CELL_TEXT.has(text2.toLowerCase())) {
    return { busy: false, roomNames: [] };
  }
  const subjects = td.find("span.subject").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const teachers = td.find("div.teacher").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const sets = td.find("div.studentsset").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const activityRaw = td.find("span.activitytag").first().text().trim().toUpperCase();
  const activity = activityRaw === "L" || activityRaw === "P" || activityRaw === "T" ? activityRaw : void 0;
  const roomNames = td.find("span[class^=r_]").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  if (!subjects.length && !teachers.length && !sets.length && !roomNames.length) {
    const html = td.html() ?? "";
    const lines = html.split(/<br\s*\/?>/i).map((fragment) => load3(`<div>${fragment}</div>`).text().trim()).filter((line) => line && !EMPTY_CELL_TEXT.has(line.toLowerCase()));
    if (!lines.length) return null;
    let subject = null;
    let act;
    const subjectLine = lines[lines.length - 1];
    const activityMatch = DIALECT_B_ACTIVITY.exec(subjectLine);
    if (activityMatch) {
      act = activityMatch[1];
      const stripped = subjectLine.slice(0, activityMatch.index).trim();
      subject = stripped || subjectLine;
    } else {
      subject = subjectLine;
    }
    return {
      busy: true,
      subject,
      teacher: lines[lines.length - 2] ?? null,
      studentsSet: lines[lines.length - 3] ?? null,
      activity: act,
      roomNames: []
    };
  }
  return {
    busy: true,
    subject: subjects.join(" \xB7 ") || null,
    teacher: teachers.join(" \xB7 ") || null,
    studentsSet: sets.join(" \xB7 ") || null,
    activity,
    roomNames
  };
}
function parseTableGrid($, table, days, slotCount) {
  const rows = table.find("tbody tr").filter((_, el) => $(el).find("th.yAxis").length > 0).toArray();
  if (!rows.length) return null;
  const sourceDayCount = days.length;
  const grid = Array.from(
    { length: sourceDayCount },
    () => Array.from({ length: slotCount }, () => null)
  );
  const spanLeft = new Array(sourceDayCount).fill(0);
  const spanCarry = new Array(sourceDayCount).fill(null);
  const slotIndexOf = /* @__PURE__ */ new Map();
  slotStartsOf($, table).forEach((minutes, i) => slotIndexOf.set(minutes, i));
  let rowIndex = 0;
  for (const tr of rows) {
    const $tr = $(tr);
    const label = $tr.find("th.yAxis").first().text() || "";
    const minutes = slotStartMinutes(label);
    let slotIndex = minutes != null ? slotIndexOf.get(minutes) : void 0;
    if (slotIndex == null) {
      if (rowIndex < slotCount) slotIndex = rowIndex;
      else continue;
    }
    rowIndex += 1;
    let column = 0;
    const cells = $tr.children("td").toArray().map((el) => $(el));
    let cellIndex = 0;
    while (column < sourceDayCount) {
      if (spanLeft[column] > 0) {
        grid[column][slotIndex] = spanCarry[column] ?? { busy: true, roomNames: [] };
        spanLeft[column] -= 1;
        column += 1;
        continue;
      }
      if (cellIndex >= cells.length) break;
      const td = cells[cellIndex++];
      const rowspan = Math.max(1, Number(td.attr("rowspan") ?? "1") || 1);
      const cell = parseCell($, td);
      grid[column][slotIndex] = cell;
      if (rowspan > 1) {
        spanLeft[column] = rowspan - 1;
        spanCarry[column] = cell;
      }
      column += 1;
    }
    while (column < sourceDayCount && spanLeft[column] > 0) {
      grid[column][slotIndex] = spanCarry[column] ?? { busy: true, roomNames: [] };
      spanLeft[column] -= 1;
      column += 1;
    }
  }
  return grid;
}
function gridCellToRoomCell(cell) {
  if (cell == null || !cell.busy) return { busy: false };
  return {
    busy: true,
    subject: cell.subject ?? null,
    teacher: cell.teacher ?? null,
    studentsSet: cell.studentsSet ?? null,
    activity: cell.activity ?? null
  };
}
function parseDoc(html, rootId, url, fetchedAtMillis, kind) {
  if (!html.trim()) throw new Error("empty room timetable html");
  const $ = load3(html);
  const tables = $("table[id^=table_]").toArray().map((el) => $(el)).filter((table) => tableName($, table) != null);
  if (!tables.length) throw new Error("no room tables discovered in document");
  const first = tables[0];
  const days = resolveDays($, first);
  if (!days.some((d) => d != null && d >= 0 && d <= 5)) throw new Error("no weekday columns found");
  const slotStarts = slotStartsOf($, first);
  if (!slotStarts.length) throw new Error("no time slots found");
  const generatedAt = parseGeneratedAtMillis(html);
  const dayRowCount = 7;
  const byKey = /* @__PURE__ */ new Map();
  for (const table of tables) {
    const grid = parseTableGrid($, table, days, slotStarts.length);
    if (!grid) continue;
    if (kind === "ROOMS") {
      const rawName = tableName($, table);
      if (!rawName) continue;
      const names = rawName.includes(",") ? rawName.split(",").map((s) => s.trim()).filter(Boolean) : [rawName];
      for (const name of names) {
        const key = canonicalRoomName(name);
        if (!key || byKey.has(key)) continue;
        const canonical = Array.from(
          { length: dayRowCount },
          () => Array.from({ length: slotStarts.length }, () => null)
        );
        for (let col = 0; col < days.length; col++) {
          const dayIdx = days[col];
          if (dayIdx == null || dayIdx < 0 || dayIdx >= dayRowCount) continue;
          const row = grid[col];
          if (!row) continue;
          for (let slot = 0; slot < row.length; slot++) {
            canonical[dayIdx][slot] = gridCellToRoomCell(row[slot]);
          }
        }
        byKey.set(key, { key, name, occupancy: canonical });
      }
    } else {
      for (let colIdx = 0; colIdx < grid.length; colIdx++) {
        const dayIdx = days[colIdx];
        if (dayIdx == null || dayIdx < 0 || dayIdx > 6) continue;
        const col = grid[colIdx];
        for (let slotIdx = 0; slotIdx < col.length; slotIdx++) {
          const cell = col[slotIdx];
          if (!cell?.busy) continue;
          for (const rawRoom of cell.roomNames) {
            const key = canonicalRoomName(rawRoom);
            if (!key) continue;
            const existing = byKey.get(key);
            const rows = existing ? existing.occupancy.map((r) => [...r]) : Array.from({ length: dayRowCount }, () => Array.from({ length: slotStarts.length }, () => null));
            const current = rows[dayIdx][slotIdx];
            if (current == null || !current.busy) {
              rows[dayIdx][slotIdx] = gridCellToRoomCell(cell);
              byKey.set(key, { key, name: existing?.name ?? rawRoom, occupancy: rows });
            }
          }
        }
      }
    }
  }
  if (!byKey.size) throw new Error("no room schedules parsed from document");
  return {
    rootId,
    kind,
    url,
    slotStarts,
    rooms: Array.from(byKey.values()),
    generatedAtMillis: generatedAt,
    fetchedAtMillis
  };
}
async function fetchRootDoc(root, candidates, nowMillis) {
  const fetchedAt = Date.now();
  const attempts = [...candidates.roomUrls.slice(0, MAX_CANDIDATES), ...candidates.groupUrls.slice(0, MAX_CANDIDATES)];
  for (const url of attempts) {
    const isGroups = !candidates.roomUrls.includes(url);
    try {
      const html = await fetchText(url);
      const parsed = isGroups ? parseDoc(html, root.id, url, fetchedAt, "GROUPS_CELLS") : parseDoc(html, root.id, url, fetchedAt, "ROOMS");
      if (!isCurrentSession(parsed.generatedAtMillis, nowMillis)) continue;
      return parsed;
    } catch {
    }
  }
  return null;
}
function rootPriority(rootId) {
  const idx = ROOT_ORDER.indexOf(rootId);
  return idx >= 0 ? idx : ROOT_ORDER.length;
}
function merge(docs, incompleteRoots) {
  const orderedDocs = [...docs].sort((a, b) => rootPriority(a.rootId) - rootPriority(b.rootId));
  const slotUnion = Array.from(new Set(orderedDocs.flatMap((d) => d.slotStarts))).sort((a, b) => a - b);
  const slotIndexOf = new Map(slotUnion.map((s, i) => [s, i]));
  const rooms = /* @__PURE__ */ new Map();
  const rootsByKey = /* @__PURE__ */ new Map();
  for (const doc of orderedDocs) {
    for (const room of doc.rooms) {
      if (!rootsByKey.has(room.key)) rootsByKey.set(room.key, /* @__PURE__ */ new Set());
      rootsByKey.get(room.key).add(doc.rootId);
    }
  }
  const scopedKey = /* @__PURE__ */ new Map();
  for (const [key, roots] of rootsByKey) {
    if (!isRoomLike(key) && !roots.has("appsc") && roots.size >= 2) {
      for (const root of roots) scopedKey.set(`${root}|${key}`, `${root}:${key}`);
    }
  }
  for (const doc of orderedDocs) {
    for (const room of doc.rooms) {
      const key = scopedKey.get(`${doc.rootId}|${room.key}`) ?? room.key;
      let entry = rooms.get(key);
      if (!entry) {
        entry = {
          names: [],
          occupancy: Array.from({ length: 7 }, () => Array.from({ length: slotUnion.length }, () => null))
        };
        rooms.set(key, entry);
      }
      if (!entry.names.some((n) => n.name === room.name)) {
        entry.names.push({ priority: rootPriority(doc.rootId), name: room.name });
      }
      for (let col = 0; col < room.occupancy.length && col <= 6; col++) {
        const cells = room.occupancy[col];
        for (let slot = 0; slot < cells.length; slot++) {
          const cell = cells[slot];
          if (cell == null) continue;
          const globalSlot = slotIndexOf.get(doc.slotStarts[slot] ?? -1);
          if (globalSlot == null) continue;
          const current = entry.occupancy[col][globalSlot];
          if (current?.busy) continue;
          if (cell.busy) entry.occupancy[col][globalSlot] = cell;
          else if (!current) entry.occupancy[col][globalSlot] = cell;
        }
      }
    }
  }
  const scopedValues = new Set(scopedKey.values());
  const ROOM_LIKE_RE = /^([A-Z]{1,3})(\d{1,4})([A-Z]{0,2})$/;
  const mergedRooms = Array.from(rooms.entries()).filter(([key]) => !isPlaceholder(key)).map(([key, data]) => {
    let name;
    if (scopedValues.has(key)) {
      const rootId = key.slice(0, key.indexOf(":"));
      const raw = displayName(data.names);
      name = `${raw} \xB7 ${rootId === "appsc" ? "College" : rootId.toUpperCase()}`;
    } else {
      name = displayName(data.names);
    }
    return { key, name, occupancy: data.occupancy.map((row) => row.map((c) => c ? { ...c } : null)) };
  }).sort((a, b) => {
    const ka = a.name.split(" \xB7 ")[0].trim();
    const kb = b.name.split(" \xB7 ")[0].trim();
    const ma = ROOM_LIKE_RE.exec(ka);
    const mb = ROOM_LIKE_RE.exec(kb);
    if (ma && mb) {
      const prefix = ma[1].localeCompare(mb[1]);
      if (prefix !== 0) return prefix;
      const num = Number(ma[2]) - Number(mb[2]);
      if (num !== 0) return num;
      return ma[3].localeCompare(mb[3]);
    }
    if (ma) return -1;
    if (mb) return 1;
    return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
  });
  const sources = orderedDocs.map((doc) => ({
    rootId: doc.rootId,
    kind: doc.kind,
    url: doc.url,
    roomCount: doc.rooms.length,
    generatedAtMillis: doc.generatedAtMillis,
    fetchedAtMillis: doc.fetchedAtMillis
  }));
  return {
    sources,
    incompleteRoots: Array.from(new Set(incompleteRoots)).sort(),
    days: [...VACANT_ROOMS_DAYS],
    slotStarts: slotUnion,
    rooms: mergedRooms,
    fetchedAtMillis: orderedDocs.reduce((max, d) => Math.max(max, d.fetchedAtMillis), 0)
  };
}
async function refresh(force) {
  const now = Date.now();
  const previous = await getKnownCache3();
  const cached = previous ?? { docs: [], incompleteRoots: [], fetchedAtMillis: 0 };
  let discovered = null;
  try {
    discovered = await discoverAll();
  } catch {
    discovered = null;
  }
  const reused = /* @__PURE__ */ new Map();
  const rootsToFetch = [];
  for (const root of ROOM_SOURCE_ROOTS) {
    const cachedDoc = cached.docs.find((d) => d.rootId === root.id) ?? null;
    const candidates = discovered?.get(root.id) ?? null;
    const desiredUrl = candidates?.roomUrls[0] ?? candidates?.groupUrls[0] ?? null;
    const shouldReuse = cachedDoc != null && (candidates == null || !force && desiredUrl === cachedDoc.url);
    if (shouldReuse && cachedDoc) {
      reused.set(cachedDoc.rootId, cachedDoc);
    } else {
      rootsToFetch.push({ root, candidates: candidates ?? { root, roomUrls: [], groupUrls: [] } });
    }
  }
  const fetchedEntries = await Promise.all(
    rootsToFetch.map(async ({ root, candidates }) => {
      try {
        const doc = await fetchRootDoc(root, candidates, now);
        return [root.id, doc];
      } catch {
        return [root.id, null];
      }
    })
  );
  const fetched = new Map(fetchedEntries);
  const docs = [];
  const incomplete = [];
  for (const root of ROOM_SOURCE_ROOTS) {
    const fresh = fetched.get(root.id) ?? null;
    const cachedDoc = cached.docs.find((d) => d.rootId === root.id) ?? null;
    const candidates = discovered?.get(root.id) ?? null;
    if (fresh) docs.push(fresh);
    else if (reused.has(root.id)) docs.push(reused.get(root.id));
    else if (cachedDoc && candidates && (candidates.roomUrls.includes(cachedDoc.url) || candidates.groupUrls.includes(cachedDoc.url))) {
      docs.push(cachedDoc);
    } else {
      incomplete.push(root.id);
    }
  }
  if (!docs.length) {
    if (cached.docs.length) {
      memoryCache = cached;
      return merge(cached.docs, cached.incompleteRoots);
    }
    throw new Error("No department room timetable could be loaded right now");
  }
  const next = { docs, incompleteRoots: incomplete, fetchedAtMillis: now };
  memoryCache = next;
  await persistCache3(next);
  return merge(docs, incomplete);
}
async function getVacantRooms(forceRefresh = false) {
  const known = await getKnownCache3();
  if (!forceRefresh && known?.docs.length) {
    const age = Date.now() - known.fetchedAtMillis;
    if (age >= REVALIDATE_AFTER_MS2 && !inFlight2) {
      scheduleBackground(refresh(false).then(() => void 0));
    }
    return merge(known.docs, known.incompleteRoots);
  }
  if (inFlight2 && !forceRefresh) return inFlight2;
  inFlight2 = refresh(forceRefresh).catch(async (error) => {
    const fallback = memoryCache ?? await readPersistentCache3();
    if (fallback?.docs.length) {
      memoryCache = fallback;
      return merge(fallback.docs, fallback.incompleteRoots);
    }
    throw error;
  }).finally(() => {
    inFlight2 = null;
  });
  return inFlight2;
}

// server/campusFeeds.ts
import { eq as eq5 } from "drizzle-orm";
var REQUEST_TIMEOUT_MS4 = 2e4;
var REVALIDATE_AFTER_MS3 = 2 * 60 * 1e3;
var USER_AGENT2 = "NextLecture/1.0 (GNDEC campus feeds)";
var HOLIDAY_CACHE_KEY = "campus-holidays-v1";
var NOTICE_CACHE_KEY = "campus-notices-v1";
var holidayCache = null;
var noticeCache = null;
var holidayInFlight = null;
var noticeInFlight = null;
function isHolidayFeed(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
  return Array.isArray(row.holidays) && row.holidays.length > 0;
}
function isNoticeFeed(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
  return Array.isArray(row.notices) && row.notices.length > 0;
}
async function readPersistentFeed(key, validate) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: externalSourceCache.payload, fetchedAt: externalSourceCache.fetchedAt }).from(externalSourceCache).where(eq5(externalSourceCache.id, key)).limit(1);
    if (!rows[0]?.payload) return null;
    const parsed = JSON.parse(rows[0].payload);
    if (!validate(parsed)) return null;
    const fetchedAtMillis = rows[0].fetchedAt instanceof Date ? rows[0].fetchedAt.getTime() : Date.parse(String(rows[0].fetchedAt));
    return {
      data: parsed,
      fetchedAtMillis: Number.isFinite(fetchedAtMillis) ? fetchedAtMillis : Date.now()
    };
  } catch (error) {
    console.warn(`[Campus feeds] Persistent cache could not be read (${key}):`, error);
    return null;
  }
}
async function persistFeed(key, sourceUrl, data, fetchedAtMillis) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(externalSourceCache).values({
      id: key,
      sourceUrl,
      payload: JSON.stringify(data),
      fetchedAt: new Date(fetchedAtMillis)
    }).onDuplicateKeyUpdate({
      set: {
        sourceUrl,
        payload: JSON.stringify(data),
        fetchedAt: new Date(fetchedAtMillis)
      }
    });
  } catch (error) {
    console.warn(`[Campus feeds] Persistent cache could not be saved (${key}):`, error);
  }
}
async function getKnownHolidayCache() {
  if (holidayCache) return holidayCache;
  const persistent = await readPersistentFeed(HOLIDAY_CACHE_KEY, isHolidayFeed);
  if (persistent) holidayCache = persistent;
  return persistent;
}
async function getKnownNoticeCache() {
  if (noticeCache) return noticeCache;
  const persistent = await readPersistentFeed(NOTICE_CACHE_KEY, isNoticeFeed);
  if (persistent) noticeCache = persistent;
  return persistent;
}
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function asYear(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}
function normalizeHoliday(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw;
  const id = asString(row.id);
  const name = asString(row.name);
  const date = asString(row.date);
  if (!id || !name || !date) return null;
  return {
    id,
    name,
    date,
    displayDate: asString(row.displayDate) || date,
    weekday: asString(row.weekday),
    category: asString(row.category) || "Public holiday",
    year: asYear(row.year) || Number(date.slice(0, 4)) || 0,
    source: asString(row.source)
  };
}
function normalizeNotice(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw;
  const id = asString(row.id);
  const title = asString(row.title);
  const url = asString(row.url);
  if (!id || !title || !url) return null;
  return {
    id,
    title,
    publishedDate: asString(row.publishedDate),
    displayDate: asString(row.displayDate) || asString(row.publishedDate),
    url,
    author: asString(row.author),
    source: asString(row.source),
    firstSeenAt: asString(row.firstSeenAt),
    bannerStartDate: asString(row.bannerStartDate),
    bannerUntilDate: asString(row.bannerUntilDate)
  };
}
async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT2 },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS4)
  });
  if (!response.ok) throw new Error(`Upstream responded with ${response.status}`);
  return response.json();
}
async function loadHolidays(forceRefresh) {
  const known = await getKnownHolidayCache();
  if (!forceRefresh && known) {
    const age = Date.now() - known.fetchedAtMillis;
    if (age >= REVALIDATE_AFTER_MS3 && !holidayInFlight) {
      scheduleBackground(loadHolidays(true).then(() => void 0));
    }
    return { ...known.data, servedFromCache: true, stale: age >= REVALIDATE_AFTER_MS3, refreshError: null };
  }
  if (holidayInFlight && !forceRefresh) return holidayInFlight;
  holidayInFlight = (async () => {
    const bases = [HOLIDAY_API_BASE_URL, NOTICES_API_BASE_URL];
    let lastError = null;
    for (const base of bases) {
      try {
        const url = `${base.replace(/\/$/, "")}/api/holidays${forceRefresh ? "?refresh=true" : ""}`;
        const payload = await fetchJson(url);
        const holidays = (Array.isArray(payload.holidays) ? payload.holidays : []).map(normalizeHoliday).filter((item) => Boolean(item)).sort((a, b) => a.date.localeCompare(b.date));
        if (!holidays.length) throw new Error("No holidays found in the official list");
        const now = Date.now();
        const feed = {
          holidays,
          fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date(now).toISOString(),
          servedFromCache: false,
          stale: false,
          refreshError: null
        };
        holidayCache = { data: feed, fetchedAtMillis: now };
        await persistFeed(HOLIDAY_CACHE_KEY, url, feed, now);
        return feed;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Could not load holidays";
      }
    }
    const fallback = holidayCache ?? await getKnownHolidayCache();
    if (fallback) {
      return {
        ...fallback.data,
        servedFromCache: true,
        stale: true,
        refreshError: lastError
      };
    }
    throw new Error(lastError || "Could not load official holidays");
  })().finally(() => {
    holidayInFlight = null;
  });
  return holidayInFlight;
}
async function loadNotices(forceRefresh) {
  const known = await getKnownNoticeCache();
  if (!forceRefresh && known) {
    const age = Date.now() - known.fetchedAtMillis;
    if (age >= REVALIDATE_AFTER_MS3 && !noticeInFlight) {
      scheduleBackground(loadNotices(true).then(() => void 0));
    }
    return { ...known.data, servedFromCache: true, stale: age >= REVALIDATE_AFTER_MS3, refreshError: null };
  }
  if (noticeInFlight && !forceRefresh) return noticeInFlight;
  noticeInFlight = (async () => {
    try {
      const url = `${NOTICES_API_BASE_URL.replace(/\/$/, "")}/api/notices${forceRefresh ? "?refresh=true" : ""}`;
      const payload = await fetchJson(url);
      const notices = (Array.isArray(payload.notices) ? payload.notices : []).map(normalizeNotice).filter((item) => Boolean(item)).sort((a, b) => b.publishedDate.localeCompare(a.publishedDate) || b.firstSeenAt.localeCompare(a.firstSeenAt));
      if (!notices.length) throw new Error("No notices found in the ERP response");
      const now = Date.now();
      const feed = {
        notices,
        fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date(now).toISOString(),
        servedFromCache: false,
        stale: false,
        refreshError: null
      };
      noticeCache = { data: feed, fetchedAtMillis: now };
      await persistFeed(NOTICE_CACHE_KEY, url, feed, now);
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load notices";
      const fallback = noticeCache ?? await getKnownNoticeCache();
      if (fallback) {
        return {
          ...fallback.data,
          servedFromCache: true,
          stale: true,
          refreshError: message
        };
      }
      throw new Error(message);
    }
  })().finally(() => {
    noticeInFlight = null;
  });
  return noticeInFlight;
}
async function getHolidayFeed(forceRefresh = false) {
  return loadHolidays(forceRefresh);
}
async function getNoticeFeed(forceRefresh = false) {
  return loadNotices(forceRefresh);
}

// server/markAttendance.ts
import { eq as eq6 } from "drizzle-orm";
import { nanoid } from "nanoid";
var CACHE_PREFIX2 = "mark-attendance-session-v1";
var SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1e3;
var inMemorySessions = /* @__PURE__ */ new Map();
function cacheKey2(sessionId) {
  return `${CACHE_PREFIX2}:${sessionId}`;
}
function isBranch2(value) {
  return TEMPORARY_SECTION_BRANCHES.includes(value);
}
function isValidSession(value) {
  if (!value || typeof value !== "object") return false;
  const session = value;
  return Boolean(
    typeof session.id === "string" && typeof session.subjectName === "string" && isBranch2(session.branch ?? "") && typeof session.createdAt === "number" && Array.isArray(session.attendees)
  );
}
function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL_MS;
}
async function readPersistentSession(sessionId) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: timetableCache.payload }).from(timetableCache).where(eq6(timetableCache.id, cacheKey2(sessionId))).limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidSession(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[Mark attendance] Persistent session could not be read:", error);
    return null;
  }
}
async function persistSession(session) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timetableCache).values({
      id: cacheKey2(session.id),
      sourceUrl: `mark-attendance://${session.id}`,
      payload: JSON.stringify(session),
      fetchedAt: new Date(session.createdAt)
    }).onDuplicateKeyUpdate({
      set: {
        sourceUrl: `mark-attendance://${session.id}`,
        payload: JSON.stringify(session),
        fetchedAt: /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    console.warn("[Mark attendance] Persistent session could not be saved:", error);
  }
}
async function getSession(sessionId) {
  const fromMemory = inMemorySessions.get(sessionId);
  if (fromMemory) {
    if (isExpired(fromMemory)) {
      inMemorySessions.delete(sessionId);
      return null;
    }
    return fromMemory;
  }
  const fromDb = await readPersistentSession(sessionId);
  if (!fromDb || isExpired(fromDb)) return null;
  inMemorySessions.set(sessionId, fromDb);
  return fromDb;
}
async function createMarkAttendanceSession(subjectName, branchInput) {
  const subject = subjectName.replace(/\s+/g, " ").trim();
  if (subject.length < 2) throw new Error("Subject name must be at least 2 characters.");
  const branch = branchInput.trim().toUpperCase();
  if (!isBranch2(branch)) throw new Error(`Unsupported branch: ${branchInput}`);
  const session = {
    id: nanoid(12),
    subjectName: subject,
    branch,
    createdAt: Date.now(),
    attendees: []
  };
  inMemorySessions.set(session.id, session);
  await persistSession(session);
  return session;
}
async function getMarkAttendanceSession(sessionId) {
  const session = await getSession(sessionId.trim());
  if (!session) throw new Error("This attendance link is invalid or has expired.");
  return {
    id: session.id,
    subjectName: session.subjectName,
    branch: session.branch,
    createdAt: session.createdAt,
    attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
    presentCount: session.attendees.length
  };
}
async function markAttendancePresent(sessionId, studentName, crn) {
  const session = await getSession(sessionId.trim());
  if (!session) throw new Error("This attendance link is invalid or has expired.");
  const name = studentName.replace(/\s+/g, " ").trim();
  const roll = crn.trim();
  if (name.length < 2) throw new Error("Student name is required.");
  if (!/^\d{6,16}$/.test(roll)) throw new Error("CRN must be 6\u201316 digits.");
  const existingIndex = session.attendees.findIndex((a) => a.crn === roll);
  if (existingIndex >= 0) {
    return {
      id: session.id,
      subjectName: session.subjectName,
      branch: session.branch,
      createdAt: session.createdAt,
      attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
      presentCount: session.attendees.length,
      alreadyMarked: true
    };
  }
  session.attendees.push({
    studentName: name,
    crn: roll,
    markedAt: Date.now()
  });
  inMemorySessions.set(session.id, session);
  await persistSession(session);
  return {
    id: session.id,
    subjectName: session.subjectName,
    branch: session.branch,
    createdAt: session.createdAt,
    attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
    presentCount: session.attendees.length,
    alreadyMarked: false
  };
}

// server/routers.ts
async function loadGroup(group, forceRefresh = false) {
  try {
    const result = await getOfficialTimetable(forceRefresh, group);
    const timetable = findGroupTimetable(result.cache.data, group);
    if (!timetable) {
      throw new TRPCError3({
        code: "NOT_FOUND",
        message: "That timetable group is not available in the latest official source."
      });
    }
    return {
      timetable,
      fetchedAt: result.cache.fetchedAt,
      sourceUrl: result.cache.sourceUrl,
      sourceGeneratedAt: result.cache.data.sourceGeneratedAt,
      freshness: result.freshness,
      updateError: result.updateError
    };
  } catch (error) {
    if (error instanceof TRPCError3) throw error;
    throw new TRPCError3({
      code: "BAD_GATEWAY",
      message: "We couldn't load the official timetable right now. Please try again shortly.",
      cause: error
    });
  }
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  timetable: router({
    groups: publicProcedure.query(async () => {
      try {
        const result = await getOfficialTimetable(false);
        return {
          groups: result.cache.data.groups,
          fetchedAt: result.cache.fetchedAt,
          freshness: result.freshness,
          updateError: result.updateError
        };
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't reach the official timetable. Please check your connection and try again.",
          cause: error
        });
      }
    }),
    dashboard: publicProcedure.input(z2.object({ group: z2.string().trim().min(2).max(80) })).query(({ input }) => loadGroup(input.group)),
    refresh: publicProcedure.input(z2.object({ group: z2.string().trim().min(2).max(80) })).mutation(({ input }) => loadGroup(input.group, true))
  }),
  temporarySections: router({
    prepare: publicProcedure.input(z2.object({ branch: z2.string().trim().toUpperCase().min(2).max(5) })).query(async ({ input }) => {
      try {
        return await prepareTemporarySectionBranch(input.branch);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "The official document could not be read.";
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: `We couldn't prepare the official temporary-section list. ${reason}`,
          cause: error
        });
      }
    }),
    search: publicProcedure.input(z2.object({ branch: z2.string().trim().toUpperCase().min(2).max(5), query: z2.string().trim().min(2).max(80) })).query(async ({ input }) => {
      try {
        return await searchTemporarySectionStudents(input.branch, input.query);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't load the official temporary-section details. You can enter your profile manually instead.",
          cause: error
        });
      }
    }),
    profile: publicProcedure.input(z2.object({ branch: z2.string().trim().toUpperCase().min(2).max(5), crn: z2.string().trim().regex(/^\d{6,16}$/) })).query(async ({ input }) => {
      try {
        return await getTemporarySectionStudent(input.branch, input.crn);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't finish the official profile lookup. You can enter your profile manually instead.",
          cause: error
        });
      }
    }),
    androidRegistration: publicProcedure.input(z2.object({
      crn: z2.string().trim().regex(/^\d{6,16}$/),
      branch: z2.string().trim().toUpperCase().min(2).max(5),
      studentName: z2.string().trim().min(2).max(120),
      subsection: z2.string().trim().min(2).max(40)
    })).query(async ({ input }) => {
      try {
        return await recoverAndroidRegistrationNumber(input);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't prepare Android attendance sync right now. You can enter the registration number manually instead.",
          cause: error
        });
      }
    })
  }),
  syllabus: router({
    document: publicProcedure.query(async () => {
      try {
        return await getOfficialSyllabusDocument();
      } catch (error) {
        throw new TRPCError3({ code: "BAD_GATEWAY", message: "We couldn't load the official syllabus PDF. Please try again shortly.", cause: error });
      }
    })
  }),
  previousPapers: router({
    sessions: publicProcedure.query(() => getPreviousPaperSessions()),
    papers: publicProcedure.input(z2.object({ sessionId: z2.string().trim().regex(/^[A-Za-z0-9_-]{20,100}$/) })).query(async ({ input }) => {
      try {
        return await getPreviousPapers(input.sessionId);
      } catch (error) {
        console.warn("[Previous papers] Unable to load Drive session", input.sessionId, error);
        throw new TRPCError3({ code: "BAD_GATEWAY", message: "We couldn't load that paper archive right now. Please try the original Drive folder.", cause: error });
      }
    })
  }),
  vacantRooms: router({
    data: publicProcedure.input(z2.object({ forceRefresh: z2.boolean().optional() }).optional()).query(async ({ input }) => {
      try {
        return await getVacantRooms(Boolean(input?.forceRefresh));
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Couldn't load the room timetables right now.",
          cause: error
        });
      }
    }),
    refresh: publicProcedure.mutation(async () => {
      try {
        return await getVacantRooms(true);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Couldn't refresh the room timetables right now.",
          cause: error
        });
      }
    })
  }),
  campus: router({
    holidays: publicProcedure.input(z2.object({ forceRefresh: z2.boolean().optional() }).optional()).query(async ({ input }) => {
      try {
        return await getHolidayFeed(Boolean(input?.forceRefresh));
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Couldn't load the official holiday list.",
          cause: error
        });
      }
    }),
    notices: publicProcedure.input(z2.object({ forceRefresh: z2.boolean().optional() }).optional()).query(async ({ input }) => {
      try {
        return await getNoticeFeed(Boolean(input?.forceRefresh));
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Couldn't load official college notices.",
          cause: error
        });
      }
    })
  }),
  markAttendance: router({
    createSession: publicProcedure.input(
      z2.object({
        subjectName: z2.string().trim().min(2).max(80),
        branch: z2.string().trim().toUpperCase().min(2).max(5)
      })
    ).mutation(async ({ input }) => {
      try {
        return await createMarkAttendanceSession(input.subjectName, input.branch);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Could not create attendance session.",
          cause: error
        });
      }
    }),
    getSession: publicProcedure.input(z2.object({ sessionId: z2.string().trim().min(6).max(32) })).query(async ({ input }) => {
      try {
        return await getMarkAttendanceSession(input.sessionId);
      } catch (error) {
        throw new TRPCError3({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Session not found.",
          cause: error
        });
      }
    }),
    markPresent: publicProcedure.input(
      z2.object({
        sessionId: z2.string().trim().min(6).max(32),
        studentName: z2.string().trim().min(2).max(120),
        crn: z2.string().trim().regex(/^\d{6,16}$/)
      })
    ).mutation(async ({ input }) => {
      try {
        return await markAttendancePresent(input.sessionId, input.studentName, input.crn);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Could not mark attendance.",
          cause: error
        });
      }
    })
  })
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios4 from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios4.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// shared/syllabus-chat.ts
var DEFAULT_GEMINI_MODEL_ID = "gemini-3.6-flash";

// shared/syllabus-prompt.ts
function buildSyllabusSystemInstruction(profile) {
  const branch = profile?.branch ?? "not available";
  return `You are NextLecture Syllabus AI. You answer questions only from the attached official GNDEC B.Tech Semester 1\u20132 syllabus PDF. The student branch saved on this device is ${branch}.

Non-negotiable rules:
1. Treat the attached PDF as the sole source of truth. Do not use outside knowledge, assumptions, recollection, or invented course content.
2. Identify the exact semester, subject, course code, and branch applicability from the PDF before answering. If the request is ambiguous, state the matching possibilities from the document and ask for the missing course title, course code, or semester.
3. For a syllabus request, include every listed unit in its original order. Preserve all named topics, subtopics, practical components, outcomes, hours, marks, prerequisites, and assessment details when they are present in the PDF. Never summarize away a unit or topic.
4. Clearly distinguish facts in the document from anything the document does not state. If the answer is not in the PDF, say \u201CNot stated in the official syllabus PDF.\u201D
5. Use clean Markdown: headings, bold labels, ordered unit lists, and tables only when they improve clarity. Do not use unsupported citations or URLs.
6. End substantive answers with a concise source note naming the course code/title and PDF page number(s) whenever you can identify them.
7. Follow-up questions must remain grounded in the same attached PDF and the preceding conversation. Do not claim that a topic is included unless it appears in the document.`;
}

// server/syllabusGemini.ts
function getConfiguredGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null;
}
function normalizeServerGeminiModelId(modelId) {
  return typeof modelId === "string" && modelId.trim() ? modelId.trim().replace(/^models\//i, "") : DEFAULT_GEMINI_MODEL_ID;
}
function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item;
    if (message.role !== "user" && message.role !== "assistant" || typeof message.content !== "string") return [];
    const content = message.content.trim().slice(0, 12e3);
    return content ? [{ id: message.id ?? "server-history", role: message.role, content, createdAt: message.createdAt ?? 0 }] : [];
  });
}
async function createServerFallbackGeminiResponse(request, signal) {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on this deployment.");
  const question = typeof request.question === "string" ? request.question.trim().slice(0, 12e3) : "";
  if (!question) throw new Error("A syllabus question is required.");
  const profile = request.profile ?? null;
  const history = normalizeHistory(request.history);
  const document = await getOfficialSyllabusDocument();
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeServerGeminiModelId(request.modelId))}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSyllabusSystemInstruction(profile) }] },
      contents: [
        ...history.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
        { role: "user", parts: [{ inlineData: { mimeType: document.mimeType, data: document.base64 } }, { text: `Official source: ${document.sourceUrl}
Student branch: ${profile?.branch ?? "not available"}

Question: ${question}` }] }
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    })
  });
}

// server/attendanceProxy.ts
var ALLOWED_ROUTES = /* @__PURE__ */ new Set(["POST /session", "GET /", "GET /leaderboard", "POST /records", "DELETE /records"]);
function getAttendanceApiBase() {
  return process.env.ATTENDANCE_API_BASE?.trim().replace(/\/$/, "") || null;
}
function isAllowedAttendanceRoute(method, relativePath) {
  return ALLOWED_ROUTES.has(`${method.toUpperCase()} ${relativePath}`);
}
function hasOnlyQueryParameters(url, allowed) {
  return Array.from(url.searchParams.keys()).every((key) => allowed.includes(key));
}
function hasValidAttendanceQuery(method, relativePath, url) {
  if (method === "GET" && relativePath === "/") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const target = Number(url.searchParams.get("target"));
    return hasOnlyQueryParameters(url, ["from", "to", "target"]) && Boolean(from?.match(/^\d{4}-\d{2}-\d{2}$/)) && Boolean(to?.match(/^\d{4}-\d{2}-\d{2}$/)) && Number.isInteger(target) && target >= 50 && target <= 100;
  }
  if (method === "DELETE" && relativePath === "/records") {
    const date = url.searchParams.get("date");
    const lectureKey = url.searchParams.get("lectureKey");
    return hasOnlyQueryParameters(url, ["date", "lectureKey"]) && Boolean(date?.match(/^\d{4}-\d{2}-\d{2}$/)) && Boolean(lectureKey?.match(/^[a-f0-9]{64}$/));
  }
  if (method === "GET" && relativePath === "/leaderboard") {
    const scope = url.searchParams.get("scope");
    const entries = Array.from(url.searchParams.entries());
    return entries.length === 1 && scope !== null && ["subsection", "section", "branch", "all"].includes(scope);
  }
  return url.search === "";
}
function createAttendanceProxyHandler(options = {}) {
  const fetcher = options.fetcher ?? fetch;
  return async (req, res) => {
    const apiBase = options.apiBase ?? getAttendanceApiBase();
    if (!apiBase) {
      res.status(503).json({ message: "Attendance sync is not configured on this deployment yet. Please try again after the administrator finishes setup." });
      return;
    }
    const url = new URL(req.originalUrl, "http://nextlecture.local");
    const relativePath = url.pathname.replace(/^\/api\/attendance/, "") || "/";
    if (!isAllowedAttendanceRoute(req.method, relativePath)) {
      res.status(404).json({ message: "Attendance route not found." });
      return;
    }
    if (!hasValidAttendanceQuery(req.method, relativePath, url)) {
      res.status(400).json({ message: "Attendance request parameters are invalid." });
      return;
    }
    const headers = { Accept: "application/json" };
    if (req.method === "POST") headers["Content-Type"] = "application/json";
    const authorization = req.get("authorization");
    if (authorization?.startsWith("Bearer ")) headers.Authorization = authorization;
    try {
      const upstream = await fetcher(`${apiBase}/api/attendance${relativePath}${url.search}`, {
        method: req.method,
        headers,
        body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : void 0
      });
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      const body = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status).setHeader("Content-Type", contentType).setHeader("Cache-Control", "no-store").send(body);
    } catch {
      res.status(503).json({ message: "Attendance could not be synced. Check your connection and try again." });
    }
  };
}

// server/notifications.ts
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
var ANNOUNCEMENTS_URL = "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/announcements.json";
var RELEASE_URL = "https://api.github.com/repos/lsgzt/nextlecture-android/releases/latest";
function getNotificationDb() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase notification database is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function getFirebaseMessaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const credentials = JSON.parse(raw);
  const app2 = getApps()[0] ?? initializeApp({ credential: cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key.replace(/\\n/g, "\n")
  }) });
  return getMessaging(app2);
}
async function registerFcmToken(input) {
  const token = input.token.trim();
  if (token.length < 50 || token.length > 4096) throw new Error("Invalid FCM token");
  const db = getNotificationDb();
  const { error } = await db.from("fcm_tokens").upsert({
    token,
    platform: input.platform?.trim().slice(0, 32) || "android",
    app_version: input.appVersion?.trim().slice(0, 64) || null,
    active: true,
    last_seen_at: (/* @__PURE__ */ new Date()).toISOString()
  }, { onConflict: "token" });
  if (error) throw new Error(`FCM token registration failed: ${error.message}`);
}
async function getTokens() {
  const db = getNotificationDb();
  const { data, error } = await db.from("fcm_tokens").select("token").eq("active", true).limit(1e4);
  if (error) throw new Error(`FCM token lookup failed: ${error.message}`);
  return (data ?? []).map((row) => row.token);
}
async function wasAlreadySent(key, fingerprint) {
  const db = getNotificationDb();
  const { data, error } = await db.from("notification_state").select("fingerprint").eq("key", key).maybeSingle();
  if (error) throw new Error(`Notification state lookup failed: ${error.message}`);
  if (!data) {
    const inserted = await db.from("notification_state").insert({ key, fingerprint });
    if (inserted.error) throw new Error(`Notification state insert failed: ${inserted.error.message}`);
    return true;
  }
  if (data.fingerprint === fingerprint) return true;
  const updated = await db.from("notification_state").update({ fingerprint, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("key", key);
  if (updated.error) throw new Error(`Notification state update failed: ${updated.error.message}`);
  return false;
}
async function sendEvent(event) {
  const tokens = await getTokens();
  if (!tokens.length) return { sent: false, reason: "no tokens" };
  if (await wasAlreadySent(event.type, hash(event.id))) return { sent: false, reason: "unchanged" };
  const messaging = getFirebaseMessaging();
  const db = getNotificationDb();
  let sent = 0;
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batch = tokens.slice(offset, offset + 500);
    const response = await messaging.sendEach(batch.map((token) => ({
      token,
      notification: { title: event.title, body: event.body },
      data: { type: event.type, id: event.id, title: event.title, body: event.body, ...event.url ? { url: event.url } : {} },
      android: { priority: "high", notification: { channelId: "timetable_updates_v2", clickAction: "OPEN_APP" } }
    })));
    sent += response.successCount;
    for (let index = 0; index < response.responses.length; index += 1) {
      const failure = response.responses[index].error;
      if (failure?.code === "messaging/registration-token-not-registered" || failure?.code === "messaging/invalid-registration-token") {
        await db.from("fcm_tokens").update({ active: false }).eq("token", batch[index]);
      }
    }
  }
  return { sent };
}
async function sendCustomNotification(input) {
  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 2e3);
  if (!title || !body) throw new Error("title and body are required");
  return sendEvent({ id: input.id?.trim() || hash({ title, body }), type: "custom", title, body, url: input.url?.trim().slice(0, 1e3) });
}
async function latestAnnouncement() {
  const response = await fetch(ANNOUNCEMENTS_URL, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15e3) });
  if (!response.ok) throw new Error(`Announcements returned ${response.status}`);
  const feed = await response.json();
  const item = (feed.announcements ?? []).filter((item2) => item2.active !== false && item2.id && item2.title && item2.message).at(-1);
  return item ? { id: item.id, type: "announcement", title: item.title, body: item.message } : null;
}
async function runNotificationCheck() {
  const results = {};
  const [timetable, notices, announcement, release] = await Promise.all([
    getOfficialTimetable(true),
    getNoticeFeed(true),
    latestAnnouncement(),
    fetch(RELEASE_URL, { headers: { Accept: "application/vnd.github+json", "User-Agent": "NextLecture-notifier" }, signal: AbortSignal.timeout(15e3) }).then(async (response) => response.ok ? response.json() : null)
  ]);
  results.timetable = await sendEvent({ id: hash(timetable.cache.data), type: "timetable", title: "Timetable updated", body: "The official GNDEC timetable has changed. Open NextLecture to refresh your schedule." });
  const notice = notices.notices[0];
  if (notice) results.notice = await sendEvent({ id: notice.id, type: "notice", title: "New college notice", body: notice.title, url: notice.url });
  if (announcement) results.announcement = await sendEvent(announcement);
  if (release && release.tag_name && !release.draft && !release.prerelease) results.release = await sendEvent({ id: release.tag_name, type: "app_update", title: release.name || `NextLecture ${release.tag_name}`, body: "A new app update is available. Tap to download it." });
  return results;
}

// server/cacheRefresh.ts
async function runOne(name, fn, pickFetchedAt) {
  try {
    const value = await fn();
    return { ok: true, fetchedAt: pickFetchedAt(value) ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Cache refresh] ${name} failed:`, message);
    return { ok: false, error: message };
  }
}
async function refreshExternalCaches() {
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const results = {};
  results.vacantRooms = await runOne("vacantRooms", () => getVacantRooms(true), (v) => v.fetchedAtMillis);
  results.timetable = await runOne(
    "timetable",
    () => getOfficialTimetable(true),
    (v) => v.cache.fetchedAt
  );
  const [holidays, notices] = await Promise.all([
    runOne("holidays", () => getHolidayFeed(true), (v) => v.fetchedAt),
    runOne("notices", () => getNoticeFeed(true), (v) => v.fetchedAt)
  ]);
  results.holidays = holidays;
  results.notices = notices;
  const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  const ok = Object.values(results).every((r) => r.ok);
  return { ok, startedAt, finishedAt, results };
}

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use("/api/attendance", createAttendanceProxyHandler());
  app2.post("/api/notifications/register", async (req, res) => {
    try {
      await registerFcmToken({
        token: typeof req.body?.token === "string" ? req.body.token : "",
        platform: typeof req.body?.platform === "string" ? req.body.platform : void 0,
        appVersion: typeof req.body?.appVersion === "string" ? req.body.appVersion : void 0
      });
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not register notification token" });
    }
  });
  app2.all("/api/notifications/cron", async (req, res) => {
    const expected = process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    if (expected && supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      res.json(await runNotificationCheck());
    } catch (error) {
      console.error("[Notifications] check failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Notification check failed" });
    }
  });
  app2.all("/api/cache/cron", async (req, res) => {
    const expected = process.env.CACHE_CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    if (expected && supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      const result = await refreshExternalCaches();
      res.status(result.ok ? 200 : 207).json(result);
    } catch (error) {
      console.error("[Cache cron] failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Cache refresh failed" });
    }
  });
  app2.post("/api/notifications/send", async (req, res) => {
    const expected = process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    if (!expected || supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      res.json(await sendCustomNotification(req.body ?? {}));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not send notification" });
    }
  });
  app2.get("/api/syllabus.pdf", async (_req, res) => {
    try {
      const syllabus = await getOfficialSyllabusPdfBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", syllabus.bytes.length);
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.setHeader("X-NextLecture-Syllabus-Fetched-At", String(syllabus.fetchedAt));
      res.send(syllabus.bytes);
    } catch (error) {
      console.error("[Syllabus] Official PDF retrieval failed:", error instanceof Error ? error.message : error);
      res.status(502).json({ message: "The official syllabus PDF is unavailable right now. Please try again shortly." });
    }
  });
  app2.post("/api/syllabus/stream", async (req, res) => {
    if (!getConfiguredGeminiApiKey()) {
      res.status(503).json({ message: "Syllabus AI server fallback is not configured. Add GEMINI_API_KEY in Vercel environment settings or add a device-local Gemini key in AI settings." });
      return;
    }
    try {
      const upstream = await createServerFallbackGeminiResponse(req.body);
      if (!upstream.ok || !upstream.body) {
        res.status(upstream.status || 502).json({ message: "Gemini could not start the Syllabus AI response. Please try again shortly." });
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (value) res.write(Buffer.from(value));
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } catch (error) {
      console.error("[Syllabus] Gemini fallback failed:", error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(502).json({ message: "Syllabus AI could not complete the response. Check GEMINI_API_KEY or add a device-local key in AI settings." });
      else res.end();
    }
  });
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server/vercel.ts
var app = createApp();
var vercel_default = app;
export {
  vercel_default as default
};
