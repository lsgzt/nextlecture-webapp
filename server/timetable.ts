import { and, eq } from "drizzle-orm";
import { load } from "cheerio";
import { timetableCache } from "../drizzle/schema";
import {
  TIMETABLE_CACHE_TTL_MS,
  TIMETABLE_EMERGENCY_SNAPSHOT_URL,
  TIMETABLE_OFFICIAL_INDEX_URL,
  TIMETABLE_SOURCE_FALLBACK_API_URL,
  TIMETABLE_SOURCE_URL,
} from "../shared/config";
import {
  type GroupTimetable,
  type Lecture,
  type TimetableCacheEnvelope,
  type TimetableGroup,
  type TimetablePayload,
  type Weekday,
  WEEKDAYS,
} from "../shared/timetable";
import { getDb } from "./db";

type TimetableFetchResult = {
  cache: TimetableCacheEnvelope;
  freshness: "fresh" | "stale";
  updateError: string | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type TimetableSourceResolution = {
  url: string;
  source: "official-index" | "vercel-fallback" | "last-known-good" | "built-in";
  officialError: string | null;
  fallbackError: string | null;
};

export type TimetableSourceResolverOptions = {
  fetcher?: FetchLike;
  officialIndexUrl?: string;
  fallbackApiUrl?: string;
  lastKnownSourceUrl?: string | null;
};

const CACHE_KEY = "official-gnedc-timetable";
const REQUEST_TIMEOUT_MS = 12_000;
const SOURCE_RESOLUTION_TIMEOUT_MS = 7_000;
const OFFICIAL_TIMETABLE_HOST = "appsc.gndec.ac.in";
const EMERGENCY_SNAPSHOT_NOTICE = "The official GNDEC timetable source is temporarily unavailable. Showing a verified emergency snapshot while it recovers.";

let inMemoryCache: TimetableCacheEnvelope | null = null;
let inFlightRefresh: Promise<TimetableCacheEnvelope> | null = null;

/** Test-only cache control used to verify cache-preserving refresh behavior without a database. */
export function setTimetableCacheForTests(cache: TimetableCacheEnvelope | null) {
  inMemoryCache = cache;
  inFlightRefresh = null;
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isWeekday(value: string): value is Weekday {
  return WEEKDAYS.includes(value as Weekday);
}

function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function cleanGroupCode(value: string) {
  return normalizeText(value).replace(/\s+Automatic Subgroup$/i, "").trim();
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown source-resolution failure.";
}

/** Accept only direct, secure GNDEC timetable HTML documents. */
export function validateOfficialTimetableUrl(candidate: string | null | undefined, baseUrl = TIMETABLE_OFFICIAL_INDEX_URL) {
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

/** Find the first valid official Sub-section wise timetable anchor in document order. */
export function discoverTimetableSourceFromIndexHtml(html: string, indexUrl = TIMETABLE_OFFICIAL_INDEX_URL) {
  const $ = load(html);
  let discovered: string | null = null;
  $("a").each((_, anchor) => {
    if (discovered) return;
    const visibleText = normalizeText($(anchor).text());
    if (!/sub[-\s]?section\s+wise/i.test(visibleText)) return;
    discovered = validateOfficialTimetableUrl($(anchor).attr("href"), indexUrl);
  });
  return discovered;
}

/** Build conditional headers only for the exact source that produced the cached payload. */
export function buildTimetableRequestHeaders(previousCache: TimetableCacheEnvelope | null, sourceUrl: string) {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "NextLecture/1.0 (GNDEC timetable companion)",
  };
  if (previousCache?.sourceUrl !== sourceUrl) return headers;
  if (previousCache.validators?.etag) headers["If-None-Match"] = previousCache.validators.etag;
  if (previousCache.validators?.lastModified) headers["If-Modified-Since"] = previousCache.validators.lastModified;
  return headers;
}

/**
 * Resolve sources in strict order. A valid official result stops the fallback path.
 * The public Vercel endpoint is intentionally never queried while official discovery works.
 */
export async function resolveTimetableSource(options: TimetableSourceResolverOptions = {}): Promise<TimetableSourceResolution> {
  const fetcher = options.fetcher ?? fetch;
  const officialIndexUrl = options.officialIndexUrl ?? TIMETABLE_OFFICIAL_INDEX_URL;
  const fallbackApiUrl = options.fallbackApiUrl ?? TIMETABLE_SOURCE_FALLBACK_API_URL;
  let officialError: string | null = null;
  let fallbackError: string | null = null;

  try {
    const response = await fetcher(officialIndexUrl, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NextLecture/1.0 (official source discovery)" },
      redirect: "error",
      signal: AbortSignal.timeout(SOURCE_RESOLUTION_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(SOURCE_RESOLUTION_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The timetable fallback responded with ${response.status}.`);
    const payload = JSON.parse(await response.text()) as { url?: unknown };
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

function getSourceYears(html: string) {
  const $ = load(html);
  const sourceYears = new Map<string, string>();

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

function parseLectureCell(
  $: ReturnType<typeof load>,
  cell: ReturnType<ReturnType<typeof load>>,
  day: Weekday,
  startTime: string,
  durationSlots: number,
): Lecture | null {
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
    confidence: rawSubject ? "structured" : "partial",
  };
}

/** Extract semantic official tables without OCR. */
export function parseTimetableHtml(html: string): TimetablePayload {
  const $ = load(html);
  const sourceYears = getSourceYears(html);
  const timetables: GroupTimetable[] = [];
  const seenGroups = new Set<string>();
  let sourceGeneratedAt: string | null = null;

  $("table[id^='table_']").each((_, tableNode) => {
    const table = $(tableNode);
    const tableId = table.attr("id");
    const captionGroup = cleanGroupCode(table.find("caption .name").first().text());
    const dayHeaders = table.find("thead th.xAxis").map((__, header) => normalizeText($(header).text())).get().filter(isWeekday);
    if (!tableId || !captionGroup || dayHeaders.length !== WEEKDAYS.length || seenGroups.has(captionGroup)) return;

    const spanRemaining = Array.from({ length: WEEKDAYS.length }, () => 0);
    const lectures: Lecture[] = [];
    const timeSlots = new Set<string>();
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
      lectures: lectures.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime)),
    });
    seenGroups.add(captionGroup);
  });

  if (!timetables.length) throw new Error("The official timetable did not contain any valid group tables.");
  if (!timetables.some(item => item.lectures.length > 0)) throw new Error("The official timetable did not contain enough valid lecture data.");
  return { groups: timetables.map(item => item.group).sort((a, b) => a.code.localeCompare(b.code)), timetables, sourceGeneratedAt };
}

function isValidEnvelope(value: unknown): value is TimetableCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<TimetableCacheEnvelope>;
  return Boolean(envelope.data && Array.isArray(envelope.data.groups) && Array.isArray(envelope.data.timetables) && typeof envelope.fetchedAt === "number" && typeof envelope.sourceUrl === "string" && envelope.data.timetables.length > 0);
}

async function readPersistentCache() {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ payload: timetableCache.payload, sourceUrl: timetableCache.sourceUrl }).from(timetableCache).where(eq(timetableCache.id, CACHE_KEY)).limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    if (!isValidEnvelope(parsed)) return null;
    return { ...parsed, sourceUrl: parsed.sourceUrl || rows[0]?.sourceUrl };
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be read:", error);
    return null;
  }
}

async function persistCache(cache: TimetableCacheEnvelope) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timetableCache).values({ id: CACHE_KEY, sourceUrl: cache.sourceUrl, payload: JSON.stringify(cache), fetchedAt: new Date(cache.fetchedAt) }).onDuplicateKeyUpdate({
      set: { sourceUrl: cache.sourceUrl, payload: JSON.stringify(cache), fetchedAt: new Date(cache.fetchedAt) },
    });
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be saved:", error);
  }
}

function assertTimetableIntegrity(data: TimetablePayload, requiredGroup?: string) {
  if (!data.timetables.length || !data.timetables.some(item => item.lectures.length > 0)) throw new Error("The resolved source did not contain a usable timetable.");
  if (requiredGroup && !findGroupTimetable(data, requiredGroup)) {
    throw new Error(`The resolved source does not contain the saved subsection ${cleanGroupCode(requiredGroup).toUpperCase()}.`);
  }
}

async function fetchAndParseOfficialTimetable(sourceUrl: string, previousCache: TimetableCacheEnvelope | null, requiredGroup?: string) {
  const response = await fetch(sourceUrl, {
    headers: buildTimetableRequestHeaders(previousCache, sourceUrl),
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 304) {
    if (!previousCache || previousCache.sourceUrl !== sourceUrl) throw new Error("The official timetable returned an unusable not-modified response.");
    return { ...previousCache, fetchedAt: Date.now(), validators: { etag: response.headers.get("etag") ?? previousCache.validators?.etag ?? null, lastModified: response.headers.get("last-modified") ?? previousCache.validators?.lastModified ?? null } } satisfies TimetableCacheEnvelope;
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
    validators: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") },
  } satisfies TimetableCacheEnvelope;
}

/**
 * Parse the verified official R4 snapshot with the same strict parser used for
 * live sources. This is selected only after live retrieval fails on a cold
 * instance, then every later refresh resumes official-first discovery.
 */
export async function fetchEmergencyTimetableSnapshot(requiredGroup?: string, fetcher: FetchLike = fetch) {
  const response = await fetcher(TIMETABLE_EMERGENCY_SNAPSHOT_URL, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    validators: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") },
  } satisfies TimetableCacheEnvelope;
}

async function refreshCache(previousCache: TimetableCacheEnvelope | null, forceDataRefresh: boolean, requiredGroup?: string) {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const resolution = await resolveTimetableSource({ lastKnownSourceUrl: previousCache?.sourceUrl ?? null });
      const sourceChanged = previousCache?.sourceUrl !== resolution.url;
      const cacheIsFresh = Boolean(previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS);
      if (previousCache && !forceDataRefresh && !sourceChanged && cacheIsFresh) return previousCache;
      let cache: TimetableCacheEnvelope;
      try {
        cache = await fetchAndParseOfficialTimetable(resolution.url, sourceChanged ? null : previousCache, requiredGroup);
      } catch (sourceError) {
        console.warn("[Timetable] Live source unavailable; attempting verified emergency snapshot:", asErrorMessage(sourceError));
        cache = await fetchEmergencyTimetableSnapshot(requiredGroup);
      }
      inMemoryCache = cache;
      await persistCache(cache);
      return cache;
    })().finally(() => { inFlightRefresh = null; });
  }
  return inFlightRefresh;
}

async function getKnownCache() {
  if (inMemoryCache) return inMemoryCache;
  inMemoryCache = await readPersistentCache();
  return inMemoryCache;
}

/**
 * Return a valid cached timetable immediately when possible and resolve the current
 * official source in the background. Forced refreshes always wait for full resolution.
 */
export async function getOfficialTimetable(forceRefresh = false, requiredGroup?: string): Promise<TimetableFetchResult> {
  const previousCache = await getKnownCache();
  const cacheIsFresh = Boolean(previousCache && Date.now() - previousCache.fetchedAt < TIMETABLE_CACHE_TTL_MS);
  if (!forceRefresh && previousCache && cacheIsFresh) {
    void refreshCache(previousCache, false, requiredGroup).catch(error => console.warn("[Timetable] Background source refresh failed:", error));
    const emergency = previousCache.sourceUrl === TIMETABLE_EMERGENCY_SNAPSHOT_URL;
    return { cache: previousCache, freshness: emergency ? "stale" : "fresh", updateError: emergency ? EMERGENCY_SNAPSHOT_NOTICE : null };
  }
  try {
    const cache = await refreshCache(previousCache, forceRefresh, requiredGroup);
    const emergency = cache.sourceUrl === TIMETABLE_EMERGENCY_SNAPSHOT_URL;
    return { cache, freshness: emergency ? "stale" : "fresh", updateError: emergency ? EMERGENCY_SNAPSHOT_NOTICE : null };
  } catch (error) {
    const message = asErrorMessage(error);
    if (previousCache) return { cache: previousCache, freshness: "stale", updateError: message };
    throw new Error(`Could not update the official timetable: ${message}`);
  }
}

export function findGroupTimetable(data: TimetablePayload, requestedGroup: string) {
  const normalized = cleanGroupCode(requestedGroup).toUpperCase();
  return data.timetables.find(item => item.group.code.toUpperCase() === normalized) ?? null;
}
