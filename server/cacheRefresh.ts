/**
 * Scheduled + on-demand refresh of durable external-source caches.
 * Keeps vacant rooms, timetable, and campus feeds current without blocking user requests.
 *
 * Primary freshness is request-driven SWR on user traffic (Hobby has no frequent cron).
 * This endpoint is an optional manual warm-up only — not scheduled on Hobby.
 */

import { getHolidayFeed, getNoticeFeed } from "./campusFeeds";
import { getOfficialTimetable } from "./timetable";
import { getVacantRooms } from "./vacantRooms";

export type CacheRefreshResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  results: Record<string, { ok: boolean; error?: string; fetchedAt?: number | string | null }>;
};

async function runOne<T>(
  name: string,
  fn: () => Promise<T>,
  pickFetchedAt: (value: T) => number | string | null | undefined,
): Promise<{ ok: boolean; error?: string; fetchedAt?: number | string | null }> {
  try {
    const value = await fn();
    return { ok: true, fetchedAt: pickFetchedAt(value) ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Cache refresh] ${name} failed:`, message);
    return { ok: false, error: message };
  }
}

/** Force-refresh all durable external caches. Safe to call from cron. */
export async function refreshExternalCaches(): Promise<CacheRefreshResult> {
  const startedAt = new Date().toISOString();
  const results: CacheRefreshResult["results"] = {};

  // Sequential for vacant rooms (heavy multi-root HTML). Parallel for lighter feeds.
  results.vacantRooms = await runOne("vacantRooms", () => getVacantRooms(true), v => v.fetchedAtMillis);
  results.timetable = await runOne(
    "timetable",
    () => getOfficialTimetable(true),
    v => v.cache.fetchedAt,
  );

  const [holidays, notices] = await Promise.all([
    runOne("holidays", () => getHolidayFeed(true), v => v.fetchedAt),
    runOne("notices", () => getNoticeFeed(true), v => v.fetchedAt),
  ]);
  results.holidays = holidays;
  results.notices = notices;

  const finishedAt = new Date().toISOString();
  const ok = Object.values(results).every(r => r.ok);
  return { ok, startedAt, finishedAt, results };
}
