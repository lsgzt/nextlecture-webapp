import { and, eq } from "drizzle-orm";
import { load } from "cheerio";
import { timetableCache } from "../drizzle/schema";
import {
  TIMETABLE_CACHE_TTL_MS,
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

const CACHE_KEY = "official-gnedc-timetable";
const REQUEST_TIMEOUT_MS = 12_000;

let inMemoryCache: TimetableCacheEnvelope | null = null;
let inFlightRefresh: Promise<TimetableCacheEnvelope> | null = null;

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

/**
 * Extracts the official tables without OCR. The source markup has semantic
 * subject, teacher, room, day, and time elements, so these deterministic fields
 * take precedence over any fallback text extraction.
 */
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
    const dayHeaders = table
      .find("thead th.xAxis")
      .map((__, header) => normalizeText($(header).text()))
      .get()
      .filter(isWeekday);

    if (!tableId || !captionGroup || dayHeaders.length !== WEEKDAYS.length || seenGroups.has(captionGroup)) {
      return;
    }

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

    const group: TimetableGroup = {
      code: captionGroup,
      sourceYear: sourceYears.get(tableId) ?? "Official GNDEC timetable",
    };
    timetables.push({
      group,
      timeSlots: Array.from(timeSlots).sort((a, b) => a.localeCompare(b)),
      lectures: lectures.sort((a, b) => {
        const dayDifference = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
        return dayDifference || a.startTime.localeCompare(b.startTime);
      }),
    });
    seenGroups.add(captionGroup);
  });

  if (timetables.length === 0) {
    throw new Error("The official timetable did not contain any valid group tables.");
  }

  return {
    groups: timetables.map(item => item.group).sort((a, b) => a.code.localeCompare(b.code)),
    timetables,
    sourceGeneratedAt,
  };
}

function isValidEnvelope(value: unknown): value is TimetableCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<TimetableCacheEnvelope>;
  return Boolean(
    envelope.data &&
      Array.isArray(envelope.data.groups) &&
      Array.isArray(envelope.data.timetables) &&
      typeof envelope.fetchedAt === "number" &&
      envelope.data.timetables.length > 0 &&
      envelope.data.timetables.every(item => Array.isArray(item.timeSlots)),
  );
}

async function readPersistentCache() {
  const db = await getDb();
  if (!db) return null;

  try {
    const rows = await db
      .select({ payload: timetableCache.payload })
      .from(timetableCache)
      .where(and(eq(timetableCache.id, CACHE_KEY), eq(timetableCache.sourceUrl, TIMETABLE_SOURCE_URL)))
      .limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidEnvelope(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be read:", error);
    return null;
  }
}

async function persistCache(cache: TimetableCacheEnvelope) {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .insert(timetableCache)
      .values({
        id: CACHE_KEY,
        sourceUrl: TIMETABLE_SOURCE_URL,
        payload: JSON.stringify(cache),
        fetchedAt: new Date(cache.fetchedAt),
      })
      .onDuplicateKeyUpdate({
        set: {
          payload: JSON.stringify(cache),
          fetchedAt: new Date(cache.fetchedAt),
        },
      });
  } catch (error) {
    console.warn("[Timetable] Persistent cache could not be saved:", error);
  }
}

async function fetchAndParseOfficialTimetable() {
  const response = await fetch(TIMETABLE_SOURCE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "NextLecture/1.0 (GNDEC timetable companion)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The official timetable responded with ${response.status}.`);

  const html = await response.text();
  const data = parseTimetableHtml(html);
  return {
    data,
    fetchedAt: Date.now(),
    sourceUrl: TIMETABLE_SOURCE_URL,
  } satisfies TimetableCacheEnvelope;
}

async function refreshCache() {
  if (!inFlightRefresh) {
    inFlightRefresh = fetchAndParseOfficialTimetable()
      .then(async cache => {
        inMemoryCache = cache;
        await persistCache(cache);
        return cache;
      })
      .finally(() => {
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

export async function getOfficialTimetable(forceRefresh = false): Promise<TimetableFetchResult> {
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

export function findGroupTimetable(data: TimetablePayload, requestedGroup: string) {
  const normalized = cleanGroupCode(requestedGroup).toUpperCase();
  return data.timetables.find(item => item.group.code.toUpperCase() === normalized) ?? null;
}
