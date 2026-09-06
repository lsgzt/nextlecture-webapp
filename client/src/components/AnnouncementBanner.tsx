import { AlertCircle, Info, X } from "lucide-react";
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
  const [dismissed, setDismissed] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : readDismissedIds()));

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

  const visible = items.filter(item => !dismissed.has(item.id));
  if (visible.length === 0) return null;

  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      {visible.map(item => {
        const isWarning = item.type === "warning" || item.title.includes("⚠️");
        const Icon = isWarning ? AlertCircle : Info;
        return (
          <aside
            key={item.id}
            role="status"
            className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm sm:px-5 ${
              isWarning
                ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                : "border-teal-200 bg-teal-50/80 text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-100"
            }`}
          >
            <div className="flex gap-3">
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                  isWarning
                    ? "bg-amber-200/70 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                    : "bg-teal-200/70 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pr-7">
                <p className="font-semibold tracking-[-0.02em]">{item.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 opacity-90">{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-current/60 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
                aria-label={`Dismiss ${item.title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </aside>
        );
      })}
    </div>
  );
}
