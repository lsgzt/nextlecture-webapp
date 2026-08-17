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
import { and, eq as eq2 } from "drizzle-orm";
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
var TIMETABLE_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-08/09_08_2026%20FINAL_FILE_subgroups_days_horizontal.html";
var TEMPORARY_SECTION_SOURCE_PAGE_URL = "https://appsc.gndec.ac.in/time_tables";
var TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1e3;
var TEMPORARY_SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;

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
    if (!tableId || !captionGroup || dayHeaders.length !== WEEKDAYS.length || seenGroups.has(captionGroup)) {
      return;
    }
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
    const group = {
      code: captionGroup,
      sourceYear: sourceYears.get(tableId) ?? "Official GNDEC timetable"
    };
    timetables.push({
      group,
      timeSlots: Array.from(timeSlots).sort((a, b) => a.localeCompare(b)),
      lectures: lectures.sort((a, b) => {
        const dayDifference = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
        return dayDifference || a.startTime.localeCompare(b.startTime);
      })
    });
    seenGroups.add(captionGroup);
  });
  if (timetables.length === 0) {
    throw new Error("The official timetable did not contain any valid group tables.");
  }
  return {
    groups: timetables.map((item) => item.group).sort((a, b) => a.code.localeCompare(b.code)),
    timetables,
    sourceGeneratedAt
  };
}
function isValidEnvelope(value) {
  if (!value || typeof value !== "object") return false;
  const envelope = value;
  return Boolean(
    envelope.data && Array.isArray(envelope.data.groups) && Array.isArray(envelope.data.timetables) && typeof envelope.fetchedAt === "number" && envelope.data.timetables.length > 0 && envelope.data.timetables.every((item) => Array.isArray(item.timeSlots))
  );
}
async function readPersistentCache() {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: timetableCache.payload }).from(timetableCache).where(and(eq2(timetableCache.id, CACHE_KEY), eq2(timetableCache.sourceUrl, TIMETABLE_SOURCE_URL))).limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidEnvelope(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be read:", error);
    return null;
  }
}
async function persistCache(cache) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timetableCache).values({
      id: CACHE_KEY,
      sourceUrl: TIMETABLE_SOURCE_URL,
      payload: JSON.stringify(cache),
      fetchedAt: new Date(cache.fetchedAt)
    }).onDuplicateKeyUpdate({
      set: {
        payload: JSON.stringify(cache),
        fetchedAt: new Date(cache.fetchedAt)
      }
    });
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be saved:", error);
  }
}
async function fetchAndParseOfficialTimetable() {
  const response = await fetch(TIMETABLE_SOURCE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "NextLecture/1.0 (GNDEC timetable companion)"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`The official timetable responded with ${response.status}.`);
  const html = await response.text();
  const data = parseTimetableHtml(html);
  return {
    data,
    fetchedAt: Date.now(),
    sourceUrl: TIMETABLE_SOURCE_URL
  };
}
async function refreshCache() {
  if (!inFlightRefresh) {
    inFlightRefresh = fetchAndParseOfficialTimetable().then(async (cache) => {
      inMemoryCache = cache;
      await persistCache(cache);
      return cache;
    }).finally(() => {
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
async function getOfficialTimetable(forceRefresh = false) {
  const previousCache = await getKnownCache();
  const cacheIsFresh = previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS;
  if (!forceRefresh && cacheIsFresh) {
    return { cache: previousCache, freshness: "fresh", updateError: null };
  }
  try {
    const cache = await refreshCache();
    return { cache, freshness: "fresh", updateError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The timetable update failed.";
    if (previousCache) {
      return { cache: previousCache, freshness: "stale", updateError: message };
    }
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
import { Agent } from "node:https";

// shared/student-profile.ts
var TEMPORARY_SECTION_BRANCHES = ["CE", "CS", "EC", "EE", "IT", "ME", "RAI"];

// server/temporarySections.ts
var REQUEST_TIMEOUT_MS2 = 25e3;
var CACHE_PREFIX = "official-gnedc-temporary-section-2026";
var PDF_RANGE_CHUNK_BYTES = 4 * 1024;
var PDF_RANGE_CONCURRENCY = 8;
var PDF_RANGE_TIMEOUT_MS = 25e3;
var PDF_RANGE_RETRIES = 2;
var MAX_OFFICIAL_PDF_BYTES = 4 * 1024 * 1024;
var OFFICIAL_HTTPS_AGENT = new Agent({ keepAlive: false, maxSockets: PDF_RANGE_CONCURRENCY });
var inMemoryCache2 = /* @__PURE__ */ new Map();
var inFlightRefresh2 = /* @__PURE__ */ new Map();
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
  const cache = value;
  return Boolean(
    cache.data && isBranch(cache.data.branch ?? "") && Array.isArray(cache.data.students) && typeof cache.fetchedAt === "number" && typeof cache.sourceUrl === "string"
  );
}
function parseTemporarySectionText(text2, expectedBranch, sourceUrl) {
  const normalized = normalizeText2(text2);
  const students = [];
  const rowPattern = /(\d{1,4})\s+([A-Z][A-Z .'-]*?)\s+(\d{8})\s+([A-Z]{2,5})\s+([A-Z]{2,5}\d?)\s+([A-Z]{2,5}\d+)\s+((?:DR\.|ER\.)\s+[A-Z][A-Z .'-]*?)(?=\s+\d{1,4}\s+[A-Z]|\s+SR\.\s+NO\.|\s+\*\*|$)/gi;
  for (const match of Array.from(normalized.matchAll(rowPattern))) {
    const [, serial, name, registration, branch, temporarySection, temporarySubsection, mentor] = match;
    const recordBranch = normalizeText2(branch).toUpperCase();
    if (recordBranch !== expectedBranch) continue;
    students.push({
      candidateName: normalizeText2(name),
      registrationNumber: registration,
      rollNumber: serial,
      branch: recordBranch,
      temporarySection: normalizeText2(temporarySection).toUpperCase(),
      temporarySubsection: normalizeText2(temporarySubsection).toUpperCase(),
      mentorName: normalizeText2(mentor) || null,
      source: "official",
      sourceUrl,
      savedAt: Date.now()
    });
  }
  if (!students.length) {
    throw new Error(`The official ${expectedBranch} temporary-section document did not contain readable student rows.`);
  }
  const seen = /* @__PURE__ */ new Set();
  return students.filter((student) => {
    const key = student.registrationNumber;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => Number(left.rollNumber) - Number(right.rollNumber));
}
function findBranchDocumentUrl(html, branch) {
  const $ = load2(html);
  const target = `${branch} BRANCH`;
  const href = $("a").toArray().map((node) => {
    const href2 = $(node).attr("href");
    return { href: href2, decodedHref: href2 ? decodeURIComponent(href2) : "", label: normalizeText2($(node).text()).toUpperCase() };
  }).find((link) => link.href && /\.pdf(?:$|\?)/i.test(link.href) && link.label.includes(target) && /TEMPORARY\s+SECTION/i.test(link.decodedHref))?.href;
  if (!href) throw new Error(`The official website does not currently list a ${branch} temporary-section PDF.`);
  return new URL(href, TEMPORARY_SECTION_SOURCE_PAGE_URL).toString();
}
async function discoverBranchDocument(branch) {
  const response = await fetch(TEMPORARY_SECTION_SOURCE_PAGE_URL, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NextLecture/1.0 (GNDEC profile companion)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS2)
  });
  if (!response.ok) throw new Error(`The official temporary-section page responded with ${response.status}.`);
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
          Connection: "close",
          "User-Agent": "NextLecture/1.0 (GNDEC profile companion)"
        },
        responseType: "arraybuffer",
        timeout: PDF_RANGE_TIMEOUT_MS,
        httpsAgent: OFFICIAL_HTTPS_AGENT,
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
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: await fetchOfficialPdfBytes(sourceUrl) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
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
async function persistCache2(cache) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timetableCache).values({
      id: cacheKey(cache.data.branch),
      sourceUrl: cache.sourceUrl,
      payload: JSON.stringify(cache),
      fetchedAt: new Date(cache.fetchedAt)
    }).onDuplicateKeyUpdate({
      set: { sourceUrl: cache.sourceUrl, payload: JSON.stringify(cache), fetchedAt: new Date(cache.fetchedAt) }
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
    const cache = {
      data: { branch, students },
      fetchedAt: Date.now(),
      sourceUrl
    };
    inMemoryCache2.set(branch, cache);
    await persistCache2(cache);
    return cache;
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
  const matches = result.cache.data.students.filter((student) => normalizeSearch(student.candidateName).includes(needle)).slice(0, 20).map(({ candidateName, registrationNumber, rollNumber, branch: studentBranch, temporarySection, temporarySubsection }) => ({
    candidateName,
    registrationNumber,
    rollNumber,
    branch: studentBranch,
    temporarySection,
    temporarySubsection
  }));
  return { matches, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}
async function getTemporarySectionStudent(branch, registrationNumber) {
  const result = await getOfficialTemporarySections(branch);
  const student = result.cache.data.students.find((item) => item.registrationNumber === registrationNumber) ?? null;
  return { student, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}

// server/routers.ts
async function loadGroup(group, forceRefresh = false) {
  try {
    const result = await getOfficialTimetable(forceRefresh);
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
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't prepare the official temporary-section list. You can enter your profile manually instead.",
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
    profile: publicProcedure.input(z2.object({ branch: z2.string().trim().toUpperCase().min(2).max(5), registrationNumber: z2.string().trim().regex(/^\d{6,16}$/) })).query(async ({ input }) => {
      try {
        return await getTemporarySectionStudent(input.branch, input.registrationNumber);
      } catch (error) {
        throw new TRPCError3({
          code: "BAD_GATEWAY",
          message: "We couldn't finish the official profile lookup. You can enter your profile manually instead.",
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
import axios2 from "axios";
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
var createOAuthHttpClient = () => axios2.create({
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

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
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
