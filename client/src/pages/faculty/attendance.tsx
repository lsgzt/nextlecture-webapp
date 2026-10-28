import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { BookOpenCheck, CheckCircle2, ClipboardList, Clock, Filter, Hourglass, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { listSessions, listTimetableSlots } from "@/lib/faculty-attendance";
import {
  prettySubject,
  slotGroups,
  type AttendanceSession,
  type NormalSlot,
} from "@/lib/faculty-attendance-types";
import { FacultyShell, useFacultyIdentity } from "./shell";
import { attendancePct, fadeUpItem, formatTime12, groupChip, lectureTypeChip, pctTone, staggerParent } from "./parts";

function todayIndex(): number {
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return 0;
  return dow - 1;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FacultyAttendance() {
  const identity = useFacultyIdentity();
  const [slots, setSlots] = useState<NormalSlot[] | null>(null);
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [history, setHistory] = useState<AttendanceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!identity) return;
    let active = true;
    (async () => {
      const [s, today, all] = await Promise.all([
        listTimetableSlots(identity.teacher.id),
        listSessions(identity.teacher.id, { date: todayISO(), limit: 60 }),
        listSessions(identity.teacher.id, { limit: 400 }),
      ]);
      if (!active) return;
      setSlots(s);
      setTodaySessions(today);
      setHistory(all);
    })().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : "Could not load attendance.");
    });
    return () => {
      active = false;
    };
  }, [identity]);

  const filtered = useMemo(() => {
    if (!history) return [];
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((s) =>
      s.subject_name.toLowerCase().includes(q)
      || s.timetable_group.toLowerCase().includes(q)
      || s.attendance_date.includes(q)
      || (s.section ?? "").toLowerCase().includes(q),
    );
  }, [history, query]);

  if (!identity) return <ListSkeleton />;

  return (
    <FacultyShell identity={identity} wide>
      {error ? (
        <div className="f-card mx-auto max-w-lg p-8 text-center">
          <p className="text-[0.95rem] font-semibold">Attendance could not be loaded.</p>
          <p className="mt-2 text-[0.85rem] text-[var(--f-ink-2)]">{error}</p>
        </div>
      ) : !slots || !history ? (
        <ListSkeleton inner />
      ) : (
        <AttendanceBody slots={slots} todaySessions={todaySessions} history={filtered} query={query} setQuery={setQuery} />
      )}
    </FacultyShell>
  );
}

function ListSkeleton({ inner }: { inner?: boolean }) {
  const spinner = (
    <div className="flex items-center gap-3 text-[var(--f-ink-2)]">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--f-line)] border-t-[var(--f-navy)]" />
      <span className="font-mono text-[0.8rem] tracking-[0.12em] uppercase">Loading attendance…</span>
    </div>
  );
  if (inner) return spinner;
  return (
    <div className="f-scope grid min-h-screen place-items-center bg-[var(--f-paper)]">{spinner}</div>
  );
}

function AttendanceBody({
  slots,
  todaySessions,
  history,
  query,
  setQuery,
}: {
  slots: NormalSlot[];
  todaySessions: AttendanceSession[];
  history: AttendanceSession[];
  query: string;
  setQuery: (v: string) => void;
}) {
  const dayIdx = todayIndex();
  const todaySlots = slots.filter((s) => s.dayOfWeek === dayIdx);

  const submittedKeys = new Set(todaySessions.map((s) => `${s.start_time}|${s.timetable_group}`));
  const now = new Date().getHours() * 60 + new Date().getMinutes();

  const pending = todaySlots.filter((s) => !submittedKeys.has(`${s.startTime}|${s.timetableGroup}`));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="f-eyebrow">Today · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-2 flex items-center gap-2.5 font-display text-[2rem] leading-tight font-semibold tracking-[-0.015em]">
            <ClipboardList size={24} className="text-[var(--f-green)]" />
            Attendance
          </h1>
          <p className="mt-1.5 text-[0.9rem] text-[var(--f-ink-2)]">
            {pending.length === 0 ? "Every class today is recorded. " : `${pending.length} class${pending.length > 1 ? "es" : ""} still awaiting the register. `}
            Submissions are atomic and lock after confirmation.
          </p>
        </div>
      </div>

      {/* pending today */}
      <motion.section variants={staggerParent} initial="hidden" animate="show">
        <h2 className="mb-3 flex items-center gap-2 font-display text-[1.2rem] font-semibold">
          <Hourglass size={16} className="text-[#8A6212]" />
          Awaiting attendance
        </h2>
        {pending.length === 0 ? (
          <div className="f-card p-6 text-center">
            <CheckCircle2 size={22} className="mx-auto text-[var(--f-green)]" />
            <p className="mt-2 text-[0.9rem] font-medium">All caught up — today&apos;s registers are complete.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((slot) => {
              const [h, m] = slot.startTime.split(":").map(Number);
              const live = now >= h * 60 + m && now < h * 60 + m + 60;
              const hasRoster = slotGroups(slot.timetableGroup).length > 0;
              return (
                <motion.div key={`${slot.startTime}-${slot.timetableGroup}`} variants={fadeUpItem} className={cn("f-card flex flex-wrap items-center gap-4 p-4", live && "border-[color-mix(in_oklab,var(--f-green)_40%,var(--f-line))]")}>
                  <div className={cn("grid h-12 w-[4.6rem] shrink-0 place-items-center rounded-xl font-mono text-[0.82rem] font-semibold", live ? "bg-[var(--f-navy)] text-white" : "bg-[var(--f-paper-2)] text-[var(--f-ink-2)]")}>
                    {slot.startTime}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.95rem] font-semibold">{prettySubject(slot.subjectName)}</p>
                      {lectureTypeChip(slot.lectureType)}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[0.76rem] text-[var(--f-ink-2)]">
                      <Clock size={12} />
                      {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
                      {slot.venue ? ` · ${slot.venue}` : ""}
                    </p>
                    <div className="mt-1.5">{groupChip(slot.timetableGroup)}</div>
                  </div>
                  <Link
                    href={`/faculty/attendance/new?slot=${encodeURIComponent(slot.id)}&date=${todayISO()}`}
                    className="f-btn f-btn-primary h-10 !text-[0.8rem]"
                    aria-disabled={!hasRoster}
                  >
                    Take register
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* history */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-[1.2rem] font-semibold">
            <BookOpenCheck size={16} className="text-[var(--f-green)]" />
            Submission history
          </h2>
          <label className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-[var(--f-ink-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by subject, group, date…"
              className="f-input h-10 !w-64 !pl-9 !text-[0.82rem]"
              aria-label="Filter attendance history"
            />
          </label>
        </div>

        <div className="f-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.86rem]">
              <thead>
                <tr className="border-b border-[var(--f-line)] bg-[var(--f-paper-2)]">
                  <th className="px-4 py-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Date</th>
                  <th className="px-4 py-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Class</th>
                  <th className="hidden px-4 py-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase sm:table-cell">Time</th>
                  <th className="px-4 py-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Group</th>
                  <th className="px-4 py-3 text-right font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Present</th>
                  <th className="px-4 py-3 text-right font-mono text-[0.62rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[0.85rem] text-[var(--f-ink-2)]">
                      {query ? "No submissions match that filter." : "No attendance submitted yet."}
                    </td>
                  </tr>
                ) : (
                  history.map((s) => (
                    <tr key={s.id} className="group cursor-pointer border-b border-dashed border-[var(--f-line)] last:border-0 hover:bg-[var(--f-tint-2)]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={`/faculty/attendance/${s.id}`} className="block">
                          {new Date(`${s.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/faculty/attendance/${s.id}`} className="flex items-center gap-2 font-medium group-hover:text-[var(--f-navy)]">
                          {prettySubject(s.subject_name)}
                          {lectureTypeChip(s.lecture_type)}
                        </Link>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-[0.76rem] text-[var(--f-ink-2)] sm:table-cell">
                        <Link href={`/faculty/attendance/${s.id}`}>{s.start_time}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/faculty/attendance/${s.id}`}>{groupChip(s.timetable_group)}</Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[0.78rem]">
                        <Link href={`/faculty/attendance/${s.id}`}>
                          <span className="font-semibold text-[var(--f-green)]">{s.present_count}</span>
                          <span className="text-[var(--f-ink-3)]">/{s.total_students}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/faculty/attendance/${s.id}`} className={cn("font-mono text-[0.78rem] font-semibold", pctTone(attendancePct(s.present_count, s.total_students)))}>
                          {attendancePct(s.present_count, s.total_students)}%
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-2 border-t border-[var(--f-line)] bg-[var(--f-paper-2)] px-4 py-2.5 text-[0.72rem] text-[var(--f-ink-3)]">
            <Filter size={12} />
            {history.length} submission{history.length === 1 ? "" : "s"} · click a row to review or correct
          </p>
        </div>
      </section>
    </div>
  );
}
