import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Hourglass,
  KeyRound,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listAssignments,
  listSessions,
  listTimetableSlots,
} from "@/lib/faculty-attendance";
import {
  LECTURE_TYPE_LABEL,
  WEEKDAY_NAMES,
  prettySubject,
  type AttendanceSession,
  type FacultyAssignment,
  type NormalSlot,
} from "@/lib/faculty-attendance-types";
import { FacultyShell, type FacultyIdentity, useFacultyIdentity } from "./shell";
import {
  attendancePct,
  fadeUpItem,
  formatTime12,
  groupChip,
  lectureTypeChip,
  pctTone,
  staggerParent,
} from "./parts";

function todayIndex(): number {
  const dow = new Date().getDay(); // 0=Sun
  if (dow === 0 || dow === 6) return 0; // weekend -> show Monday
  return dow - 1;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

type DashboardData = {
  slots: NormalSlot[];
  todaySessions: AttendanceSession[];
  recent: AttendanceSession[];
  assignments: FacultyAssignment[];
};

export function FacultyDashboard() {
  const identity = useFacultyIdentity();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    (async () => {
      const [slots, todaySessions, recent, assignments] = await Promise.all([
        listTimetableSlots(identity.teacher.id),
        listSessions(identity.teacher.id, { date: todayISO(), limit: 50 }),
        listSessions(identity.teacher.id, { limit: 12 }),
        listAssignments(identity.teacher.id),
      ]);
      if (!active) return;
      setData({ slots, todaySessions, recent, assignments });
    })().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : "Could not load the dashboard.");
    });
    return () => {
      active = false;
    };
  }, [identity]);

  if (!identity) return <DashboardSkeleton />;
  if (error) {
    return (
      <FacultyShell identity={identity}>
        <div className="f-card mx-auto max-w-lg p-8 text-center">
          <p className="text-[0.95rem] font-semibold text-[var(--f-ink)]">The dashboard could not be loaded.</p>
          <p className="mt-2 text-[0.85rem] text-[var(--f-ink-2)]">{error}</p>
        </div>
      </FacultyShell>
    );
  }

  return (
    identity && (
      <FacultyShell identity={identity}>
        {data ? <DashboardBody identity={identity} data={data} /> : <DashboardSkeleton />}
      </FacultyShell>
    )
  );
}

function DashboardSkeleton() {
  return (
    <div className="f-scope grid min-h-screen place-items-center bg-[var(--f-paper)]">
      <div className="flex items-center gap-3 text-[var(--f-ink-2)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--f-line)] border-t-[var(--f-navy)]" />
        <span className="font-mono text-[0.8rem] tracking-[0.12em] uppercase">Loading the register…</span>
      </div>
    </div>
  );
}

function DashboardBody({ identity, data }: { identity: FacultyIdentity; data: DashboardData }) {
  const { teacher } = identity;
  const dayIndex = todayIndex();
  const isWeekend = [0, 6].includes(new Date().getDay());
  const now = nowMinutes();

  const todaySlots = useMemo(
    () => data.slots.filter((s) => s.dayOfWeek === dayIndex),
    [data.slots, dayIndex],
  );

  const submittedKeys = useMemo(
    () => new Set(data.todaySessions.map((s) => `${s.start_time}|${s.timetable_group}`)),
    [data.todaySessions],
  );

  const pendingSlots = todaySlots.filter((s) => !submittedKeys.has(`${s.startTime}|${s.timetableGroup}`));
  const upcomingSlots = todaySlots.filter((s) => {
    const [h, m] = s.startTime.split(":").map(Number);
    return h * 60 + m > now;
  });

  const stats = useMemo(() => {
    const sessions = data.recent;
    const total = sessions.length;
    const present = sessions.reduce((acc, s) => acc + s.present_count, 0);
    const marked = sessions.reduce((acc, s) => acc + s.total_students, 0);
    const subjectMap = new Map<string, { present: number; total: number; classes: number }>();
    for (const s of sessions) {
      const row = subjectMap.get(s.subject_name) ?? { present: 0, total: 0, classes: 0 };
      row.present += s.present_count;
      row.total += s.total_students;
      row.classes += 1;
      subjectMap.set(s.subject_name, row);
    }
    return { total, present, marked, subjects: Array.from(subjectMap.entries()).sort((a, b) => b[1].classes - a[1].classes) };
  }, [data.recent]);

  return (
    <div className="space-y-8">
      {/* header row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-eyebrow">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-2 font-display text-[2rem] leading-tight font-semibold tracking-[-0.015em]">
            Good day, {teacher.full_name.split(" ").slice(-1)[0]}.
          </h1>
          <p className="mt-1.5 text-[0.92rem] text-[var(--f-ink-2)]">
            {todaySlots.length === 0
              ? "No classes on today's schedule."
              : `${todaySlots.length} class${todaySlots.length > 1 ? "es" : ""} today · ${pendingSlots.length} awaiting attendance`}
          </p>
        </div>
        <Link href="/faculty/attendance" className="f-btn f-btn-primary h-11">
          <ClipboardCheck size={16} />
          {pendingSlots.length > 0 ? `Mark attendance (${pendingSlots.length})` : "Open attendance"}
        </Link>
      </div>

      {/* password-change nudge */}
      {teacher.must_change_password && (
        <motion.div {...fadeUpItem} className="f-card flex flex-wrap items-center justify-between gap-3 border-[#E8DCBF] bg-[#FBF3DD] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <KeyRound size={18} className="mt-[2px] shrink-0 text-[#8A6212]" />
            <div>
              <p className="text-[0.9rem] font-semibold text-[#5E430D]">Change your initial password</p>
              <p className="mt-0.5 text-[0.82rem] leading-relaxed text-[#6B4E10]">
                Your account still uses the administrator-issued password. Keep your attendance secure — set your own from the profile page.
              </p>
            </div>
          </div>
          <Link href="/faculty/profile" className="f-btn f-btn-ghost h-10 !border-[#D9B96A]/60">
            Set a new password
            <ChevronRight size={14} />
          </Link>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* today's schedule */}
        <motion.section variants={staggerParent} initial="hidden" animate="show" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[1.25rem] font-semibold tracking-[-0.01em]">
              <CalendarDays size={17} className="text-[var(--f-green)]" />
              Today&apos;s schedule
            </h2>
            <Link href="/faculty/timetable" className="f-handlink text-[0.8rem] font-medium">
              Full week
            </Link>
          </div>

          {isWeekend && (
            <p className="rounded-xl border border-dashed border-[var(--f-line)] bg-white px-4 py-3 text-[0.82rem] text-[var(--f-ink-2)]">
              It&apos;s the weekend — showing Monday&apos;s classes.
            </p>
          )}

          {todaySlots.length === 0 ? (
            <div className="f-card p-8 text-center">
              <Hourglass size={26} className="mx-auto text-[var(--f-ink-3)]" />
              <p className="mt-3 text-[0.92rem] font-medium text-[var(--f-ink)]">Nothing scheduled for today.</p>
              <p className="mt-1 text-[0.8rem] text-[var(--f-ink-2)]">Classes appear here once your timetable is synced.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySlots.map((slot, i) => {
                const done = submittedKeys.has(`${slot.startTime}|${slot.timetableGroup}`);
                const [h, m] = slot.startTime.split(":").map(Number);
                const live = now >= h * 60 + m && now < h * 60 + m + 60;
                return (
                  <motion.div
                    key={`${slot.startTime}-${slot.timetableGroup}`}
                    variants={fadeUpItem}
                    className={cn(
                      "f-card f-card-interactive flex items-center gap-4 p-4",
                      live && "border-[color-mix(in_oklab,var(--f-green)_40%,var(--f-line))] shadow-[var(--f-shadow)]",
                    )}
                  >
                    <div className={cn("w-[4.6rem] shrink-0 rounded-xl px-2 py-2 text-center", done ? "bg-[var(--f-tint)]" : live ? "bg-[var(--f-navy)] text-white" : "bg-[var(--f-paper-2)]")}>
                      <p className="font-mono text-[0.82rem] font-semibold">{formatTime12(slot.startTime).replace(" AM", "").replace(" PM", "")}</p>
                      <p className="font-mono text-[0.6rem] tracking-[0.1em] text-[var(--f-ink-3)] uppercase">
                        {slot.startTime.endsWith("AM") ? "AM" : "PM"}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.95rem] font-semibold tracking-[-0.005em]">{prettySubject(slot.subjectName)}</p>
                        {lectureTypeChip(slot.lectureType)}
                        {groupChip(slot.timetableGroup)}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[0.76rem] text-[var(--f-ink-2)]">
                        <Clock size={12} />
                        {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
                        {slot.venue ? ` · ${slot.venue}` : ""}
                      </p>
                    </div>
                    {done ? (
                      <Link href={`/faculty/attendance?highlight=done`} className="flex items-center gap-1.5 rounded-lg bg-[var(--f-tint)] px-2.5 py-1.5 text-[0.72rem] font-semibold text-[var(--f-green-deep)]">
                        <CheckCircle2 size={14} />
                        Submitted
                      </Link>
                    ) : (
                      <Link href={`/faculty/attendance/new?slot=${encodeURIComponent(slot.id)}&date=${todayISO()}`} className="f-btn f-btn-primary h-9 !px-3 !text-[0.76rem]">
                        Mark now
                        <ArrowRight size={13} />
                      </Link>
                    )}
                    <span className="sr-only">{i}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* upcoming */}
          {upcomingSlots.length > 0 && (
            <p className="flex items-center gap-2 px-1 text-[0.78rem] text-[var(--f-ink-2)]">
              <Clock size={13} className="text-[var(--f-ink-3)]" />
              Later today: {upcomingSlots.map((s) => `${formatTime12(s.startTime)} ${s.timetableGroup}`).join(" · ")}
            </p>
          )}
        </motion.section>

        {/* right column */}
        <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-6">
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div variants={fadeUpItem} className="f-card p-4">
              <p className="f-eyebrow !text-[0.58rem]">Classes recorded</p>
              <p className="mt-2 font-display text-[1.9rem] leading-none font-semibold">{stats.total}</p>
              <p className="mt-1.5 text-[0.72rem] text-[var(--f-ink-3)]">across {stats.subjects.length} subject{stats.subjects.length === 1 ? "" : "s"}</p>
            </motion.div>
            <motion.div variants={fadeUpItem} className="f-card p-4">
              <p className="f-eyebrow !text-[0.58rem]">Average attendance</p>
              <p className={cn("mt-2 font-display text-[1.9rem] leading-none font-semibold", pctTone(attendancePct(stats.present, stats.marked)))}>
                {stats.marked ? `${attendancePct(stats.present, stats.marked)}%` : "—"}
              </p>
              <p className="mt-1.5 text-[0.72rem] text-[var(--f-ink-3)]">{stats.present} of {stats.marked} marks present</p>
            </motion.div>
          </div>

          {/* subject summary */}
          <motion.div variants={fadeUpItem} className="f-card p-5">
            <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              <TrendingUp size={15} className="text-[var(--f-green)]" />
              Subject-wise attendance
            </h3>
            {stats.subjects.length === 0 ? (
              <p className="mt-3 text-[0.82rem] text-[var(--f-ink-2)]">No submissions yet — they will summarise here.</p>
            ) : (
              <div className="mt-4 space-y-3.5">
                {stats.subjects.map(([subject, row]) => {
                  const pct = attendancePct(row.present, row.total);
                  return (
                    <div key={subject}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[0.85rem] font-medium">{prettySubject(subject)}</p>
                        <p className={cn("font-mono text-[0.78rem] font-semibold", pctTone(pct))}>{pct}%</p>
                      </div>
                      <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--f-paper-2)]">
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-700", pct >= 85 ? "bg-[var(--f-green)]" : pct >= 70 ? "bg-[#C99526]" : "bg-[#C25A4B]")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[0.7rem] text-[var(--f-ink-3)]">{row.classes} class{row.classes > 1 ? "es" : ""} · {row.present}/{row.total} present</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* assignments overview */}
          <motion.div variants={fadeUpItem} className="f-card p-5">
            <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              <GraduationCap size={15} className="text-[var(--f-green)]" />
              Teaching assignments
            </h3>
            <p className="mt-1 text-[0.74rem] text-[var(--f-ink-3)]">Verified from the official GNDEC timetable by the sync process.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.assignments.map((a) => (
                <span key={`${a.subject_name}-${a.timetable_group}`} className="rounded-lg border border-[var(--f-line)] bg-[var(--f-paper-2)] px-2 py-1 font-mono text-[0.66rem] text-[var(--f-ink-2)]">
                  {a.timetable_group} · {prettySubject(a.subject_name)}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* recent submissions */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[1.25rem] font-semibold tracking-[-0.01em]">
            <BookOpenCheck size={17} className="text-[var(--f-green)]" />
            Recently submitted
          </h2>
          <Link href="/faculty/attendance" className="f-handlink text-[0.8rem] font-medium">View all</Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="f-card mt-4 p-8 text-center">
            <ClipboardCheck size={26} className="mx-auto text-[var(--f-ink-3)]" />
            <p className="mt-3 text-[0.92rem] font-medium">No attendance submitted yet.</p>
            <p className="mt-1 text-[0.8rem] text-[var(--f-ink-2)]">Pick a class above to take your first register.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.recent.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/faculty/attendance/${s.id}`} className="f-card f-card-interactive block p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.92rem] font-semibold">{prettySubject(s.subject_name)}</p>
                  {lectureTypeChip(s.lecture_type)}
                </div>
                <p className="mt-1 text-[0.76rem] text-[var(--f-ink-2)]">
                  {new Date(`${s.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  {" · "}{formatTime12(s.start_time)} · {s.timetable_group}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-[var(--f-line)] pt-3">
                  <span className="font-mono text-[0.74rem] text-[var(--f-ink-2)]">
                    <span className="font-semibold text-[var(--f-green)]">{s.present_count}</span> / {s.total_students} present
                  </span>
                  <span className={cn("font-mono text-[0.74rem] font-semibold", pctTone(attendancePct(s.present_count, s.total_students)))}>
                    {attendancePct(s.present_count, s.total_students)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
