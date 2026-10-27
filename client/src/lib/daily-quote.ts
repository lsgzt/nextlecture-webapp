import { isQuoteFetchDue, quoteDayKey, type CachedDailyQuote } from "@shared/daily-quote";

/**
 * Client-side cache for the daily quote — the web counterpart of the Android
 * app's SettingsManager quote cache. The quote is stored per IST day so a
 * repeat visit renders instantly and the server is called at most once a day
 * per browser, with the same 05:32 IST boundary as the Android alarm.
 */

const CACHE_KEY = "nextlecture.daily-quote.v1";

/** The cached quote from a previous visit, or null when nothing is usable. */
export function readCachedQuote(): CachedDailyQuote | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDailyQuote>;
    if (typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    if (typeof parsed.author !== "string") return null;
    return {
      text: parsed.text,
      author: parsed.author,
      dayKey: typeof parsed.dayKey === "string" ? parsed.dayKey : "",
    };
  } catch {
    // Corrupted entry or storage unavailable (private mode) — treat as empty.
    return null;
  }
}

/** Persists today's quote. Failures are swallowed: the cache is best-effort. */
export function writeCachedQuote(quote: CachedDailyQuote): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(quote));
  } catch {
    // Private mode / quota — the quote still shows for this visit.
  }
}

/** Whether a fetch is owed for the given cached quote (DailyQuoteManager parity). */
export function isCachedQuoteDue(cached: CachedDailyQuote | null, nowMillis: number = Date.now()): boolean {
  return isQuoteFetchDue(cached?.dayKey ?? "", nowMillis);
}

/** The IST day key for "now" — stamped onto quotes fetched this visit. */
export function todayQuoteDayKey(nowMillis: number = Date.now()): string {
  return quoteDayKey(nowMillis);
}
