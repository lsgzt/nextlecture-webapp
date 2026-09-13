import {
  HOLIDAY_CATEGORIES,
  OFFICIAL_NOTICE_BOARD_URL,
  type CampusHoliday,
  type CampusNotice,
} from "@shared/campus";
import { BRAND_LOGO_URL } from "@shared/config";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";

function HolidaysPanel({
  holidays,
  loading,
  error,
}: {
  holidays: CampusHoliday[];
  loading: boolean;
  error: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const year = holidays[0]?.year;
  const groups = useMemo(
    () =>
      HOLIDAY_CATEGORIES.map(meta => ({
        ...meta,
        items: holidays.filter(h => h.category === meta.category),
      })).filter(g => g.items.length > 0),
    [holidays],
  );

  return (
    <section className="rounded-3xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">HOLIDAYS</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading && !holidays.length
              ? "Loading official holiday list…"
              : holidays.length
                ? `Official GNDEC holidays · ${year}`
                : error || "Official list unavailable"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 sm:px-6">
          {loading && !holidays.length && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && !holidays.length && (
            <p className="text-sm text-muted-foreground">{error || "No holidays found."}</p>
          )}
          {groups.map((group, index) => (
            <div key={group.category} className={index > 0 ? "mt-5" : ""}>
              <p className="text-xs font-bold tracking-[0.1em] text-teal-700 dark:text-teal-300">
                {group.label} · {group.items.length}
              </p>
              <ul className="mt-2 space-y-2.5">
                {group.items.map(holiday => (
                  <li key={holiday.id} className="flex gap-3 text-sm">
                    <div className="w-[6.5rem] shrink-0">
                      <p className="font-semibold text-teal-800 dark:text-teal-200">
                        {holiday.displayDate.replace(new RegExp(`,\\s*${holiday.year}$`), "")}
                      </p>
                      <p className="text-xs text-muted-foreground">{holiday.weekday}</p>
                    </div>
                    <p className="min-w-0 flex-1 font-medium leading-5 text-foreground">{holiday.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NoticeCard({ notice }: { notice: CampusNotice }) {
  const sourceLabel = notice.author || notice.source;
  return (
    <a
      href={notice.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 active:scale-[0.995] dark:hover:border-teal-800 dark:hover:bg-teal-950/25"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-5 text-foreground">{notice.title}</p>
        <p className="mt-1 text-sm font-semibold text-teal-700 dark:text-teal-300">{notice.displayDate}</p>
        {sourceLabel ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sourceLabel}</p> : null}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export default function CampusPage() {
  const holidaysQuery = trpc.campus.holidays.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: 1 });
  const noticesQuery = trpc.campus.notices.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 1 });
  const utils = trpc.useUtils();

  const holidays = holidaysQuery.data?.holidays ?? [];
  const notices = noticesQuery.data?.notices ?? [];
  const refreshing = holidaysQuery.isFetching || noticesQuery.isFetching;

  async function refreshAll() {
    await Promise.all([
      utils.campus.holidays.invalidate(),
      utils.campus.notices.invalidate(),
      holidaysQuery.refetch(),
      noticesQuery.refetch(),
    ]);
  }

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]">
      <header className="app-topbar">
        <div className="container flex h-17 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300"
              aria-label="Back to timetable"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <img
              src={BRAND_LOGO_URL}
              alt="NextLecture"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25"
            />
            <div>
              <p className="font-display text-lg font-semibold tracking-[-0.04em]">Notices & holidays</p>
              <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">
                OFFICIAL GNDEC UPDATES
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-60 dark:hover:border-teal-900 dark:hover:bg-teal-950/35 dark:hover:text-teal-300"
              aria-label="Refresh"
            >
              {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl space-y-5 pb-16 pt-7 sm:pt-10">
        <HolidaysPanel
          holidays={holidays}
          loading={holidaysQuery.isLoading}
          error={holidaysQuery.isError ? (holidaysQuery.error as Error).message : holidaysQuery.data?.refreshError ?? null}
        />

        <section className="rounded-3xl border border-teal-200/80 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/25 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white">
              <Megaphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.12em] text-teal-800 dark:text-teal-200">
                GNDEC OFFICIAL NOTICE FEED
              </p>
              <p className="mt-1 text-sm text-teal-900/70 dark:text-teal-100/75">
                ERP + homepage notices · same source as the Android app
              </p>
            </div>
          </div>
        </section>

        {noticesQuery.isLoading && !notices.length && (
          <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-teal-700" />
            <p className="mt-3">Loading official notices…</p>
          </div>
        )}

        {noticesQuery.isError && !notices.length && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{(noticesQuery.error as Error).message}</span>
          </div>
        )}

        {notices.length > 0 && (
          <div className="space-y-2.5">
            {notices.map(notice => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        )}

        {!noticesQuery.isLoading && !noticesQuery.isError && notices.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
            No cached notices available yet.
          </p>
        )}

        <a
          href={OFFICIAL_NOTICE_BOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-600/40 bg-card px-4 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-950/40"
        >
          View all previous notices on GNDEC official website
          <ExternalLink className="h-4 w-4" />
        </a>
      </main>
    </div>
  );
}
