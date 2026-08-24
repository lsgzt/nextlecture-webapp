import type { Lecture, TimetableResponse } from "@shared/timetable";
import { AlertCircle, ArrowLeft, BookOpenText, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, CloudOff, ExternalLink, FileText, Info, LoaderCircle, MapPin, PencilLine, RefreshCw, Route, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StudentProfileSetup } from "@/components/StudentProfileSetup";
import { trpc } from "@/lib/trpc";
import { getStudentProfileDetailFields, getStudentProfileSubtitle } from "@/lib/student-profile-display";
import { getPreferredTimetableGroup } from "@/lib/timetable-selection";
import { deriveGroupParts, formatRange, getDayLabel, getNextLecture, getTodayLectures, humanizeDuration, lectureStatus, timeToMinutes } from "@/lib/timetable-ui";
import { readStoredStudentProfile, saveStudentProfile as persistStudentProfile } from "@/lib/student-profile-storage";
import { BRAND_LOGO_URL } from "@shared/config";
import type { StudentProfile } from "@shared/student-profile";

const SELECTED_GROUP_KEY = "nextlecture:selected-group";
const LOCAL_TIMETABLE_KEY = "nextlecture:last-timetable";

type LocalTimetable = TimetableResponse;
type TimelineItem = { kind: "lecture"; lecture: Lecture } | { kind: "free"; startTime: string };

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

function Freshness({ fetchedAt, freshness, updateError }: { fetchedAt?: number; freshness?: "fresh" | "stale"; updateError?: string | null }) {
  if (!fetchedAt) return null;
  const difference = Math.max(0, Math.round((Date.now() - fetchedAt) / 60_000));
  const label = difference < 1 ? "updated just now" : `updated ${difference} min ago`;
  const stale = freshness === "stale" || Boolean(updateError);
  return <div className={`flex items-center gap-2 text-xs font-medium ${stale ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{stale ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}<span>{stale ? "Using last saved timetable" : `Timetable ${label}`}</span></div>;
}

function GroupPicker({ groups, selectedGroup, onSelect }: { groups: { code: string; sourceYear: string }[]; selectedGroup: string | null; onSelect: (code: string) => void }) {
  const [filter, setFilter] = useState("");
  const visibleGroups = groups.filter(group => `${group.code} ${group.sourceYear}`.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => (a.code === "ITB2" ? -1 : b.code === "ITB2" ? 1 : a.code.localeCompare(b.code)));
  return <section className="mx-auto w-full max-w-xl rounded-[1.75rem] border border-border bg-card p-6 shadow-xl shadow-stone-950/[0.05] sm:p-8"><p className="eyebrow">GET STARTED</p><h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Select your timetable group</h1><p className="mt-3 leading-7 text-muted-foreground">Your choice stays on this device. The available groups are loaded directly from the official GNDEC timetable.</p><label className="relative mt-7 block"><span className="sr-only">Search timetable groups</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search groups, for example ITB2" className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /></label><div className="mt-4 max-h-75 overflow-y-auto rounded-xl border border-border p-2"><div className="grid gap-1.5">{visibleGroups.map(group => <button key={group.code} type="button" onClick={() => onSelect(group.code)} className={`flex min-h-13 items-center justify-between rounded-lg px-3 text-left transition hover:bg-teal-50 dark:hover:bg-teal-950/30 ${selectedGroup === group.code ? "bg-teal-50 text-teal-900 dark:bg-teal-950/35 dark:text-teal-100" : "text-foreground"}`}><span className="font-semibold">{group.code}</span><span className="max-w-[56%] text-right text-xs leading-4 text-muted-foreground">{group.sourceYear.replace(/^Year\s+/i, "")}</span></button>)}{visibleGroups.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No official timetable group matches that search.</p>}</div></div></section>;
}

function ScheduleCard({ lecture, now }: { lecture: NonNullable<LocalTimetable>["timetable"]["lectures"][number]; now: Date }) {
  const status = lectureStatus(lecture, now);
  const stateCopy = status === "current" ? "HAPPENING NOW" : status === "past" ? "COMPLETED" : "UP NEXT";
  return <article className={`relative rounded-2xl border p-4 transition ${status === "current" ? "border-teal-500 bg-teal-50/75 shadow-md shadow-teal-950/5 dark:border-teal-600 dark:bg-teal-950/35" : status === "past" ? "border-border bg-card/45 opacity-55" : "border-border bg-card"}`}><div className="flex gap-3"><p className="w-14 shrink-0 pt-0.5 text-sm font-bold tracking-[-0.02em] text-muted-foreground">{lecture.startTime}</p><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-5 text-foreground">{lecture.subject}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[0.63rem] font-bold tracking-wide ${status === "current" ? "bg-teal-700 text-white" : status === "past" ? "bg-muted text-muted-foreground" : "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"}`}>{stateCopy}</span></div><p className="mt-1.5 text-sm text-muted-foreground">{formatRange(lecture)}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">{lecture.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />{lecture.venue}</span>}{lecture.teacher && <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />{lecture.teacher}</span>}</div></div></div></article>;
}

export default function TimetableApp() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(getInitialSelectedGroup);
  const [localTimetable, setLocalTimetable] = useState<LocalTimetable | null>(safelyReadLocalTimetable);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(safelyReadStudentProfile);
  const [showProfileSetup, setShowProfileSetup] = useState(() => !safelyReadStudentProfile());
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showPicker, setShowPicker] = useState(() => !getInitialSelectedGroup());
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const groupsQuery = trpc.timetable.groups.useQuery(undefined, { staleTime: 20 * 60 * 1000, retry: 1 });
  const dashboardQuery = trpc.timetable.dashboard.useQuery({ group: selectedGroup ?? "ITB2" }, { enabled: Boolean(selectedGroup), staleTime: 20 * 60 * 1000, retry: 1 });
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

  const data = dashboardQuery.data ?? (localTimetable?.timetable.group.code === selectedGroup ? localTimetable : null);
  const groups = groupsQuery.data?.groups ?? (data ? [data.timetable.group] : []);

  useEffect(() => {
    if (!groups.length) return;
    const saved = selectedGroup ? groups.find(group => group.code === selectedGroup) : null;
    const starting = saved ?? groups.find(group => group.code === "ITB2") ?? groups[0];
    if (!selectedYear) setSelectedYear(starting.sourceYear);
    if (!selectedBranch) setSelectedBranch(deriveGroupParts(starting.code).branch);
  }, [groups, selectedGroup, selectedBranch, selectedYear]);

  const availableYears = useMemo(() => Array.from(new Set(groups.map(group => group.sourceYear))), [groups]);
  const groupsInYear = useMemo(() => groups.filter(group => group.sourceYear === selectedYear), [groups, selectedYear]);
  const availableBranches = useMemo(() => Array.from(new Set(groupsInYear.map(group => deriveGroupParts(group.code).branch))), [groupsInYear]);
  const availableSections = useMemo(() => groupsInYear.filter(group => deriveGroupParts(group.code).branch === selectedBranch), [groupsInYear, selectedBranch]);
  const todayLectures = useMemo(() => getTodayLectures(data?.timetable ?? null, now), [data?.timetable, now]);
  const dayTimeline = useMemo<TimelineItem[]>(() => (data?.timetable.timeSlots ?? []).flatMap<TimelineItem>(slot => {
    const scheduled = todayLectures.find(lecture => lecture.startTime === slot);
    if (scheduled) return [{ kind: "lecture" as const, lecture: scheduled }];
    const coveredByLongLecture = todayLectures.some(lecture => timeToMinutes(lecture.startTime) < timeToMinutes(slot) && timeToMinutes(lecture.endTime) > timeToMinutes(slot));
    return coveredByLongLecture ? [] : [{ kind: "free" as const, startTime: slot }];
  }), [data?.timetable.timeSlots, todayLectures]);
  const next = useMemo(() => getNextLecture(data?.timetable ?? null, now), [data?.timetable, now]);
  const temporarySectionBranch = useMemo(() => getTemporarySectionBranch(selectedGroup), [selectedGroup]);
  const profileMatchesSelectedBranch = studentProfile?.branch === temporarySectionBranch;

  function chooseGroup(code: string) {
    const selected = groups.find(group => group.code === code);
    if (selected) {
      setSelectedYear(selected.sourceYear);
      setSelectedBranch(deriveGroupParts(selected.code).branch);
    }
    localStorage.setItem(SELECTED_GROUP_KEY, code);
    setSelectedGroup(code);
    setShowPicker(false);
  }

  function changeYear(value: string) {
    const first = groups.find(group => group.sourceYear === value);
    setSelectedYear(value);
    if (first) { setSelectedBranch(deriveGroupParts(first.code).branch); chooseGroup(first.code); }
  }

  function changeBranch(value: string) {
    const first = groupsInYear.find(group => deriveGroupParts(group.code).branch === value);
    setSelectedBranch(value);
    if (first) chooseGroup(first.code);
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

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]"><header className="app-topbar"><div className="container flex h-17 items-center justify-between"><div className="flex items-center gap-3"><Link href="/" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300" aria-label="Back to NextLecture home"><ArrowLeft className="h-4 w-4" /></Link><img src={BRAND_LOGO_URL} alt="NextLecture timetable logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" /><div><Link href="/" className="font-display text-lg font-semibold tracking-[-0.04em]">NextLecture</Link><p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">GNDEC TIMETABLE</p></div></div><div className="flex items-center gap-1.5 sm:gap-2"><Link href="/papers" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:hover:border-teal-900 dark:hover:bg-teal-950/35 dark:hover:text-teal-300 sm:hidden" aria-label="Open Previous Year Papers"><FileText className="h-4 w-4" /></Link><Link href="/papers" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 sm:inline-flex">Previous papers</Link><Link href="/syllabus" className="grid h-9 w-9 place-items-center rounded-xl border border-teal-200 bg-teal-50 text-teal-700 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-300 sm:hidden" aria-label="Open Syllabus AI"><BookOpenText className="h-4 w-4" /></Link><Link href="/syllabus" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-50 hover:text-teal-950 dark:text-teal-300 dark:hover:bg-teal-950/40 dark:hover:text-white sm:inline-flex">Syllabus AI</Link><ThemeToggle /></div></div></header><main className="container max-w-5xl pb-14 pt-7 sm:pt-10">
    {!isOnline && <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"><CloudOff className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>You’re offline.</strong> Showing your last saved timetable where available.</span></div>}
    {groupsQuery.isLoading && !localTimetable && <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-9 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-700" /><p className="mt-4 font-medium">Loading the official timetable groups…</p><p className="mt-1 text-sm text-muted-foreground">This only takes a moment.</p></div>}
    {groupsQuery.isError && !localTimetable && <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900/60 dark:bg-amber-950/25"><AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" /><h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.045em]">The official timetable is unavailable.</h1><p className="mt-2 leading-7 text-muted-foreground">We couldn’t load a valid timetable yet. Please check your connection and try again.</p><button type="button" onClick={() => groupsQuery.refetch()} className="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.97]">Try again</button></div>}
    {!groupsQuery.isLoading && !groupsQuery.isError && (!selectedGroup || showPicker) && <GroupPicker groups={groups} selectedGroup={selectedGroup} onSelect={chooseGroup} />}
    {selectedGroup && !showPicker && <div className="space-y-6">
      {temporarySectionBranch && (!profileMatchesSelectedBranch || showProfileSetup) && <StudentProfileSetup branch={temporarySectionBranch} onSaved={saveStudentProfile} onDismiss={() => setShowProfileSetup(false)} />}
      {studentProfile && profileMatchesSelectedBranch && !showProfileSetup && <section className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"><UserRound className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-semibold">{studentProfile.studentName}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">{getStudentProfileSubtitle(studentProfile)}</p></div></div><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><Link href="/attendance" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-200"><ClipboardCheck className="h-4 w-4" />View attendance</Link><button type="button" aria-expanded={isProfileExpanded} aria-controls="full-student-profile" onClick={() => setIsProfileExpanded(current => !current)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white"><ChevronDown className={`h-4 w-4 transition ${isProfileExpanded ? "rotate-180" : ""}`} />{isProfileExpanded ? "Hide your full information" : "View your full information"}</button><button type="button" onClick={() => setShowProfileSetup(true)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white"><PencilLine className="h-4 w-4" />Update profile</button></div></div>{isProfileExpanded && <dl id="full-student-profile" className="mt-4 grid gap-x-5 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{getStudentProfileDetailFields(studentProfile).map(({ label, value }) => <div key={label} className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Not provided"}</dd></div>)}</dl>}</section>}
      <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7"><div><button type="button" onClick={() => setShowPicker(true)} className="group inline-flex items-center gap-1 rounded-lg py-1 font-display text-2xl font-semibold tracking-[-0.05em] text-foreground transition hover:text-teal-700 dark:hover:text-teal-300">{selectedGroup}<ChevronDown className="h-4 w-4 transition group-hover:translate-y-0.5" /></button><h1 className="mt-1 font-display text-[1.9rem] font-semibold tracking-[-0.055em] sm:text-4xl">{greeting}<span aria-hidden="true">.</span></h1><div className="mt-2"><Freshness fetchedAt={data?.fetchedAt ?? localTimetable?.fetchedAt} freshness={data?.freshness ?? "stale"} updateError={data?.updateError} /></div></div><button type="button" onClick={refresh} disabled={refreshMutation.isPending || !isOnline} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:border-teal-700/30 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-teal-300"><RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />{refreshMutation.isPending ? "Fetching timetable…" : "Fetch again"}</button></section>
      {data?.updateError && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Couldn’t update the latest timetable.</strong> Your last working timetable is still available.</span></div>}
      {dashboardQuery.isError && !data && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/25"><AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" /><h2 className="mt-3 font-semibold">We couldn’t load this group.</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">The group may have changed in the official source. Choose another group or fetch again.</p><button type="button" onClick={() => setShowPicker(true)} className="mt-4 text-sm font-bold text-teal-700 underline underline-offset-4 dark:text-teal-300">Change timetable group</button></div>}
      {!data && dashboardQuery.isLoading && <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-700" /><p className="mt-4 font-semibold">Preparing your timetable</p><p className="mt-1 text-sm text-muted-foreground">Loading {selectedGroup} from the official source.</p></section>}
      {data && <>
        <section className="rounded-[1.75rem] bg-teal-700 p-5 text-white shadow-xl shadow-teal-950/15 sm:p-7"><div className="flex items-start justify-between gap-3"><p className="text-[0.68rem] font-bold tracking-[0.15em] text-teal-100">{next?.phase === "current" ? "HAPPENING NOW" : "NEXT LECTURE"}</p><span className="rounded-full bg-white/13 px-2.5 py-1 text-xs font-semibold text-teal-50">{next ? (next.phase === "current" ? `Ends in ${humanizeDuration(Math.max(0, timeToMinutes(next.lecture.endTime) - (now.getHours() * 60 + now.getMinutes())))}` : next.dayOffset === 0 ? `Starts in ${humanizeDuration(Math.max(0, timeToMinutes(next.lecture.startTime) - (now.getHours() * 60 + now.getMinutes())))}` : getDayLabel(next.dayOffset, now)) : "No more lectures"}</span></div>{next ? <><h2 className="mt-7 font-display text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">{next.lecture.subject}</h2><p className="mt-3 font-medium text-teal-100">{next.phase === "current" ? "Now" : getDayLabel(next.dayOffset, now)} · {formatRange(next.lecture)}</p><div className="mt-7 grid gap-3 border-t border-white/15 pt-4 sm:grid-cols-2">{next.lecture.venue && <p className="inline-flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-teal-200" />{next.lecture.venue}</p>}{next.lecture.teacher && <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-100"><UserRound className="h-4 w-4 text-teal-200" />{next.lecture.teacher}</p>}</div></> : <><h2 className="mt-7 font-display text-3xl font-semibold tracking-[-0.055em]">No more lectures today.</h2><p className="mt-3 text-teal-100">Your timetable will be ready when the next class comes around.</p></>}</section>
        <section className="grid gap-5 lg:grid-cols-[1.55fr_1fr]"><div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"><CalendarDays className="h-4 w-4" /></span><div><p className="font-display text-xl font-semibold tracking-[-0.04em]">Today’s timetable</p><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(now)}</p></div></div><div className="mt-6 space-y-3">{dayTimeline.length ? dayTimeline.map(item => item.kind === "lecture" ? <ScheduleCard key={`${item.lecture.day}-${item.lecture.startTime}-${item.lecture.subject}`} lecture={item.lecture} now={now} /> : <article key={item.startTime} className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4"><p className="w-14 shrink-0 text-sm font-bold text-muted-foreground">{item.startTime}</p><div><p className="font-semibold text-muted-foreground">Free period</p><p className="mt-1 text-sm text-muted-foreground">No lecture scheduled</p></div></article>) : <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center"><Clock3 className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 font-semibold">No timetable slots today</p><p className="mt-1 text-sm text-muted-foreground">Enjoy the breathing room.</p></div>}</div></div><aside className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"><Route className="h-4 w-4" /></span><div><p className="font-display text-xl font-semibold tracking-[-0.04em]">Your group</p><p className="text-sm text-muted-foreground">Update it anytime</p></div></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Semester / cohort<select value={selectedYear} onChange={event => changeYear(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10">{availableYears.map(year => <option key={year} value={year}>{year.replace(/^Year\s+/i, "")}</option>)}</select></label><label className="block text-sm font-semibold">Branch<select value={selectedBranch} onChange={event => changeBranch(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10">{availableBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label><label className="block text-sm font-semibold">Section<select value={selectedGroup} onChange={event => chooseGroup(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10">{availableSections.map(group => <option key={group.code} value={group.code}>{deriveGroupParts(group.code).section} · {group.code}</option>)}</select></label></div><button type="button" onClick={() => setShowPicker(true)} className="mt-6 inline-flex text-sm font-bold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white">Search every timetable group</button></aside></section>
      </>}
    </div>}
  </main></div>;
}
