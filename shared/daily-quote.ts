/**
 * Daily quote feed — ZenQuotes "quote of the day", shared by the client cache
 * and the server proxy. Mirrors nextlecture-android's DailyQuoteSchedule.
 *
 * The refresh boundary is fixed at 05:32 **Asia/Kolkata** rather than the
 * visitor's own zone: ZenQuotes rotates its /today entry around 05:30 IST
 * (midnight UTC), and IST has no daylight saving, so the boundary is stable
 * year-round and every student sees the same quote on the same day.
 */

export const ZENQUOTES_TODAY_URL = "https://zenquotes.io/api/today";

export const QUOTE_ZONE = "Asia/Kolkata";

/** The 05:32 IST refresh boundary, minute-precision. */
const FETCH_HOUR_IST = 5;
const FETCH_MINUTE_IST = 32;

/** A ZenQuotes entry: `q` body + `a` author (the author may be blank). */
export type DailyQuotePayload = {
  text: string;
  author: string;
};

/** The quote on screen, together with the IST day it was fetched for. */
export type CachedDailyQuote = DailyQuotePayload & { dayKey: string };

/**
 * The IST calendar date an instant falls on, as `yyyy-mm-dd`.
 *
 * Built from formatToParts rather than a locale format string so the output
 * shape is guaranteed regardless of the runtime's default locale.
 */
export function quoteDayKey(epochMillis: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTE_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMillis));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Epoch millis of the 05:32 IST boundary on the IST date containing [epochMillis]. */
export function quoteTriggerAt(epochMillis: number): number {
  return Date.parse(
    `${quoteDayKey(epochMillis)}T${String(FETCH_HOUR_IST).padStart(2, "0")}:${String(FETCH_MINUTE_IST).padStart(2, "0")}:00+05:30`,
  );
}

/**
 * The next 05:32 IST boundary strictly after [epochMillis]. Once a day's
 * trigger has passed the answer is tomorrow's, so re-arming after consuming a
 * boundary never schedules the same one twice.
 */
export function nextQuoteTriggerAfter(epochMillis: number): number {
  const todayTrigger = quoteTriggerAt(epochMillis);
  // IST observes no daylight saving, so +24h from a boundary is exactly the
  // next day's boundary.
  return epochMillis < todayTrigger ? todayTrigger : todayTrigger + 24 * 3_600_000;
}

/**
 * Whether a fetch is still owed.
 *
 * True when nothing is cached yet, or when today's 05:32 IST has already
 * passed and the cached quote is not from today. Between 00:00 and 05:32 the
 * previous day's quote is still the most recent one that exists, so it stays
 * on screen instead of blanking the section — and opening the page fifty
 * times after 05:32 fetches once, then stays quiet until tomorrow.
 */
export function isQuoteFetchDue(cachedDayKey: string, nowMillis: number): boolean {
  if (!cachedDayKey) return true;
  if (cachedDayKey === quoteDayKey(nowMillis)) return false;
  return nowMillis >= quoteTriggerAt(nowMillis);
}
