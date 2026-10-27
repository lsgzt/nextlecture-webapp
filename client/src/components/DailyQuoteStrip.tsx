import { useEffect, useState } from "react";
import type { CachedDailyQuote } from "@shared/daily-quote";
import { isCachedQuoteDue, readCachedQuote, todayQuoteDayKey, writeCachedQuote } from "@/lib/daily-quote";
import { trpc } from "@/lib/trpc";

/**
 * Daily quote strip, shown between the hero lecture card and the schedule —
 * the same placement as the Android home screen. Deliberately not a card:
 * quiet centered italic text between denser blocks.
 *
 * Side inset grows with length so longer quotes wrap with fuller last lines
 * instead of two stranded words. Attribution sits under the quote,
 * right-aligned with a modest trailing inset — classic web "— Author" style.
 *
 * Rendered only once a quote exists: before the first successful fetch there
 * is nothing to say, and a placeholder would just be a gap.
 */

/** Android parity: 20dp / 32dp / 40dp side insets by quote length. */
function sideInsetFor(length: number): string {
  if (length <= 50) return "px-5";
  if (length <= 90) return "px-8";
  return "px-10";
}

export function DailyQuoteStrip({ className = "" }: { className?: string }) {
  // Synchronous read on mount: a returning visitor sees yesterday's/today's
  // quote immediately, with no fetch and no flash of empty space.
  const [cached, setCached] = useState<CachedDailyQuote | null>(() => readCachedQuote());
  const due = isCachedQuoteDue(cached);

  const quoteQuery = trpc.campus.dailyQuote.useQuery(undefined, {
    enabled: due,
    staleTime: Infinity,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // A failure is swallowed on purpose: the cached quote (even a stale one) is
  // already on screen, and the next visit tries again after the boundary.
  useEffect(() => {
    const fetched = quoteQuery.data;
    if (!fetched?.text) return;
    const next: CachedDailyQuote = {
      text: fetched.text,
      author: fetched.author,
      dayKey: todayQuoteDayKey(),
    };
    writeCachedQuote(next);
    setCached(next);
  }, [quoteQuery.data]);

  if (!cached) return null;

  return (
    <section aria-label="Quote of the day" className={`nl-enter ${sideInsetFor(cached.text.length)} ${className}`.trim()}>
      <blockquote className="text-center text-base italic leading-[25px] text-muted-foreground">
        {cached.text}
      </blockquote>
      {cached.author.trim() && (
        <p className="mt-1 pr-1.5 text-right text-xs font-medium text-teal-700 dark:text-teal-300">
          — {cached.author}
        </p>
      )}
    </section>
  );
}
