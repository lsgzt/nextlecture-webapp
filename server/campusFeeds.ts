/**
 * Official holidays + college notices — same upstream feeds as the Android app.
 * Durable MySQL cache (timetable_cache rows) keeps serving when upstream feeds are down.
 */

import { eq } from "drizzle-orm";
import {
  HOLIDAY_API_BASE_URL,
  NOTICES_API_BASE_URL,
} from "../shared/config";
import type {
  CampusHoliday,
  CampusNotice,
  HolidayFeed,
  NoticeFeed,
} from "../shared/campus";
import { externalSourceCache } from "../drizzle/schema";
import { getDb } from "./db";

const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const USER_AGENT = "NextLecture/1.0 (GNDEC campus feeds)";
const HOLIDAY_CACHE_KEY = "campus-holidays-v1";
const NOTICE_CACHE_KEY = "campus-notices-v1";

type CacheEntry<T> = {
  data: T;
  fetchedAtMillis: number;
};

let holidayCache: CacheEntry<HolidayFeed> | null = null;
let noticeCache: CacheEntry<NoticeFeed> | null = null;
let holidayInFlight: Promise<HolidayFeed> | null = null;
let noticeInFlight: Promise<NoticeFeed> | null = null;

function isHolidayFeed(value: unknown): value is HolidayFeed {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<HolidayFeed>;
  return Array.isArray(row.holidays) && row.holidays.length > 0;
}

function isNoticeFeed(value: unknown): value is NoticeFeed {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<NoticeFeed>;
  return Array.isArray(row.notices) && row.notices.length > 0;
}

async function readPersistentFeed<T>(
  key: string,
  validate: (value: unknown) => value is T,
): Promise<CacheEntry<T> | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ payload: externalSourceCache.payload, fetchedAt: externalSourceCache.fetchedAt })
      .from(externalSourceCache)
      .where(eq(externalSourceCache.id, key))
      .limit(1);
    if (!rows[0]?.payload) return null;
    const parsed = JSON.parse(rows[0].payload) as unknown;
    if (!validate(parsed)) return null;
    const fetchedAtMillis =
      rows[0].fetchedAt instanceof Date ? rows[0].fetchedAt.getTime() : Date.parse(String(rows[0].fetchedAt));
    return {
      data: parsed,
      fetchedAtMillis: Number.isFinite(fetchedAtMillis) ? fetchedAtMillis : Date.now(),
    };
  } catch (error) {
    console.warn(`[Campus feeds] Persistent cache could not be read (${key}):`, error);
    return null;
  }
}

async function persistFeed(key: string, sourceUrl: string, data: unknown, fetchedAtMillis: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(externalSourceCache)
      .values({
        id: key,
        sourceUrl,
        payload: JSON.stringify(data),
        fetchedAt: new Date(fetchedAtMillis),
      })
      .onDuplicateKeyUpdate({
        set: {
          sourceUrl,
          payload: JSON.stringify(data),
          fetchedAt: new Date(fetchedAtMillis),
        },
      });
  } catch (error) {
    console.warn(`[Campus feeds] Persistent cache could not be saved (${key}):`, error);
  }
}

async function getKnownHolidayCache(): Promise<CacheEntry<HolidayFeed> | null> {
  if (holidayCache) return holidayCache;
  const persistent = await readPersistentFeed(HOLIDAY_CACHE_KEY, isHolidayFeed);
  if (persistent) holidayCache = persistent;
  return persistent;
}

async function getKnownNoticeCache(): Promise<CacheEntry<NoticeFeed> | null> {
  if (noticeCache) return noticeCache;
  const persistent = await readPersistentFeed(NOTICE_CACHE_KEY, isNoticeFeed);
  if (persistent) noticeCache = persistent;
  return persistent;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asYear(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function normalizeHoliday(raw: unknown): CampusHoliday | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
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
    source: asString(row.source),
  };
}

function normalizeNotice(raw: unknown): CampusNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
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
    bannerUntilDate: asString(row.bannerUntilDate),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Upstream responded with ${response.status}`);
  return response.json();
}

async function loadHolidays(forceRefresh: boolean): Promise<HolidayFeed> {
  const known = await getKnownHolidayCache();
  if (!forceRefresh && known && Date.now() - known.fetchedAtMillis < CACHE_TTL_MS) {
    return { ...known.data, servedFromCache: true, stale: false, refreshError: null };
  }
  if (holidayInFlight && !forceRefresh) return holidayInFlight;

  holidayInFlight = (async () => {
    const bases = [HOLIDAY_API_BASE_URL, NOTICES_API_BASE_URL];
    let lastError: string | null = null;
    for (const base of bases) {
      try {
        const url = `${base.replace(/\/$/, "")}/api/holidays${forceRefresh ? "?refresh=true" : ""}`;
        const payload = (await fetchJson(url)) as Record<string, unknown>;
        const holidays = (Array.isArray(payload.holidays) ? payload.holidays : [])
          .map(normalizeHoliday)
          .filter((item): item is CampusHoliday => Boolean(item))
          .sort((a, b) => a.date.localeCompare(b.date));
        if (!holidays.length) throw new Error("No holidays found in the official list");
        const now = Date.now();
        const feed: HolidayFeed = {
          holidays,
          fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date(now).toISOString(),
          servedFromCache: false,
          stale: false,
          refreshError: null,
        };
        holidayCache = { data: feed, fetchedAtMillis: now };
        await persistFeed(HOLIDAY_CACHE_KEY, url, feed, now);
        return feed;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Could not load holidays";
      }
    }
    const fallback = holidayCache ?? (await getKnownHolidayCache());
    if (fallback) {
      return {
        ...fallback.data,
        servedFromCache: true,
        stale: true,
        refreshError: lastError,
      };
    }
    throw new Error(lastError || "Could not load official holidays");
  })().finally(() => {
    holidayInFlight = null;
  });

  return holidayInFlight;
}

async function loadNotices(forceRefresh: boolean): Promise<NoticeFeed> {
  const known = await getKnownNoticeCache();
  if (!forceRefresh && known && Date.now() - known.fetchedAtMillis < CACHE_TTL_MS) {
    return { ...known.data, servedFromCache: true, stale: false, refreshError: null };
  }
  if (noticeInFlight && !forceRefresh) return noticeInFlight;

  noticeInFlight = (async () => {
    try {
      const url = `${NOTICES_API_BASE_URL.replace(/\/$/, "")}/api/notices${forceRefresh ? "?refresh=true" : ""}`;
      const payload = (await fetchJson(url)) as Record<string, unknown>;
      const notices = (Array.isArray(payload.notices) ? payload.notices : [])
        .map(normalizeNotice)
        .filter((item): item is CampusNotice => Boolean(item))
        .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate) || b.firstSeenAt.localeCompare(a.firstSeenAt));
      if (!notices.length) throw new Error("No notices found in the ERP response");
      const now = Date.now();
      const feed: NoticeFeed = {
        notices,
        fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date(now).toISOString(),
        servedFromCache: false,
        stale: false,
        refreshError: null,
      };
      noticeCache = { data: feed, fetchedAtMillis: now };
      await persistFeed(NOTICE_CACHE_KEY, url, feed, now);
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load notices";
      const fallback = noticeCache ?? (await getKnownNoticeCache());
      if (fallback) {
        return {
          ...fallback.data,
          servedFromCache: true,
          stale: true,
          refreshError: message,
        };
      }
      throw new Error(message);
    }
  })().finally(() => {
    noticeInFlight = null;
  });

  return noticeInFlight;
}

export async function getHolidayFeed(forceRefresh = false) {
  return loadHolidays(forceRefresh);
}

export async function getNoticeFeed(forceRefresh = false) {
  return loadNotices(forceRefresh);
}
