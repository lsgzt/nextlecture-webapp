import {
  AlertCircle,
  AlertTriangle,
  Bell,
  ChevronDown,
  Megaphone,
  PartyPopper,
  Pin,
  Sparkles,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ANNOUNCEMENTS_SOURCE_URL,
  normalizeAnnouncements,
  resolveAnnouncementStyle,
  type Announcement,
  type AnnouncementStyle,
} from "@shared/announcements";
import { readStoredStudentProfile } from "@/lib/student-profile-storage";

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

/** Lightweight markdown subset matching Android: bold, italic, links, and bare URLs. */
function renderAnnouncementMessage(message: string): ReactNode {
  const lines = message.split("\n");
  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 ? <br /> : null}
      {renderInlineMarkdown(line)}
    </Fragment>
  ));
}

function renderInlineMarkdown(text: string): ReactNode[] {
  // Combined pattern: [label](url) | **bold** | *italic* | _italic_ | bare https URL
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}
          className="font-semibold underline decoration-current/40 underline-offset-2 transition hover:decoration-current"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-bold">
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined || match[5] !== undefined) {
      nodes.push(
        <em key={key++} className="italic">
          {match[4] ?? match[5]}
        </em>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}
          className="break-all font-semibold underline decoration-current/40 underline-offset-2 transition hover:decoration-current"
        >
          {match[6]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

type StyleTheme = {
  Icon: typeof Megaphone;
  shell: string;
  iconWrap: string;
  label: string;
};

const STYLE_THEMES: Record<AnnouncementStyle, StyleTheme> = {
  info: {
    Icon: Megaphone,
    shell:
      "border-teal-200 bg-teal-50/90 text-teal-950 dark:border-teal-900/70 dark:bg-teal-950/40 dark:text-teal-50",
    iconWrap: "bg-teal-200/70 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100",
    label: "Info",
  },
  notice: {
    Icon: Pin,
    shell:
      "border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-50",
    iconWrap: "bg-sky-200/70 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
    label: "Notice",
  },
  warn: {
    Icon: AlertTriangle,
    shell:
      "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-50",
    iconWrap: "bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
    label: "Warning",
  },
  happy: {
    Icon: PartyPopper,
    shell:
      "border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-50",
    iconWrap: "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
    label: "Celebration",
  },
  urgent: {
    Icon: AlertCircle,
    shell:
      "border-red-300/80 bg-red-50 text-red-950 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-50",
    iconWrap: "bg-red-200/80 text-red-900 dark:bg-red-900/50 dark:text-red-100",
    label: "Urgent",
  },
  update: {
    Icon: Sparkles,
    shell:
      "border-cyan-200 bg-cyan-50/90 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-50",
    iconWrap: "bg-cyan-200/70 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100",
    label: "Update",
  },
};

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

        const profile =
          typeof window !== "undefined" ? readStoredStudentProfile(localStorage) : null;
        const audience = profile
          ? {
              branch: profile.branch,
              section: profile.section,
              subsection: profile.subsection,
            }
          : null;

        setItems(normalizeAnnouncements(payload, audience));
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

  const latest = items[0] ?? null;
  const style = useMemo(
    () => (latest ? resolveAnnouncementStyle(latest.type) : "info"),
    [latest],
  );
  const theme = STYLE_THEMES[style];
  const cardLink = latest?.link?.trim() || "";

  if (!latest) return null;

  const isDismissed = dismissed.has(latest.id);
  const { Icon } = theme;

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
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5"
              aria-hidden="true"
            />
          </span>
        </button>
      </div>
    );
  }

  const body = (
    <div className="flex gap-3">
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${theme.iconWrap}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pr-7">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] opacity-70">{theme.label}</p>
        <p className="mt-0.5 font-semibold tracking-[-0.02em]">{latest.title}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">{renderAnnouncementMessage(latest.message)}</p>
        {cardLink ? (
          <p className="mt-2 text-xs font-semibold opacity-70">Tap card to open</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          dismiss(latest.id);
        }}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-current/60 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
        aria-label={`Dismiss ${latest.title}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      {cardLink ? (
        <a
          href={cardLink}
          target="_blank"
          rel="noopener noreferrer"
          role="status"
          className={`nl-enter relative block overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm transition hover:brightness-[0.98] active:scale-[0.995] sm:px-5 ${theme.shell}`}
        >
          {body}
        </a>
      ) : (
        <aside
          role="status"
          className={`nl-enter relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm sm:px-5 ${theme.shell}`}
        >
          {body}
        </aside>
      )}
    </div>
  );
}
