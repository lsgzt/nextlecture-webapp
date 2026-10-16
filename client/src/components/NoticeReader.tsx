import { CalendarDays, ExternalLink, Megaphone, X } from "lucide-react";
import { useEffect } from "react";
import type { CampusNotice } from "@shared/campus";

export function compactNoticeTitle(title: string, maxLength = 76) {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength).trimEnd()}...`;
}

export function NoticeReader({
  notice,
  onClose,
}: {
  notice: CampusNotice;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Full official GNDEC notice"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
        <article className="w-full overflow-hidden rounded-3xl border border-amber-400/70 bg-card text-foreground shadow-2xl shadow-black/30 dark:border-amber-500/45">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-amber-700 px-5 py-4 text-amber-50 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/30">
                <Megaphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-100/85">
                  Official GNDEC notice
                </p>
                <p className="mt-0.5 truncate text-sm text-amber-100/75">
                  {notice.source || "GNDEC"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-amber-100 transition hover:bg-amber-500/25"
              aria-label="Close notice"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="px-5 py-7 sm:px-7 sm:py-9">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>
                {notice.displayDate ||
                  notice.publishedDate ||
                  "Official notice"}
              </span>
            </div>
            <h1 className="mt-5 break-words font-display text-2xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">
              {notice.title}
            </h1>
          </div>

          <footer className="border-t border-border bg-muted/35 px-5 py-4 sm:px-7">
            <a
              href={notice.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-center text-sm font-bold text-white transition hover:bg-teal-800 active:scale-[0.99]"
            >
              View notice on official GNDEC website
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </footer>
        </article>
      </div>
    </div>
  );
}
