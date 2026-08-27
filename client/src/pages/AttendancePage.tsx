import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, Info, LoaderCircle, MapPin, Target, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import type { AttendanceHistory, AttendanceLeaderboard as AttendanceLeaderboardData, AttendanceLeaderboardScope, AttendanceRecord, AttendanceRecordInput, AttendanceStatus } from "@shared/attendance";
import { BRAND_LOGO_URL } from "@shared/config";
import type { StudentProfile } from "@shared/student-profile";
import type { TimetableResponse, Weekday } from "@shared/timetable";
import { AttendanceLeaderboard } from "@/components/AttendanceLeaderboard";
import { AttendanceControls } from "@/components/AttendanceControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { AttendanceApiError, DEFAULT_LEADERBOARD_SCOPE, calculateAttendanceSummary, createAttendanceClient, formatLocalAttendanceDate, getAttendanceProfileScope, readAttendanceTarget, saveAttendanceTarget, shouldApplyLeaderboardResponse } from "@/lib/attendance";
import { readStoredStudentProfile, saveStudentProfile } from "@/lib/student-profile-storage";
import { DAY_ORDER, formatRange } from "@/lib/timetable-ui";
import { trpc } from "@/lib/trpc";

const LOCAL_TIMETABLE_KEY = "nextlecture:last-timetable";

function readCachedTimetable() {
  try {
    const raw = localStorage.getItem(LOCAL_TIMETABLE_KEY);
    return raw ? JSON.parse(raw) as TimetableResponse : null;
  } catch {
    return null;
  }
}

function historyBounds(today: string) {
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - 364);
  return { from: formatLocalAttendanceDate(from), to: today };
}

function weekdayFor(date: Date): Weekday | null {
  const day = date.getDay();
  return day >= 1 && day <= 5 ? DAY_ORDER[day - 1] : null;
}

function localRecordFromInput(input: AttendanceRecordInput): AttendanceRecord {
  const now = new Date().toISOString();
  return { attendance_date: input.attendanceDate, lecture_key: input.lectureKey, status: input.status, subject: input.subject, teacher: input.teacher || null, venue: input.venue || null, start_minutes: input.startMinutes, end_minutes: input.endMinutes, created_at: now, updated_at: now };
}

export default function AttendancePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(() => readStoredStudentProfile(localStorage));
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);
  const [today] = useState(() => formatLocalAttendanceDate(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [target, setTarget] = useState(() => readAttendanceTarget(localStorage));
  const [history, setHistory] = useState<AttendanceHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyScope, setHistoryScope] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [leaderboardScope, setLeaderboardScope] = useState<AttendanceLeaderboardScope>(DEFAULT_LEADERBOARD_SCOPE);
  const [leaderboard, setLeaderboard] = useState<AttendanceLeaderboardData | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardRetryAt, setLeaderboardRetryAt] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const targetRef = useRef(target);
  const activeProfileScopeRef = useRef("");
  const historyRequestRef = useRef(0);
  const leaderboardRequestRef = useRef(0);
  const client = useMemo(() => createAttendanceClient({ storage: localStorage }), []);
  const profileGroup = profile?.subsection.trim().toUpperCase() ?? "";
  const profileScope = profile ? getAttendanceProfileScope(profile) : "";
  activeProfileScopeRef.current = profileScope;
  const androidIdentityInput = useMemo(() => ({
    crn: profile?.crn ?? "000000",
    branch: profile?.branch ?? "XX",
    studentName: profile?.studentName ?? "Unknown student",
    subsection: profileGroup || "XX",
  }), [profile?.branch, profile?.crn, profile?.studentName, profileGroup]);
  const needsAndroidIdentityRecovery = Boolean(profile && !profile.registrationNumber && /^\d{6,16}$/.test(profile.crn));
  const androidIdentityQuery = trpc.temporarySections.androidRegistration.useQuery(androidIdentityInput, { enabled: needsAndroidIdentityRecovery, retry: 0, staleTime: 6 * 60 * 60 * 1000 });
  const attendanceIdentityReady = !needsAndroidIdentityRecovery || androidIdentityQuery.isError || (androidIdentityQuery.isSuccess && !androidIdentityQuery.data.registrationNumber);
  const dashboardQuery = trpc.timetable.dashboard.useQuery({ group: profileGroup || "ITB2" }, { enabled: Boolean(profileGroup), staleTime: 20 * 60 * 1000, retry: 1 });
  const cachedTimetable = useMemo(readCachedTimetable, []);
  const timetable = dashboardQuery.data?.timetable ?? (cachedTimetable?.timetable.group.code === profileGroup ? cachedTimetable.timetable : null);
  const bounds = useMemo(() => historyBounds(today), [today]);

  useEffect(() => { targetRef.current = target; }, [target]);

  useEffect(() => {
    function refreshSavedProfile() {
      const nextProfile = readStoredStudentProfile(localStorage);
      const nextScope = nextProfile ? getAttendanceProfileScope(nextProfile) : "";
      if (nextScope === activeProfileScopeRef.current) return;
      historyRequestRef.current += 1;
      setProfile(nextProfile);
      setHistory(null);
      setHistoryScope("");
      setHistoryError(null);
      setIdentityMessage(null);
      setIsLoadingHistory(false);
      leaderboardRequestRef.current += 1;
      setLeaderboardScope(DEFAULT_LEADERBOARD_SCOPE);
      setLeaderboard(null);
      setLeaderboardError(null);
      setIsLoadingLeaderboard(false);
      setLeaderboardRetryAt(0);
    }
    window.addEventListener("focus", refreshSavedProfile);
    window.addEventListener("storage", refreshSavedProfile);
    return () => {
      window.removeEventListener("focus", refreshSavedProfile);
      window.removeEventListener("storage", refreshSavedProfile);
    };
  }, []);

  useEffect(() => {
    const updateNetworkState = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);
    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  useEffect(() => {
    historyRequestRef.current += 1;
    setHistory(null);
    setHistoryScope("");
    setHistoryError(null);
    setIsLoadingHistory(false);
    leaderboardRequestRef.current += 1;
    setLeaderboardScope(DEFAULT_LEADERBOARD_SCOPE);
    setLeaderboard(null);
    setLeaderboardError(null);
    setIsLoadingLeaderboard(false);
    setLeaderboardRetryAt(0);
  }, [profileScope]);

  useEffect(() => {
    const recoveredRegistrationNumber = androidIdentityQuery.data?.registrationNumber;
    if (!profile || !recoveredRegistrationNumber || profile.registrationNumber === recoveredRegistrationNumber) return;
    const updated = { ...profile, registrationNumber: recoveredRegistrationNumber, savedAt: Date.now() };
    saveStudentProfile(localStorage, updated);
    client.resetStoredIdentity();
    setProfile(updated);
    setHistory(null);
    leaderboardRequestRef.current += 1;
    setLeaderboard(null);
    setIdentityMessage("Your CRN was matched to the verified student directory. Loading your shared Android attendance history now.");
  }, [androidIdentityQuery.data?.registrationNumber, client, profile]);

  const loadHistory = useCallback(async () => {
    if (!profile || !attendanceIdentityReady) return;
    const requestScope = profileScope;
    const requestId = ++historyRequestRef.current;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await client.getHistory(profile, bounds.from, bounds.to, targetRef.current);
      if (historyRequestRef.current !== requestId || activeProfileScopeRef.current !== requestScope) return;
      setHistory({ ...response, from: response.from || bounds.from, to: response.to || bounds.to, records: Array.isArray(response.records) ? response.records : [] });
      setHistoryScope(requestScope);
    } catch (reason) {
      if (historyRequestRef.current !== requestId || activeProfileScopeRef.current !== requestScope) return;
      setHistoryError(reason instanceof Error ? reason.message : "Attendance history could not be loaded.");
    } finally {
      if (historyRequestRef.current === requestId && activeProfileScopeRef.current === requestScope) setIsLoadingHistory(false);
    }
  }, [attendanceIdentityReady, bounds.from, bounds.to, client, profile, profileScope]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const loadLeaderboard = useCallback(async () => {
    if (!profile || !attendanceIdentityReady || !isOnline) return;
    const requestScope = profileScope;
    const requestId = ++leaderboardRequestRef.current;
    setIsLoadingLeaderboard(true);
    setLeaderboard(null);
    setLeaderboardError(null);
    try {
      const response = await client.getLeaderboard(profile, leaderboardScope);
      if (!shouldApplyLeaderboardResponse(requestId, leaderboardRequestRef.current, requestScope, activeProfileScopeRef.current)) return;
      setLeaderboard(response);
    } catch (reason) {
      if (!shouldApplyLeaderboardResponse(requestId, leaderboardRequestRef.current, requestScope, activeProfileScopeRef.current)) return;
      if (reason instanceof AttendanceApiError && reason.status === 400 && leaderboardScope !== DEFAULT_LEADERBOARD_SCOPE) {
        setLeaderboardScope(DEFAULT_LEADERBOARD_SCOPE);
        setLeaderboardError("That leaderboard view is unavailable. Showing your subsection instead.");
      } else if (reason instanceof AttendanceApiError && reason.status === 429) {
        setLeaderboardRetryAt(Date.now() + 5000);
        setLeaderboardError("Leaderboard requests are busy right now. Please wait a moment before retrying.");
      } else if (reason instanceof AttendanceApiError && reason.status === 503) {
        setLeaderboardError("The leaderboard is temporarily unavailable. Your private attendance tracker remains available.");
      } else {
        setLeaderboardError("The leaderboard could not be loaded. Please try again.");
      }
    } finally {
      if (shouldApplyLeaderboardResponse(requestId, leaderboardRequestRef.current, requestScope, activeProfileScopeRef.current)) setIsLoadingLeaderboard(false);
    }
  }, [attendanceIdentityReady, client, isOnline, leaderboardScope, profile, profileScope]);

  useEffect(() => { void loadLeaderboard(); }, [loadLeaderboard]);

  useEffect(() => {
    if (!leaderboardRetryAt) return;
    const remaining = leaderboardRetryAt - Date.now();
    if (remaining <= 0) {
      setLeaderboardRetryAt(0);
      return;
    }
    const timer = window.setTimeout(() => setLeaderboardRetryAt(0), remaining);
    return () => window.clearTimeout(timer);
  }, [leaderboardRetryAt]);

  const visibleHistory = historyScope === profileScope ? history : null;
  const recordsByKey = useMemo(() => Object.fromEntries((visibleHistory?.records ?? []).map(record => [record.lecture_key, record.status])) as Record<string, AttendanceStatus>, [visibleHistory]);
  const summary = useMemo(() => calculateAttendanceSummary(visibleHistory?.records ?? [], target), [visibleHistory?.records, target]);
  const selectedDateKey = formatLocalAttendanceDate(selectedDate);
  const selectedDay = weekdayFor(selectedDate);
  const selectedLectures = useMemo(() => selectedDay && timetable ? timetable.lectures.filter(lecture => lecture.day === selectedDay) : [], [selectedDay, timetable]);
  const dateStrip = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (6 - index));
    return date;
  }), [today]);

  function setTargetLocally(value: number[]) {
    setTarget(saveAttendanceTarget(localStorage, value[0] ?? 75));
  }

  function applySynchronizedRecord(record: AttendanceRecordInput, status: AttendanceStatus | null) {
    const mutationScope = profileScope;
    if (activeProfileScopeRef.current !== mutationScope) return;
    setHistory(current => {
      if (activeProfileScopeRef.current !== mutationScope || historyScope !== mutationScope) return current;
      const records = current?.records ?? [];
      const withoutCurrent = records.filter(item => item.lecture_key !== record.lectureKey);
      return { from: current?.from ?? bounds.from, to: current?.to ?? bounds.to, records: status ? [...withoutCurrent, localRecordFromInput({ ...record, status })] : withoutCurrent, summary: current?.summary ?? summary };
    });
    void loadLeaderboard();
  }

  return <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]">
    <header className="app-topbar"><div className="container flex h-17 items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Link href="/app" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300" aria-label="Back to timetable"><ArrowLeft className="h-4 w-4" /></Link><img src={BRAND_LOGO_URL} alt="NextLecture timetable logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" /><div className="min-w-0"><p className="truncate font-display text-lg font-semibold tracking-[-0.04em]">Attendance</p><p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">PERSONAL MANUAL TRACKER</p></div></div><div className="flex shrink-0 items-center gap-2"><Link href="/papers" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 sm:inline-flex">Previous papers</Link><ThemeToggle /></div></div></header>
    <main className="container max-w-7xl py-6 sm:py-9">
      {!profile ? <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-7 text-center shadow-sm"><ClipboardCheck className="mx-auto h-7 w-7 text-teal-700 dark:text-teal-300" /><h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em]">Set your profile first</h1><p className="mt-3 leading-7 text-muted-foreground">Attendance is personal to your saved GNDEC profile and timetable subsection. Set that up before adding any marks.</p><Link href="/app" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800">Open timetable setup</Link></section> : <>
        <section className="mb-6 grid gap-5 rounded-[1.6rem] border border-teal-200 bg-gradient-to-br from-teal-50 via-card to-card p-5 shadow-sm dark:border-teal-950/80 dark:from-teal-950/30 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="eyebrow"><ClipboardCheck className="h-3.5 w-3.5" /> YOUR PERSONAL RECORD</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Attendance, on your terms.</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">This is a private manual tracker, not an official GNDEC attendance record. Marks are synced to your private attendance session and can be corrected anytime.</p></div><div className="rounded-2xl border border-teal-200 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-teal-900/60 dark:bg-teal-950/35"><p className="font-semibold text-teal-900 dark:text-teal-100">{profile.studentName} · {profileGroup}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Only your saved subsection is used for attendance keys.</p></div></section>

        <section className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"><div><p className="eyebrow">ANDROID SYNC</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.04em]">Linked by your CRN</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{needsAndroidIdentityRecovery ? androidIdentityQuery.isLoading ? "Matching your CRN to the verified student directory before opening attendance history…" : androidIdentityQuery.isSuccess ? "No verified Android attendance profile was found for this CRN yet. New marks will stay private to this saved profile." : "We could not match this CRN right now. You can still use the personal attendance tracker and retry later." : "Your CRN-linked attendance identity is ready. The same server-side attendance record is used across both apps."}</p></div>{identityMessage && <p role="status" className="mt-3 text-sm font-medium text-teal-800 dark:text-teal-200">{identityMessage}</p>}</section>

        {historyError && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Attendance sync needs attention.</strong> {historyError} <button type="button" onClick={() => void loadHistory()} className="ml-1 font-bold underline underline-offset-4">Try again</button></span></div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow"><Target className="h-3.5 w-3.5" /> ATTENDANCE SUMMARY</p><div className="mt-3 flex items-end gap-3"><p className="font-display text-5xl font-semibold tracking-[-0.07em]">{summary.percentage === null ? "—" : `${summary.percentage}%`}</p><p className="pb-1 text-sm text-muted-foreground">{summary.markedTotal ? `${summary.present} present · ${summary.absent} absent` : "No lectures marked yet"}</p></div></div>{isLoadingHistory && <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" aria-label="Loading attendance history" />}</div><div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3"><div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Target</p><p className="mt-1 font-display text-2xl font-semibold">{target}%</p></div><div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Can miss</p><p className="mt-1 font-display text-2xl font-semibold">{summary.markedTotal ? summary.affordableMisses : "—"}</p></div><div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Recovery</p><p className="mt-1 font-display text-2xl font-semibold">{summary.lecturesToAttend === null ? "—" : summary.lecturesToAttend}</p></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{summary.markedTotal === 0 ? "Mark a lecture present or absent to start calculating guidance." : summary.lecturesToAttend !== null ? `Attend the next ${summary.lecturesToAttend} marked lecture${summary.lecturesToAttend === 1 ? "" : "s"} to reach ${target}%, assuming no further absences.` : `You can miss ${summary.affordableMisses} more marked lecture${summary.affordableMisses === 1 ? "" : "s"} and remain at or above ${target}%.`}</p><div className="mt-6 border-t border-border pt-5"><div className="flex items-center justify-between gap-4"><label htmlFor="attendance-target" className="text-sm font-bold">Personal target</label><span className="text-sm font-bold text-teal-700 dark:text-teal-300">{target}%</span></div><Slider id="attendance-target" value={[target]} min={50} max={100} step={1} onValueChange={setTargetLocally} className="mt-4" aria-label="Personal attendance target" /><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>50%</span><span>75%</span><span>100%</span></div></div></section>

          <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3 px-1"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"><CalendarDays className="h-4 w-4" /></span><div><p className="font-display text-xl font-semibold tracking-[-0.04em]">Choose a date</p><p className="text-sm text-muted-foreground">Today or any prior day</p></div></div><Calendar mode="single" selected={selectedDate} onSelect={date => date && setSelectedDate(date)} disabled={{ after: new Date(`${today}T23:59:59`) }} fromDate={new Date(`${bounds.from}T12:00:00`)} toDate={new Date(`${today}T12:00:00`)} className="mx-auto mt-3" /></aside>
        </div>

        <AttendanceLeaderboard
          scope={leaderboardScope}
          onScopeChange={scope => { if (scope !== leaderboardScope) setLeaderboardScope(scope); }}
          leaderboard={leaderboard}
          loading={isLoadingLeaderboard}
          error={leaderboardError}
          retryBlocked={Boolean(leaderboardRetryAt)}
          online={isOnline}
          onRetry={() => void loadLeaderboard()}
        />

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow"><CalendarDays className="h-3.5 w-3.5" /> TIMETABLE BACKFILL</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.045em]">{selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 dark:bg-teal-950/45 dark:text-teal-200"><Info className="h-3.5 w-3.5" /> Manual correction is always available</span></div><div className="mt-5 flex gap-2 overflow-x-auto pb-1">{dateStrip.map(date => { const key = formatLocalAttendanceDate(date); const selected = key === selectedDateKey; return <button key={key} type="button" onClick={() => setSelectedDate(date)} className={`min-w-15 rounded-xl border px-3 py-2 text-center transition ${selected ? "border-teal-700 bg-teal-700 text-white" : "border-border bg-background hover:border-teal-300"}`}><span className="block text-[0.65rem] font-bold uppercase tracking-wide opacity-80">{date.toLocaleDateString(undefined, { weekday: "short" })}</span><span className="mt-0.5 block text-lg font-bold">{date.getDate()}</span></button>; })}</div>
          {!timetable && <div className="mt-6 rounded-2xl bg-muted/55 px-5 py-8 text-center"><AlertCircle className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 font-semibold">Your timetable is not available yet.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Open the timetable once while online to load the saved {profileGroup} schedule for attendance backfill.</p><Link href="/app" className="mt-4 inline-flex text-sm font-bold text-teal-700 underline underline-offset-4 dark:text-teal-300">Open timetable</Link></div>}
          {timetable && !selectedDay && <div className="mt-6 rounded-2xl bg-muted/55 px-5 py-8 text-center"><CalendarDays className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 font-semibold">No weekday lectures on this date.</p><p className="mt-1 text-sm text-muted-foreground">Choose a weekday to backfill a timetable lecture.</p></div>}
          {timetable && selectedDay && selectedLectures.length === 0 && <div className="mt-6 rounded-2xl bg-muted/55 px-5 py-8 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 font-semibold">No scheduled lectures for this weekday.</p><p className="mt-1 text-sm text-muted-foreground">Your {profileGroup} timetable has no class to mark here.</p></div>}
          {timetable && selectedLectures.length > 0 && <div className="mt-6 space-y-3">{selectedLectures.map(lecture => <article key={`${lecture.day}-${lecture.startTime}-${lecture.subject}`} className="rounded-2xl border border-border bg-background p-4"><div className="flex gap-3"><p className="w-15 shrink-0 pt-0.5 text-sm font-bold text-muted-foreground">{lecture.startTime}</p><div className="min-w-0 flex-1"><h3 className="font-semibold leading-5">{lecture.subject}</h3><p className="mt-1.5 text-sm text-muted-foreground">{formatRange(lecture)}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">{lecture.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />{lecture.venue}</span>}{lecture.teacher && <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />{lecture.teacher}</span>}</div><AttendanceControls profile={profile} groupName={profileGroup} attendanceDate={selectedDateKey} lecture={lecture} recordsByKey={recordsByKey} onSynchronized={applySynchronizedRecord} /></div></div></article>)}</div>}
        </section>
      </>}
    </main>
  </div>;
}
