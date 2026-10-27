import {
  OFFICIAL_NOTICE_BOARD_URL,
  type CampusHoliday,
  type CampusNotice,
} from "@shared/campus";
import { BRAND_LOGO_URL } from "@shared/config";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AppBottomNav } from "@/components/AppBottomNav";
import { NoticeReader, compactNoticeTitle } from "@/components/NoticeReader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UniversalSearch } from "@/components/UniversalSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function NoticeCard({ notice, onOpen }: { notice: CampusNotice; onOpen: (notice: CampusNotice) => void }) {
  const sourceLabel = notice.author || notice.source;
  return (
    <button
      type="button"
      onClick={() => onOpen(notice)}
      aria-label={`Read full notice: ${notice.title}`}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 active:scale-[0.995] dark:hover:border-teal-800 dark:hover:bg-teal-950/25"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
        <Megaphone className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-5 text-foreground">{compactNoticeTitle(notice.title, 110)}</p>
        <p className="mt-1 text-sm font-semibold text-teal-700 dark:text-teal-300">{notice.displayDate}</p>
        {sourceLabel ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sourceLabel}</p> : null}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Holidays — mirrors the Android app's Holidays screen: a hero card   */
/* for the next holiday, then every official holiday grouped by month  */
/* (upcoming months first, past months after, dimmed).                 */
/* ------------------------------------------------------------------ */

type HolidayKind = "public" | "restricted" | "half-day" | "other";

/** Same ladder as the app's holidayKind(): half-day beats restricted beats public. */
function holidayKind(category: string): HolidayKind {
  if (/half/i.test(category)) return "half-day";
  if (/restricted/i.test(category)) return "restricted";
  if (/public/i.test(category)) return "public";
  return "other";
}

const HOLIDAY_KIND_LABELS: Record<HolidayKind, string> = {
  public: "Public holiday",
  restricted: "Restricted holiday",
  "half-day": "Half-day holiday",
  other: "",
};

/** Type colours: teal for public holidays, deep teal for half-days, amber for restricted. */
function holidayTextClass(kind: HolidayKind): string {
  switch (kind) {
    case "restricted":
      return "text-orange-700 dark:text-amber-300";
    case "half-day":
      return "text-teal-800 dark:text-teal-300";
    case "public":
      return "text-teal-700 dark:text-teal-300";
    default:
      return "text-foreground";
  }
}

function holidayBarClass(kind: HolidayKind): string {
  switch (kind) {
    case "restricted":
      return "bg-orange-600 dark:bg-amber-400";
    case "half-day":
      return "bg-teal-800 dark:bg-teal-300";
    case "public":
      return "bg-teal-600 dark:bg-teal-400";
    default:
      return "bg-muted-foreground/40";
  }
}

/** "27 October 2026 (Tuesday)" — the long date format used by the app's hero card. */
function formatHolidayLongDate(date: Date): string {
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, options).format(date);
  return `${format({ day: "numeric", month: "long", year: "numeric" })} (${format({ weekday: "long" })})`;
}

/** A holiday resolved against today: how far away it is, whether it has passed. */
type HolidayRow = {
  holiday: CampusHoliday;
  date: Date | null;
  daysUntil: number | null;
  isPast: boolean;
  monthKey: string | null; // "yyyy-mm", null when the date cannot be parsed
};

function buildHolidayRows(holidays: CampusHoliday[]): HolidayRow[] {
  const todayMs = new Date(`${localIsoDate()}T00:00:00`).getTime();
  return holidays
    .map(holiday => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(holiday.date) ? new Date(`${holiday.date}T00:00:00`) : null;
      const daysUntil = date ? Math.round((date.getTime() - todayMs) / 86_400_000) : null;
      return {
        holiday,
        date,
        daysUntil,
        isPast: daysUntil !== null && daysUntil < 0,
        monthKey: date ? holiday.date.slice(0, 7) : null,
      };
    })
    .sort(
      (a, b) => Number(a.date === null) - Number(b.date === null) || (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
    );
}

/** Decorative calendar mark — same composition as the app's HolidayGlyph. */
function HolidayGlyph() {
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center" aria-hidden="true">
      <span className="absolute h-16 w-16 rounded-full bg-teal-700/15 dark:bg-teal-300/15" />
      <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-700/50 dark:bg-teal-300/50" />
      <span className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-teal-700/50 dark:bg-teal-300/50" />
      <span className="absolute right-2 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-teal-700/50 dark:bg-teal-300/50" />
      <CalendarDays className="relative h-9 w-9 text-teal-700 dark:text-teal-300" />
    </div>
  );
}

/** Hero card: the next holiday up front, with the app's loading / empty states. */
function NextHolidayCard({ next, hasAny, refreshing }: { next: HolidayRow | null; hasAny: boolean; refreshing: boolean }) {
  const days = next?.daysUntil ?? null;
  return (
    <div className="flex items-center gap-3 rounded-[1.375rem] border border-[#E6ECEB] bg-[#E6F4F2] px-5 py-4 dark:border-[#304B49] dark:bg-[#173E3D]">
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">
          {next && days === 0 ? "HOLIDAY · TODAY" : next ? "NEXT HOLIDAY" : hasAny ? "NO UPCOMING HOLIDAYS" : refreshing ? "LOADING HOLIDAYS" : "HOLIDAYS"}
        </p>
        <p className="mt-1 line-clamp-2 font-display text-xl font-semibold leading-7 tracking-[-0.03em] text-foreground sm:text-2xl">
          {next?.holiday.name ?? (hasAny ? "That's everything for now" : "Official list unavailable")}
        </p>
        {next && days !== null && (
          <>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {days === 0 ? (
                "Enjoy the break"
              ) : (
                <>
                  in <span className="font-bold text-teal-700 dark:text-teal-300">{days}</span> {days === 1 ? "day" : "days"}
                </>
              )}
            </p>
            {next.date && (
              <p className="mt-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {formatHolidayLongDate(next.date)}
              </p>
            )}
          </>
        )}
      </div>
      <HolidayGlyph />
    </div>
  );
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1))
    .toUpperCase();
}

function HolidayMonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <p className="text-[0.66rem] font-bold tracking-[0.12em] text-foreground">{label}</p>
      <span className="text-[0.63rem] font-semibold text-muted-foreground">{count}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

/** One holiday row: day column, type-coloured bar, name, badge, countdown pill. */
function HolidayRowCard({ row, isNext }: { row: HolidayRow; isNext: boolean }) {
  const kind = holidayKind(row.holiday.category);
  const url = row.holiday.source.startsWith("http") ? row.holiday.source : null;
  const badge = kind === "other" ? row.holiday.category.trim() : HOLIDAY_KIND_LABELS[kind];
  const textClass = holidayTextClass(kind);
  const lineClass = row.isPast ? "bg-muted-foreground/40" : holidayBarClass(kind);

  const content = (
    <>
      <div className="flex w-11 shrink-0 flex-col items-center">
        <span className="text-xl font-bold leading-6 text-foreground">{row.date ? row.date.getDate() : "—"}</span>
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {row.date ? new Intl.DateTimeFormat(undefined, { month: "short" }).format(row.date) : row.holiday.displayDate.slice(0, 3)}
        </span>
      </div>
      <span className={`mt-0.5 w-[3px] shrink-0 rounded-full ${badge ? "h-[50px]" : "h-[42px]"} ${lineClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 text-sm font-semibold leading-5 ${kind === "restricted" ? textClass : "text-foreground"}`}>
          {row.holiday.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.holiday.weekday}</p>
        {badge && <p className={`mt-1 truncate text-[0.6rem] font-bold uppercase tracking-[0.08em] ${textClass}`}>{badge}</p>}
      </div>
      {isNext && row.daysUntil !== null && (
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[#FFF1DE] px-2.5 py-1 text-[0.63rem] font-bold text-[#6B4708] dark:bg-[#6B4708] dark:text-[#FFDE9F]">
          {row.daysUntil <= 0 ? "Today" : row.daysUntil === 1 ? "In 1 day" : `In ${row.daysUntil} days`}
        </span>
      )}
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  const className = `flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition ${
    row.isPast ? "opacity-40" : ""
  } ${url ? "hover:border-teal-700/30 active:scale-[0.995]" : ""}`;

  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={className} aria-label={`Open the notice for ${row.holiday.name}`}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function HolidayMonth({ label, rows, nextId }: { label: string; rows: HolidayRow[]; nextId: string | null }) {
  return (
    <div className="space-y-2">
      <HolidayMonthHeader label={label} count={rows.length} />
      {rows.map(row => (
        <HolidayRowCard key={row.holiday.id} row={row} isNext={row.holiday.id === nextId} />
      ))}
    </div>
  );
}

/** The full list: upcoming months in calendar order, then past months most-recent first. */
function HolidaysPanel({ rows, nextId, refreshing }: { rows: HolidayRow[]; nextId: string | null; refreshing: boolean }) {
  const { future, past, undated } = useMemo(() => {
    const byMonth = new Map<string, HolidayRow[]>();
    for (const row of rows) {
      if (!row.monthKey) continue;
      const bucket = byMonth.get(row.monthKey);
      if (bucket) bucket.push(row);
      else byMonth.set(row.monthKey, [row]);
    }
    const todayIso = localIsoDate();
    const futureMonths: Array<{ key: string; rows: HolidayRow[] }> = [];
    const pastMonths: Array<{ key: string; rows: HolidayRow[] }> = [];
    for (const group of Array.from(byMonth, ([key, monthRows]) => ({ key, rows: monthRows }))) {
      const [year, month] = group.key.split("-").map(Number);
      const monthEndIso = localIsoDate(new Date(year, month, 0));
      (monthEndIso < todayIso ? pastMonths : futureMonths).push(group);
    }
    futureMonths.sort((a, b) => a.key.localeCompare(b.key));
    pastMonths.sort((a, b) => b.key.localeCompare(a.key));
    return { future: futureMonths, past: pastMonths, undated: rows.filter(row => !row.monthKey) };
  }, [rows]);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.11em] text-foreground">ALL HOLIDAYS</p>
        <p className="text-xs text-muted-foreground">
          {rows.length === 0 ? (refreshing ? "Loading…" : "Unavailable") : `Total ${rows.length} holidays`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-2.5 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          {refreshing ? "Loading official holiday list…" : "The official holiday list is unavailable right now."}
        </div>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {future.map(group => (
            <HolidayMonth key={group.key} label={monthLabel(group.key)} rows={group.rows} nextId={nextId} />
          ))}
          {past.map(group => (
            <HolidayMonth key={group.key} label={monthLabel(group.key)} rows={group.rows} nextId={nextId} />
          ))}
          {undated.length > 0 && <HolidayMonth label="DATE NOT AVAILABLE" rows={undated} nextId={nextId} />}
        </div>
      )}
    </section>
  );
}

export default function CampusPage() {
  const [location] = useLocation();
  const holidaysQuery = trpc.campus.holidays.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: 1 });
  const noticesQuery = trpc.campus.notices.useQuery({ forceRefresh: true }, { staleTime: 0, refetchOnMount: "always", retry: 1 });
  const utils = trpc.useUtils();
  const [selectedNotice, setSelectedNotice] = useState<CampusNotice | null>(null);

  const tabFromUrl = new URLSearchParams(window.location.search).get("tab") === "holidays" ? "holidays" : "notices";
  const [tab, setTab] = useState<"notices" | "holidays">(tabFromUrl);

  // Stay in sync with deep links (universal search, /app holiday banner).
  useEffect(() => {
    const nextTab = new URLSearchParams(window.location.search).get("tab") === "holidays" ? "holidays" : "notices";
    setTab(nextTab);
  }, [location]);

  // Tab switch (Notices ↔ Holidays) stays on the same route, so ScrollToTop
  // does not run — reset scroll so the chosen panel always starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [tab]);

  const holidays = holidaysQuery.data?.holidays ?? [];
  const notices = noticesQuery.data?.notices ?? [];
  const refreshing = holidaysQuery.isFetching || noticesQuery.isFetching;

  const holidayRows = useMemo(() => buildHolidayRows(holidays), [holidays]);
  const nextHolidayRow = useMemo(
    () => holidayRows.find(row => row.daysUntil !== null && row.daysUntil >= 0) ?? null,
    [holidayRows],
  );

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
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="NextLecture home">
              <img
                src={BRAND_LOGO_URL}
                alt="NextLecture"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25"
              />
            </Link>
            <div>
              <p className="font-display text-lg font-semibold tracking-[-0.04em]">Notices & holidays</p>
              <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">
                OFFICIAL GNDEC UPDATES
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UniversalSearch />
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="app-header-button"
              aria-label="Refresh notices and holidays"
              title="Refresh notices and holidays"
            >
              {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl space-y-5 pt-5 app-bottom-clearance sm:pt-7">
        <Tabs value={tab} onValueChange={value => setTab(value as "notices" | "holidays")}>
          <TabsList className="h-auto w-full justify-around gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm dark:bg-card">
            <TabsTrigger
              value="notices"
              className="min-h-11 flex-1 gap-2 rounded-xl px-3 text-sm font-bold data-[state=active]:bg-teal-700 data-[state=active]:text-white dark:data-[state=active]:bg-teal-700 dark:data-[state=active]:text-white"
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              Notices
              {notices.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${tab === "notices" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {notices.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="holidays"
              className="min-h-11 flex-1 gap-2 rounded-xl px-3 text-sm font-bold data-[state=active]:bg-teal-700 data-[state=active]:text-white dark:data-[state=active]:bg-teal-700 dark:data-[state=active]:text-white"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Holidays
              {holidays.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${tab === "holidays" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {holidays.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notices" className="mt-5 space-y-4">
            <section className="rounded-2xl border border-teal-200/80 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/25 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white">
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
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
                <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />
                <p className="mt-3">Loading official notices…</p>
              </div>
            )}

            {noticesQuery.isError && !notices.length && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{noticesQuery.error?.message}</span>
              </div>
            )}

            {notices.length > 0 && (
              <div className="space-y-2.5">
                {notices.map(notice => (
                  <NoticeCard key={notice.id} notice={notice} onOpen={setSelectedNotice} />
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
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </TabsContent>

          <TabsContent value="holidays" className="mt-5 space-y-3.5">
            {holidaysQuery.isError && !holidays.length && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{holidaysQuery.error?.message}</span>
              </div>
            )}

            <NextHolidayCard
              next={nextHolidayRow}
              hasAny={holidayRows.length > 0}
              refreshing={holidaysQuery.isFetching}
            />

            <HolidaysPanel
              rows={holidayRows}
              nextId={nextHolidayRow?.holiday.id ?? null}
              refreshing={holidaysQuery.isFetching}
            />
          </TabsContent>
        </Tabs>

        {selectedNotice && (
          <NoticeReader notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
        )}
      </main>

      <AppBottomNav />
    </div>
  );
}
