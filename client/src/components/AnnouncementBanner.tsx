import { AlertCircle, Bell, ChevronDown, Info, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  ANNOUNCEMENTS_SOURCE_URL,
  normalizeAnnouncements,
  type Announcement,
} from "@shared/announcements";

const DISMISSED_KEY = "nextlecture:dismissed-announcements";

function readDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function AnnouncementBanner({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readDismissedIds(),
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(ANNOUNCEMENTS_SOURCE_URL, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-cache",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;
        setItems(normalizeAnnouncements(payload));
      } catch {
        // Silent: announcements are optional and must not break the app.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed(current => {
      const next = new Set(current);
      next.add(id);
      writeDismissedIds(next);
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setDismissed(current => {
      const next = new Set(current);
      next.delete(id);
      writeDismissedIds(next);
      return next;
    });
  }, []);

  // Latest active announcement only (normalizeAnnouncements already slices to 1).
  const latest = items[0] ?? null;
  if (!latest) return null;

  const isDismissed = dismissed.has(latest.id);
  const isWarning = latest.type === "warning" || latest.title.includes("⚠️");
  const Icon = isWarning ? AlertCircle : Info;

  // Collapsed state: still reachable after the user hits X.
  if (isDismissed) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => restore(latest.id)}
          className="nl-enter group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:border-teal-600/40 hover:bg-teal-50/40 dark:hover:bg-teal-950/30"
          aria-label="Show announcement again"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.68rem] font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">
              ANNOUNCEMENT
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
              {latest.title}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-bold text-white transition group-hover:bg-teal-800">
            Show
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden="true" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      <aside
        role="status"
        className={`nl-enter relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm sm:px-5 ${
          isWarning
            ? "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-50"
            : "border-teal-200 bg-teal-50/90 text-teal-950 dark:border-teal-900/70 dark:bg-teal-950/40 dark:text-teal-50"
        }`}
      >
        <div className="flex gap-3">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              isWarning
                ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                : "bg-teal-200/70 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pr-7">
            <p className="font-semibold tracking-[-0.02em]">{latest.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 opacity-90">{latest.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(latest.id)}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-current/60 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
            aria-label={`Dismiss ${latest.title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
