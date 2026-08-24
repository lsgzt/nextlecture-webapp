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

// shared/config.ts
var TIMETABLE_OFFICIAL_INDEX_URL = "https://appsc.gndec.ac.in/time_tables";
var TIMETABLE_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-08/23_08_2026%20FINAL_FILE%20R4_subgroups_days_horizontal.html";
var TIMETABLE_SOURCE_FALLBACK_API_URL = "https://gndec-pyq-rag-api.vercel.app/api/timetable-source";
var TEMPORARY_SECTION_SOURCE_PAGE_URL = "https://appsc.gndec.ac.in/time_tables";
var SYLLABUS_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-03/ss%20and%20Syllabus%20sem1%2C2%20Dec%202025%20unsigned.pdf";
var TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1e3;
var TEMPORARY_SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var SYLLABUS_CACHE_TTL_MS = 24 * 60 * 60 * 1e3;

// shared/timetable.ts
var WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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
var CACHE_KEY = "official-gnedc-timetable";
var REQUEST_TIMEOUT_MS = 12e3;
var SOURCE_RESOLUTION_TIMEOUT_MS = 7e3;
var OFFICIAL_TIMETABLE_HOST = "appsc.gndec.ac.in";
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
function discoverTimetableSourceFromIndexHtml(html, indexUrl = TIMETABLE_OFFICIAL_INDEX_URL) {
  const $ = load(html);
  let discovered = null;
  $("a").each((_, anchor) => {
    if (discovered) return;
    const visibleText = normalizeText($(anchor).text());
    if (!/sub[-\s]?section\s+wise/i.test(visibleText)) return;
    discovered = validateOfficialTimetableUrl($(anchor).attr("href"), indexUrl);
  });
  return discovered;
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
      redirect: "error",
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
    return { url: discovered, source: "vercel-fallback", officialError, fallbackError: null };
  } catch (error) {
    fallbackError = asErrorMessage(error);
  }
  const lastKnown = validateOfficialTimetableUrl(options.lastKnownSourceUrl, officialIndexUrl);
  if (lastKnown) return { url: lastKnown, source: "last-known-good", officialError, fallbackError };
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
function parseLectureCell($, cell, day, startTime, durationSlots) {
  const raw = normalizeText(cell.text());
  if (!raw || raw === "---" || cell.hasClass("empty")) return null;
  const rawSubject = normalizeText(cell.find(".subject").first().text());
  const rawLine = normalizeText(cell.find(".line1").first().text());
  const lectureType = normalizeText(cell.find(".activitytag").first().text()).toUpperCase() || null;
  const subject = rawSubject || rawLine.replace(/\s+[LPT]$/i, "").trim() || raw;
  const teacher = normalizeText(cell.find(".teacher").first().text()) || null;
  const venue = normalizeText(cell.find(".room").first().text()) || null;
  const startMinutes = parseTimeToMinutes(startTime);
  const endTime = startMinutes === null ? startTime : minutesToTime(startMinutes + durationSlots * 60);
  return {
    day,
    startTime,
    endTime,
    subject,
    teacher,
    venue,
    lectureType: lectureType && /^[LPT]$/.test(lectureType) ? lectureType : null,
    raw,
    confidence: rawSubject ? "structured" : "partial"
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
  if (!db) return;
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
async function refreshCache(previousCache, forceDataRefresh, requiredGroup) {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const resolution = await resolveTimetableSource({ lastKnownSourceUrl: previousCache?.sourceUrl ?? null });
      const sourceChanged = previousCache?.sourceUrl !== resolution.url;
      const cacheIsFresh = Boolean(previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS);
      if (previousCache && !forceDataRefresh && !sourceChanged && cacheIsFresh) return previousCache;
      const cache3 = await fetchAndParseOfficialTimetable(resolution.url, sourceChanged ? null : previousCache, requiredGroup);
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
  const cacheIsFresh = Boolean(previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS);
  if (!forceRefresh && previousCache && cacheIsFresh) {
    void refreshCache(previousCache, false, requiredGroup).catch((error) => console.warn("[Timetable] Background source refresh failed:", error));
    return { cache: previousCache, freshness: "fresh", updateError: null };
  }
  try {
    const cache3 = await refreshCache(previousCache, forceRefresh, requiredGroup);
    return { cache: cache3, freshness: "fresh", updateError: null };
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
var CACHE_PREFIX = "official-gnedc-permanent-section-2026-v1";
var PDF_RANGE_CHUNK_BYTES = 128 * 1024;
var PDF_RANGE_CONCURRENCY = 8;
var PDF_RANGE_TIMEOUT_MS = 25e3;
var PDF_RANGE_RETRIES = 2;
var MAX_OFFICIAL_PDF_BYTES = 4 * 1024 * 1024;
var inMemoryCache2 = /* @__PURE__ */ new Map();
var inFlightRefresh2 = /* @__PURE__ */ new Map();
var PERMANENT_SECTION_COLUMN_STARTS = [0, 45, 82, 185, 295, 395, 435, 475, 525, 565, 675, 720];
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
function parseTemporarySectionText(text2, expectedBranch, sourceUrl) {
  const students = [];
  for (const rawLine of text2.split(/\r?\n/)) {
    const columns = rawLine.split("	").map(normalizeText2);
    if (columns.length < 12) continue;
    const [, crn, studentName, fatherName, motherName, branch, section, subsection, mentoringGroup, mentorName, mentorMobileNumber, venue] = columns;
    if (!/^\d{6,16}$/.test(crn) || !studentName || !branch || !section || !subsection) continue;
    const recordBranch = branch.toUpperCase();
    if (recordBranch !== expectedBranch) continue;
    students.push({
      studentName,
      crn,
      fatherName: fatherName || null,
      motherName: motherName || null,
      branch: recordBranch,
      section: section.toUpperCase(),
      subsection: subsection.toUpperCase(),
      mentoringGroup: mentoringGroup || null,
      mentorName: mentorName || null,
      mentorMobileNumber: mentorMobileNumber || null,
      venue: venue || null,
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
  const previousCache = await getKnownCache2(branch);
  const fresh = previousCache && Date.now() - previousCache.fetchedAt < TEMPORARY_SECTION_CACHE_TTL_MS;
  if (!forceRefresh && fresh) return { cache: previousCache, freshness: "fresh", updateError: null };
  try {
    return { cache: await refreshCache2(branch), freshness: "fresh", updateError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official temporary-section update failed.";
    console.warn(`[Temporary sections] Official source refresh failed: ${message}`);
    if (previousCache) return { cache: previousCache, freshness: "stale", updateError: message };
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
  const load3 = async () => {
    const bytes = await fetchOfficialSyllabusBytes();
    if (!bytes.length || bytes.length > MAX_SYLLABUS_BYTES || !bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      throw new Error("The official syllabus source did not return a valid PDF document.");
    }
    cache = { bytes, fetchedAt: Date.now() };
    return cache;
  };
  inFlight = load3().finally(() => {
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

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
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
