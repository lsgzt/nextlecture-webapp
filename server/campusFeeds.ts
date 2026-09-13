/**
 * Official holidays + college notices — same upstream feeds as the Android app.
 */

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

const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const USER_AGENT = "NextLecture/1.0 (GNDEC campus feeds)";

type CacheEntry<T> = {
  data: T;
  fetchedAtMillis: number;
};

let holidayCache: CacheEntry<HolidayFeed> | null = null;
let noticeCache: CacheEntry<NoticeFeed> | null = null;
let holidayInFlight: Promise<HolidayFeed> | null = null;
let noticeInFlight: Promise<NoticeFeed> | null = null;

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
  if (!forceRefresh && holidayCache && Date.now() - holidayCache.fetchedAtMillis < CACHE_TTL_MS) {
    return { ...holidayCache.data, servedFromCache: true, stale: false, refreshError: null };
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
        const feed: HolidayFeed = {
          holidays,
          fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString(),
          servedFromCache: Boolean(payload.servedFromCache),
          stale: Boolean(payload.stale),
          refreshError: typeof payload.refreshError === "string" ? payload.refreshError : null,
        };
        holidayCache = { data: feed, fetchedAtMillis: Date.now() };
        return feed;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Could not load holidays";
      }
    }
    if (holidayCache) {
      return {
        ...holidayCache.data,
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
  if (!forceRefresh && noticeCache && Date.now() - noticeCache.fetchedAtMillis < CACHE_TTL_MS) {
    return { ...noticeCache.data, servedFromCache: true, stale: false, refreshError: null };
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
      const feed: NoticeFeed = {
        notices,
        fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString(),
        servedFromCache: Boolean(payload.servedFromCache),
        stale: Boolean(payload.stale),
        refreshError: typeof payload.refreshError === "string" ? payload.refreshError : null,
      };
      noticeCache = { data: feed, fetchedAtMillis: Date.now() };
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load notices";
      if (noticeCache) {
        return {
          ...noticeCache.data,
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
