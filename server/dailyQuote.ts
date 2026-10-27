import { nextQuoteTriggerAfter, ZENQUOTES_TODAY_URL, type DailyQuotePayload } from "../shared/daily-quote";

/**
 * Server-side proxy for the ZenQuotes "quote of the day" feed.
 *
 * The browser cannot call ZenQuotes directly (the API sends no CORS headers),
 * so the client asks this module through the `campus.dailyQuote` procedure —
 * the same fetch-from-official-source shape as the notices and holiday feeds.
 *
 * Caching: one upstream call per refresh boundary, not per student. The cached
 * entry lives until the next 05:32 IST boundary (the moment ZenQuotes rotates
 * its /today list), so the whole college shares a single daily request and the
 * free-tier rate limit is never in play. Concurrent callers share one in-flight
 * request; a failed attempt clears the cache slot so the next open retries
 * instead of serving an error until tomorrow.
 */

const UPSTREAM_TIMEOUT_MS = 8000;

let cached: { quote: DailyQuotePayload; expiresAt: number } | null = null;
let inflight: Promise<DailyQuotePayload> | null = null;

/** Fetches today's quote. Throws rather than returning a blank quote so callers can retry. */
async function fetchUpstream(): Promise<DailyQuotePayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(ZENQUOTES_TODAY_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ZenQuotes returned ${response.status}`);
    const body: unknown = await response.json();
    // `/today` answers with a single-element array; only the first entry is read.
    const entry = Array.isArray(body) ? (body[0] as Record<string, unknown> | undefined) : undefined;
    const text = typeof entry?.q === "string" ? entry.q.trim() : "";
    const author = typeof entry?.a === "string" ? entry.a.trim() : "";
    if (!text) throw new Error("ZenQuotes returned no quote");
    return { text, author };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ZenQuotes did not answer in time");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Today's quote, from cache while the day is current and from ZenQuotes otherwise. */
export async function getDailyQuote(): Promise<DailyQuotePayload> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.quote;
  if (!inflight) {
    inflight = fetchUpstream()
      .then(quote => {
        cached = { quote, expiresAt: nextQuoteTriggerAfter(Date.now()) };
        return quote;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
