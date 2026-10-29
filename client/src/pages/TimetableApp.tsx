import type { Lecture, TimetableResponse } from "@shared/timetable";
import { AlertCircle, Award, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, CloudOff, Info, LoaderCircle, MapPin, PencilLine, RefreshCw, Search, Sun, UserRound, UserSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { AppBottomNav } from "@/components/AppBottomNav";
import { DailyQuoteStrip } from "@/components/DailyQuoteStrip";
import { FacultyCard } from "@/components/FacultyCard";
import { Expandable } from "@/components/Expandable";
import { NoticeBanner } from "@/components/NoticeBanner";
import { StudentProfileSetup } from "@/components/StudentProfileSetup";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UniversalSearch } from "@/components/UniversalSearch";
import { trpc } from "@/lib/trpc";
import { getStudentProfileDetailFields, isClassRepresentative } from "@/lib/student-profile-display";
import { getPreferredTimetableGroup } from "@/lib/timetable-selection";
import { DAY_ORDER, enrichTimetableWithMentorProfile, formatLectureType, getTimeParts, getDayLabel, getLecturesForDay, getNextLecture, getTodayLectures, getTomorrowLectures, humanizeDuration, lectureStatus, timeToMinutes } from "@/lib/timetable-ui";
import { readStoredStudentProfile, saveStudentProfile as persistStudentProfile } from "@/lib/student-profile-storage";
import { getLectureTypeStyle } from "@/lib/lecture-type-style";
import { BRAND_LOGO_URL } from "@shared/config";
import type { CampusHoliday } from "@shared/campus";
import type { StudentProfile } from "@shared/student-profile";

const SELECTED_GROUP_KEY = "nextlecture:selected-group";
const LOCAL_TIMETABLE_KEY = "nextlecture:last-timetable";

type LocalTimetable = TimetableResponse;
type TimelineItem = { kind: "lecture"; lecture: Lecture } | { kind: "free"; startTime: string };
type CollapsedItem = { kind: "lecture"; lecture: Lecture } | { kind: "freeBlock"; start: string; end: string | null };
type ScheduleView = "today" | "tomorrow" | "week";

function getInitialSelectedGroup() {
  const profileSubsection = readStoredStudentProfile(localStorage)?.subsection ?? null;
  const sharedGroup = new URLSearchParams(window.location.search).get("group")?.trim().toUpperCase();
  return getPreferredTimetableGroup(profileSubsection, sharedGroup ?? null, localStorage.getItem(SELECTED_GROUP_KEY));
}

function safelyReadLocalTimetable() {
  try {
    const raw = localStorage.getItem(LOCAL_TIMETABLE_KEY);
    return raw ? (JSON.parse(raw) as LocalTimetable) : null;
  } catch {
    return null;
  }
}

function safelyReadStudentProfile() {
  return readStoredStudentProfile(localStorage);
}

function getTemporarySectionBranch(group: string | null) {
  const code = (group ?? "").toUpperCase();
  if (/^D\d/.test(code)) return null;
  return (["RAI", "CE", "CS", "EC", "EE", "IT", "ME"] as const).find(branch => code.includes(branch)) ?? null;
}

function greetingForHour(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isHalfDayCategory(category: string) {
  return category.toLowerCase().includes("half");
}

/** Collapse consecutive free slots into one quiet block, kept in chronological order. */
function collapseTimeline(timeline: TimelineItem[]): CollapsedItem[] {
  const items: CollapsedItem[] = [];
  for (const item of timeline) {
    if (item.kind === "lecture") {
      const previous = items[items.length - 1];
      if (previous && previous.kind === "freeBlock" && previous.end == null) previous.end = item.lecture.startTime;
      items.push({ kind: "lecture", lecture: item.lecture });
    } else {
      const previous = items[items.length - 1];
      if (previous && previous.kind === "freeBlock") continue;
      items.push({ kind: "freeBlock", start: item.startTime, end: null });
    }
  }
  return items;
}

function Freshness({ fetchedAt, freshness, updateError }: { fetchedAt?: number; freshness?: "fresh" | "stale"; updateError?: string | null }) {
  if (!fetchedAt) return null;
  const difference = Math.max(0, Math.round((Date.now() - fetchedAt) / 60_000));
  const label = difference < 1 ? "updated just now" : difference < 60 ? `updated ${difference} min ago` : `updated ${Math.round(difference / 60)} hr ago`;
  const stale = Boolean(updateError) || freshness === "stale";
  return (
    <div className={`flex items-center gap-2 text-xs font-medium ${stale ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
      {stale ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
      <span>{stale ? "Using last saved timetable" : `Timetable ${label}`}</span>
    </div>
  );
}

function GroupPicker({
  groups,
  selectedGroup,
  onSelect,
  onClose,
  title = "Select your timetable group",
  eyebrow = "GET STARTED",
}: {
  groups: { code: string; sourceYear: string }[];
  selectedGroup: string | null;
  onSelect: (code: string) => void;
  onClose?: () => void;
  title?: string;
  eyebrow?: string;
}) {
  const [filter, setFilter] = useState("");
  const visibleGroups = groups
    .filter(group => `${group.code} ${group.sourceYear}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.code === "ITB2" ? -1 : b.code === "ITB2" ? 1 : a.code.localeCompare(b.code)));

  return (
    <section className="relative mx-auto w-full max-w-xl rounded-[1.75rem] border border-border bg-card p-6 shadow-xl shadow-stone-950/[0.08] sm:p-8">
      {onClose && (
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close group picker">
          <span className="text-lg leading-none">×</span>
        </button>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-4 pr-8 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">Your choice stays on this device. The available groups are loaded directly from the official GNDEC timetable.</p>
      <label className="relative mt-7 block">
        <span className="sr-only">Search timetable groups</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search groups, for example ITB2" className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" />
      </label>
      <div className="mt-4 max-h-75 overflow-y-auto rounded-xl border border-border p-2">
        <div className="grid grid-cols-1 gap-1.5">
          {visibleGroups.map(group => (
            <button key={group.code} type="button" onClick={() => onSelect(group.code)} className={`flex min-h-13 items-center justify-between rounded-lg px-3 text-left transition hover:bg-teal-50 dark:hover:bg-teal-950/30 ${selectedGroup === group.code ? "bg-teal-50 text-teal-900 dark:bg-teal-950/35 dark:text-teal-100" : "text-foreground"}`}>
              <span className="font-semibold">{group.code}</span>
              <span className="max-w-[56%] text-right text-xs leading-4 text-muted-foreground">{group.sourceYear.replace(/^Year\s+/i, "")}</span>
            </button>
          ))}
          {visibleGroups.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No official timetable group matches that search.</p>}
        </div>
      </div>
    </section>
  );
}

function CompactTime({ time, className = "" }: { time: string; className?: string }) {
  const { clock, meridiem } = getTimeParts(time);
  return (
    <span className={`inline-flex items-baseline gap-0.5 tabular-nums ${className}`.trim()}>
      <span>{clock}</span>
      <span className="text-[0.65em] font-semibold leading-none opacity-75">{meridiem}</span>
    </span>
  );
}

function CompactRange({ startTime, endTime, className = "" }: { startTime: string; endTime: string; className?: string }) {
  return (
    <span className={className}>
      <CompactTime time={startTime} />
      <span className="mx-1 opacity-60">–</span>
      <CompactTime time={endTime} />
    </span>
  );
}

/** Soft banner for a holiday landing today or tomorrow (Android home parity). */
function HolidayBanner({ holiday, whenLabel }: { holiday: CampusHoliday; whenLabel: string }) {
  const halfDay = isHalfDayCategory(holiday.category);
  return (
    <div className={`nl-enter flex items-center gap-3 rounded-2xl border px-4 py-3 ${halfDay ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${halfDay ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-bold tracking-[0.12em] opacity-80">{whenLabel}</p>
        <p className="mt-0.5 truncate font-semibold">{holiday.name}</p>
        <p className="text-xs opacity-75">{halfDay ? "Official half-day holiday" : "Official college holiday — no classes scheduled"}</p>
      </div>
      <Link href="/campus?tab=holidays" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold underline-offset-2 hover:underline">
        Holidays
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/** One quiet block for a run of consecutive free slots. */
function FreeBlock({ start, end }: { start: string; end: string | null }) {
  return (
    <article className="nl-enter flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
      <p className="w-14 shrink-0 text-sm font-bold text-muted-foreground"><CompactTime time={start} /></p>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">Free period</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{end ? <>Until <CompactTime time={end} /></> : "Rest of the timetable"}</p>
      </div>
    </article>
  );
}

/** The single, friendly state for a day with no lectures at all. */
function FreeDayCard({ whenLabel }: { whenLabel: string }) {
  return (
    <article className="nl-enter flex flex-col items-center rounded-2xl border border-dashed border-teal-300/70 bg-teal-50/40 px-6 py-10 text-center dark:border-teal-900 dark:bg-teal-950/20">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
        <Sun className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">You are free {whenLabel}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">No lectures are scheduled. Enjoy the breathing room.</p>
    </article>
  );
}

function ScheduleCard({ lecture, now }: { lecture: Lecture; now: Date }) {
  const status = lectureStatus(lecture, now);
  const typeStyle = getLectureTypeStyle(lecture.lectureType);
  const stateCopy = status === "current" ? "HAPPENING NOW" : status === "past" ? "COMPLETED" : "UP NEXT";
  return (
    <article className={`nl-enter relative overflow-hidden rounded-2xl border p-4 pl-5 transition ${status === "current" ? "border-teal-500 bg-teal-50/75 shadow-md shadow-teal-950/5 dark:border-teal-600 dark:bg-teal-950/35" : status === "past" ? "border-border bg-card/45 opacity-55" : "border-border bg-card"}`}>
      <span className={`absolute inset-y-4 left-0 w-[3px] rounded-full ${typeStyle.edge}`} aria-hidden="true" />
      <div className="flex gap-3">
        <p className="w-14 shrink-0 pt-0.5 text-sm font-bold tracking-[-0.02em] text-muted-foreground"><CompactTime time={lecture.startTime} /></p>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-semibold leading-5 text-foreground">{lecture.subject}</h3>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[0.63rem] font-bold tracking-wide ${status === "current" ? "bg-teal-700 text-white" : status === "past" ? "bg-muted text-muted-foreground" : "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"}`}>{stateCopy}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {typeStyle.label && <span className={`rounded-full px-2 py-0.5 text-[0.63rem] font-bold tracking-wide ${typeStyle.chipOnCard}`}>{typeStyle.label}</span>}
            <p className="text-sm text-muted-foreground"><CompactRange startTime={lecture.startTime} endTime={lecture.endTime} /></p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {lecture.venue && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" /><span className="truncate">{lecture.venue}</span></span>}
            {lecture.teacher && <span className="inline-flex min-w-0 items-center gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" /><span className="truncate">{lecture.teacher}</span></span>}
          </div>
        </div>
      </div>
    </article>
  );
}

function TypeLegend({ lectures }: { lectures: Lecture[] }) {
  const present = new Set(lectures.flatMap(lecture => (lecture.lectureType ? [getLectureTypeStyle(lecture.lectureType).key] : [])));
  if (present.size === 0) return null;
  const legendTypes: Array<{ key: "lecture" | "practical" | "tutorial"; code: string }> = [
    { key: "lecture", code: "L" },
    { key: "practical", code: "P" },
    { key: "tutorial", code: "T" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.66rem] font-semibold text-muted-foreground">
      {legendTypes.filter(({ key }) => present.has(key)).map(({ key, code }) => {
        const typeStyle = getLectureTypeStyle(code);
        return (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`nl-type-dot ${typeStyle.dot}`} aria-hidden="true" />
            {typeStyle.label}
          </span>
        );
      })}
    </div>
  );
}

export default function TimetableApp() {
  const [location] = useLocation();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(getInitialSelectedGroup);
  const [localTimetable, setLocalTimetable] = useState<LocalTimetable | null>(safelyReadLocalTimetable);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(safelyReadStudentProfile);
  const [showProfileSetup, setShowProfileSetup] = useState(() => !safelyReadStudentProfile());
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("today");
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showPicker, setShowPicker] = useState(() => !getInitialSelectedGroup());
  const groupsQuery = trpc.timetable.groups.useQuery(undefined, { staleTime: 60 * 1000, refetchOnMount: "always", retry: 1 });
  const dashboardQuery = trpc.timetable.dashboard.useQuery({ group: selectedGroup ?? "ITB2" }, { enabled: Boolean(selectedGroup), staleTime: 60 * 1000, refetchOnMount: "always", retry: 1 });
  const noticesQuery = trpc.campus.notices.useQuery({ forceRefresh: true }, { staleTime: 0, refetchOnMount: "always", retry: 1 });
  const holidaysQuery = trpc.campus.holidays.useQuery(undefined, { staleTime: 10 * 60 * 1000, refetchOnMount: "always", retry: 1 });
  const refreshMutation = trpc.timetable.refresh.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    if (!dashboardQuery.data) return;
    setLocalTimetable(dashboardQuery.data);
    localStorage.setItem(LOCAL_TIMETABLE_KEY, JSON.stringify(dashboardQuery.data));
  }, [dashboardQuery.data]);

  // Universal search deep links: /app?day=Wednesday jumps to that week day.
  useEffect(() => {
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && (DAY_ORDER as string[]).includes(day)) {
      setScheduleView("week");
      requestAnimationFrame(() => {
        document.getElementById(`week-day-${day}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location]);

  const data = dashboardQuery.data ?? (localTimetable?.timetable.group.code === selectedGroup ? localTimetable : null);
  const groups = groupsQuery.data?.groups ?? (data ? [data.timetable.group] : []);

  // Mentoring cells in the official timetable omit teacher and room. Prefer the
  // mentor name + venue already stored on the student profile for those slots.
  const displayTimetable = useMemo(
    () => enrichTimetableWithMentorProfile(data?.timetable ?? null, studentProfile),
    [data?.timetable, studentProfile],
  );

  // Universal search deep links: /app?group=CODE switches the timetable group.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("group")?.trim().toUpperCase();
    if (shared && groups.some(group => group.code === shared) && shared !== selectedGroup) {
      localStorage.setItem(SELECTED_GROUP_KEY, shared);
      setSelectedGroup(shared);
      setShowPicker(false);
    }
  }, [location, groups, selectedGroup]);

  const todayLectures = useMemo(() => getTodayLectures(displayTimetable, now), [displayTimetable, now]);
  const tomorrow = useMemo(() => { const value = new Date(now); value.setDate(value.getDate() + 1); return value; }, [now]);
  const tomorrowLectures = useMemo(() => getTomorrowLectures(displayTimetable, now), [displayTimetable, now]);
  const dayTimeline = useMemo<TimelineItem[]>(() => (data?.timetable.timeSlots ?? []).flatMap<TimelineItem>(slot => {
    const scheduled = todayLectures.find(lecture => lecture.startTime === slot);
    if (scheduled) return [{ kind: "lecture" as const, lecture: scheduled }];
    const coveredByLongLecture = todayLectures.some(lecture => timeToMinutes(lecture.startTime) < timeToMinutes(slot) && timeToMinutes(lecture.endTime) > timeToMinutes(slot));
    return coveredByLongLecture ? [] : [{ kind: "free" as const, startTime: slot }];
  }), [data?.timetable.timeSlots, todayLectures]);
  const tomorrowTimeline = useMemo<TimelineItem[]>(() => (data?.timetable.timeSlots ?? []).flatMap<TimelineItem>(slot => {
    const scheduled = tomorrowLectures.find(lecture => lecture.startTime === slot);
    if (scheduled) return [{ kind: "lecture" as const, lecture: scheduled }];
    const coveredByLongLecture = tomorrowLectures.some(lecture => timeToMinutes(lecture.startTime) < timeToMinutes(slot) && timeToMinutes(lecture.endTime) > timeToMinutes(slot));
    return coveredByLongLecture ? [] : [{ kind: "free" as const, startTime: slot }];
  }), [data?.timetable.timeSlots, tomorrowLectures]);
  const next = useMemo(() => getNextLecture(displayTimetable, now), [displayTimetable, now]);
  const temporarySectionBranch = useMemo(() => getTemporarySectionBranch(selectedGroup), [selectedGroup]);
  const profileMatchesSelectedBranch = studentProfile?.branch === temporarySectionBranch;
  const firstName = studentProfile && profileMatchesSelectedBranch ? studentProfile.studentName.trim().split(/\s+/)[0] ?? "" : "";

  const activeTimeline = scheduleView === "today" ? dayTimeline : tomorrowTimeline;
  const hasLectureItems = activeTimeline.some(item => item.kind === "lecture");
  const collapsedItems = useMemo(() => collapseTimeline(activeTimeline), [activeTimeline]);
  const holidayToday = useMemo(() => (holidaysQuery.data?.holidays ?? []).find(holiday => holiday.date === localIsoDate(now)) ?? null, [holidaysQuery.data, now]);
  const holidayTomorrow = useMemo(() => (holidaysQuery.data?.holidays ?? []).find(holiday => holiday.date === localIsoDate(tomorrow)) ?? null, [holidaysQuery.data, tomorrow]);
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);

  function chooseGroup(code: string) {
    localStorage.setItem(SELECTED_GROUP_KEY, code);
    setSelectedGroup(code);
    setShowPicker(false);
  }

  function refresh() {
    if (!selectedGroup) return;
    refreshMutation.mutate({ group: selectedGroup }, { onSuccess: result => { setLocalTimetable(result); localStorage.setItem(LOCAL_TIMETABLE_KEY, JSON.stringify(result)); utils.timetable.dashboard.invalidate({ group: selectedGroup }); } });
  }

  function saveStudentProfile(profile: StudentProfile) {
    persistStudentProfile(localStorage, profile);
    const subsection = profile.subsection.trim().toUpperCase();
    if (subsection) {
      localStorage.setItem(SELECTED_GROUP_KEY, subsection);
      setSelectedGroup(subsection);
      setShowPicker(false);
    }
    setStudentProfile(profile);
    setShowProfileSetup(false);
    setIsProfileExpanded(false);
  }

  const heroTypeStyle = next ? getLectureTypeStyle(next.lecture.lectureType) : null;
  const heroTypeLabel = next ? formatLectureType(next.lecture.lectureType) : null;

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]">
      <header className="app-topbar">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="NextLecture home">
              <img src={BRAND_LOGO_URL} alt="NextLecture timetable logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" />
            </Link>
            <div>
              <Link href="/" className="font-display text-lg font-semibold tracking-[-0.04em]">NextLecture</Link>
              <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">GNDEC TIMETABLE</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UniversalSearch timetable={data} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-5xl pt-4 app-bottom-clearance sm:pt-5">
        {!isOnline && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong>You’re offline.</strong> Showing your last saved timetable where available.</span>
          </div>
        )}

        {temporarySectionBranch && (!profileMatchesSelectedBranch || showProfileSetup) && (
          <StudentProfileSetup branch={temporarySectionBranch} onSaved={saveStudentProfile} onDismiss={() => setShowProfileSetup(false)} />
        )}

        {(holidayToday || holidayTomorrow) && (
          <div className="mb-4 grid grid-cols-1 gap-2">
            {holidayToday && <HolidayBanner holiday={holidayToday} whenLabel={isHalfDayCategory(holidayToday.category) ? "HALF DAY · TODAY" : "HOLIDAY · TODAY"} />}
            {holidayTomorrow && <HolidayBanner holiday={holidayTomorrow} whenLabel={isHalfDayCategory(holidayTomorrow.category) ? "HALF DAY · TOMORROW" : "HOLIDAY · TOMORROW"} />}
          </div>
        )}

        <NoticeBanner notices={noticesQuery.data?.notices ?? []} className="mb-4" />
        <AnnouncementBanner className="mb-4" />

        {data?.updateError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong>Couldn’t update the latest timetable.</strong> Your last working timetable is still available.</span>
          </div>
        )}

        {dashboardQuery.isError && !data && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/25">
            <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">We couldn’t load this group.</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">The group may have changed in the official source. Choose another group or fetch again.</p>
            <button type="button" onClick={() => setShowPicker(true)} className="mt-4 text-sm font-bold text-teal-700 underline underline-offset-4 dark:text-teal-300">Change timetable group</button>
          </div>
        )}

        {!data && dashboardQuery.isLoading && (
          <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-700" aria-hidden="true" />
            <p className="mt-4 font-semibold">Preparing your timetable</p>
            <p className="mt-1 text-sm text-muted-foreground">Loading {selectedGroup} from the official source.</p>
          </section>
        )}

        {data && (
          <>
            {/* Greeting + group / sync controls — the Android status row, web-native. */}
            <section className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{dateLabel.toUpperCase()}</p>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
                  {greetingForHour(now)}{firstName ? `, ${firstName}` : ""}.
                </h1>
                <div className="mt-2">
                  <Freshness fetchedAt={data.fetchedAt} freshness={dashboardQuery.data?.freshness ?? "fresh"} updateError={data.updateError ?? (dashboardQuery.isError ? "Could not refresh" : null)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="app-header-button"
                  aria-label="Change timetable section"
                >
                  {selectedGroup}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={refreshMutation.isPending || !isOnline}
                  className="app-header-button"
                  aria-label="Refresh timetable"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* Hero: next lecture, happening now, or a clear day. */}
            {next ? (
              <section className="nl-enter mb-4 rounded-[1.5rem] bg-teal-700 p-4 text-white shadow-xl shadow-teal-950/15 sm:rounded-[1.75rem] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.68rem] font-bold tracking-[0.15em] text-teal-100">{next.phase === "current" ? "HAPPENING NOW" : "NEXT LECTURE"}</p>
                  <span className={`rounded-full bg-white/13 px-2.5 py-1 text-xs font-semibold ${next.phase !== "current" && next.dayOffset === 0 ? "text-orange-300" : "text-teal-50"}`}>
                    {next.phase === "current"
                      ? `Ends in ${humanizeDuration(Math.max(0, timeToMinutes(next.lecture.endTime) - (now.getHours() * 60 + now.getMinutes())))}`
                      : next.dayOffset === 0
                        ? `Starts in ${humanizeDuration(Math.max(0, timeToMinutes(next.lecture.startTime) - (now.getHours() * 60 + now.getMinutes())))}`
                        : getDayLabel(next.dayOffset, now)}
                  </span>
                </div>
                <h2 className="mt-3.5 font-display text-[1.65rem] font-semibold leading-none tracking-[-0.055em] sm:text-3xl">{next.lecture.subject}</h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {heroTypeLabel && heroTypeStyle && <span className={`rounded-full px-2.5 py-1 text-[0.66rem] font-bold tracking-wide ${heroTypeStyle.chipOnTeal}`}>{heroTypeLabel}</span>}
                  <p className="text-sm font-semibold text-teal-100/90">{next.phase === "current" ? "Now" : getDayLabel(next.dayOffset, now)} · <CompactRange startTime={next.lecture.startTime} endTime={next.lecture.endTime} /></p>
                </div>
                <div className="mt-3.5 grid gap-2 border-t border-white/15 pt-3.5 sm:grid-cols-2">
                  {next.lecture.venue && <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 shrink-0 text-teal-200" aria-hidden="true" /><span className="truncate">{next.lecture.venue}</span></p>}
                  {next.lecture.teacher && <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-teal-100"><UserRound className="h-4 w-4 shrink-0 text-teal-200" aria-hidden="true" /><span className="truncate">{next.lecture.teacher}</span></p>}
                </div>
              </section>
            ) : (
              <section className="nl-enter mb-4 rounded-[1.5rem] border border-dashed border-teal-300/70 bg-teal-50/40 px-6 py-10 text-center dark:border-teal-900 dark:bg-teal-950/20 sm:rounded-[1.75rem]">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  <Sun className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">A clear day ahead</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">No upcoming lecture is scheduled. Your timetable will be ready when the next class comes around.</p>
              </section>
            )}

            {/* Quote of the day — quiet strip under the hero, same ZenQuotes feed as the Android app. */}
            <DailyQuoteStrip className="mb-4" />

            {/* Schedule: today / tomorrow / full week, color-coded by lecture type. */}
            <section className="mb-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold tracking-[-0.035em]">
                      {scheduleView === "today" ? "Today’s timetable" : scheduleView === "tomorrow" ? "Tomorrow’s timetable" : "This week’s timetable"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scheduleView === "today"
                        ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(now)
                        : scheduleView === "tomorrow"
                          ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(tomorrow)
                          : "Monday to Friday"}
                    </p>
                  </div>
                </div>
                <div className="nl-segment" role="tablist" aria-label="Schedule view">
                  <button type="button" role="tab" aria-selected={scheduleView === "today"} data-active={scheduleView === "today"} onClick={() => setScheduleView("today")} className="nl-segment-button">Today</button>
                  <button type="button" role="tab" aria-selected={scheduleView === "tomorrow"} data-active={scheduleView === "tomorrow"} onClick={() => setScheduleView("tomorrow")} className="nl-segment-button">Tomorrow</button>
                  <button type="button" role="tab" aria-selected={scheduleView === "week"} data-active={scheduleView === "week"} onClick={() => setScheduleView("week")} className="nl-segment-button">Full week</button>
                </div>
              </div>

              {scheduleView !== "week" && (
                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5">
                  <TypeLegend lectures={scheduleView === "today" ? todayLectures : tomorrowLectures} />
                  {hasLectureItems && (
                    <p className="shrink-0 text-xs font-bold text-muted-foreground">
                      {(scheduleView === "today" ? todayLectures : tomorrowLectures).length} {(scheduleView === "today" ? todayLectures : tomorrowLectures).length === 1 ? "class" : "classes"}
                    </p>
                  )}
                </div>
              )}

              {scheduleView !== "week" ? (
                <div className="mt-5 space-y-2.5">
                  {activeTimeline.length === 0 ? (
                    <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center">
                      <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-3 font-semibold">No timetable slots {scheduleView === "today" ? "today" : "tomorrow"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Enjoy the breathing room.</p>
                    </div>
                  ) : !hasLectureItems ? (
                    <FreeDayCard whenLabel={scheduleView === "today" ? "today" : "tomorrow"} />
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {collapsedItems.map(item => item.kind === "lecture" ? (
                        <ScheduleCard key={`${item.lecture.day}-${item.lecture.startTime}-${item.lecture.subject}`} lecture={item.lecture} now={now} />
                      ) : (
                        <FreeBlock key={`free-${item.start}`} start={item.start} end={item.end} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {DAY_ORDER.map(day => {
                    const lectures = getLecturesForDay(displayTimetable, day);
                    return (
                      <section key={day} id={`week-day-${day}`} className="scroll-mt-24 rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-display text-base font-semibold tracking-[-0.035em]">{day}</h3>
                          <span className="text-xs font-bold text-muted-foreground">{lectures.length} {lectures.length === 1 ? "class" : "classes"}</span>
                        </div>
                        {lectures.length ? (
                          <div className="mt-3 space-y-2">
                            {lectures.map(lecture => <ScheduleCard key={`${day}-${lecture.startTime}-${lecture.subject}`} lecture={lecture} now={now} />)}
                          </div>
                        ) : (
                          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            <Sun className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                            Free day — no scheduled classes.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            {/* College faculty directory — every teacher, Android parity. */}
            <Link href="/faculty" className="nl-enter group mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-teal-700/25 hover:shadow-md sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                <UserSearch className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">Faculty members</span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">Teacher profiles, contacts and live timetables</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>

            {/* Faculty: mentor and class coordinator from the official record. */}
            {studentProfile && profileMatchesSelectedBranch && !showProfileSetup && (
              <FacultyCard profile={studentProfile} className="mb-4" />
            )}

            {/* Student profile strip — collapsed by default to keep the page calm. */}
            {studentProfile && profileMatchesSelectedBranch && !showProfileSetup && (
              <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <button type="button" aria-expanded={isProfileExpanded} aria-controls="full-student-profile" onClick={() => setIsProfileExpanded(current => !current)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{studentProfile.studentName}</span>
                      {isClassRepresentative(studentProfile) && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.06em] text-white shadow-sm shadow-amber-900/20">
                          <Award className="h-3 w-3" aria-hidden="true" />
                          CR
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">CRN {studentProfile.crn}{studentProfile.subsection ? ` · ${studentProfile.subsection}` : studentProfile.section ? ` · ${studentProfile.section}` : ""}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out ${isProfileExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <Expandable open={isProfileExpanded} id="full-student-profile">
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href="/attendance" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-200"><ClipboardCheck className="h-4 w-4" aria-hidden="true" />View attendance</Link>
                      <button type="button" onClick={() => setShowProfileSetup(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3.5 text-sm font-bold text-teal-700 transition hover:border-teal-700/30 dark:text-teal-300"><PencilLine className="h-4 w-4" aria-hidden="true" />Update profile</button>
                    </div>
                    <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {getStudentProfileDetailFields(studentProfile).map(({ label, value }) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
                          <dd className="mt-1 break-words font-medium">{value || "Not provided"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Expandable>
              </section>
            )}
          </>
        )}

        {groupsQuery.isLoading && !localTimetable && (
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-9 text-center">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-700" aria-hidden="true" />
            <p className="mt-4 font-medium">Loading the official timetable groups…</p>
            <p className="mt-1 text-sm text-muted-foreground">This only takes a moment.</p>
          </div>
        )}

        {groupsQuery.isError && !localTimetable && (
          <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900/60 dark:bg-amber-950/25">
            <AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.045em]">The official timetable is unavailable.</h1>
            <p className="mt-2 leading-7 text-muted-foreground">We couldn’t load a valid timetable yet. Please check your connection and try again.</p>
            <button type="button" onClick={() => groupsQuery.refetch()} className="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.97]">Try again</button>
          </div>
        )}

        {!groupsQuery.isLoading && !groupsQuery.isError && !selectedGroup && (
          <GroupPicker groups={groups} selectedGroup={selectedGroup} onSelect={chooseGroup} />
        )}

        {selectedGroup && showPicker && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-[2px] sm:items-center sm:py-10"
            role="dialog"
            aria-modal="true"
            aria-label="Change timetable group"
            onClick={() => setShowPicker(false)}
          >
            <div className="nl-enter w-full max-w-xl" onClick={event => event.stopPropagation()}>
              <GroupPicker
                groups={groups}
                selectedGroup={selectedGroup}
                onSelect={chooseGroup}
                onClose={() => setShowPicker(false)}
                eyebrow="CHANGE GROUP"
                title="Choose your timetable group"
              />
            </div>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <a href="https://lsgz.vercel.app" target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline decoration-teal-400 underline-offset-2 transition hover:text-teal-950 dark:text-teal-300 dark:hover:text-white">Built and maintained by LSGZ</a>
        </p>
      </main>

      <AppBottomNav />
    </div>
  );
}
