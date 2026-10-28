import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { listSessions, listTimetableSlots } from "@/lib/faculty-attendance";
import {
  WEEKDAY_NAMES,
  prettySubject,
  type AttendanceSession,
  type NormalSlot,
} from "@/lib/faculty-attendance-types";
import { FacultyShell, useFacultyIdentity } from "./shell";
import { DayPill, fadeUpItem, formatTime12, groupChip, lectureTypeChip, staggerParent } from "./parts";
import { cn } from "@/lib/utils";

function todayIndex(): number {
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return 0;
  return dow - 1;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FacultyTimetable() {
  const identity = useFacultyIdentity();
  const [slots, setSlots] = useState<NormalSlot[] | null>(null);
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    (async () => {
      const [s, sessions] = await Promise.all([
        listTimetableSlots(identity.teacher.id),
        listSessions(identity.teacher.id, { date: todayISO(), limit: 60 }),
      ]);
      if (!active) return;
      setSlots(s);
      setTodaySessions(sessions);
    })().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : "Could not load the timetable.");
    });
    return () => {
      active = false;
    };
  }, [identity]);

  if (!identity) return <TimetableSkeleton />;

  return (
    <FacultyShell identity={identity} wide>
      {error ? (
        <div className="f-card mx-auto max-w-lg p-8 text-center">
          <p className="text-[0.95rem] font-semibold">The timetable could not be loaded.</p>
          <p className="mt-2 text-[0.85rem] text-[var(--f-ink-2)]">{error}</p>
        </div>
      ) : !slots ? (
        <TimetableSkeleton />
      ) : (
        <TimetableBody slots={slots} todaySessions={todaySessions} />
      )}
    </FacultyShell>
  );
}

function TimetableSkeleton() {
  return (
    <div className="f-scope grid min-h-screen place-items-center bg-[var(--f-paper)]">
      <div className="flex items-center gap-3 text-[var(--f-ink-2)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--f-line)] border-t-[var(--f-navy)]" />
        <span className="font-mono text-[0.8rem] tracking-[0.12em] uppercase">Loading the week…</span>
      </div>
    </div>
  );
}

function TimetableBody({ slots, todaySessions }: { slots: NormalSlot[]; todaySessions: AttendanceSession[] }) {
  const dayIdx = todayIndex();
  const isWeekend = [0, 6].includes(new Date().getDay());

  const submittedKeys = useMemo(
    () => new Set(todaySessions.map((s) => `${s.start_time}|${s.timetable_group}`)),
    [todaySessions],
  );

  const byDay = useMemo(() => {
    const map = new Map<number, NormalSlot[]>();
    for (const s of slots) {
      const list = map.get(s.dayOfWeek) ?? [];
      list.push(s);
      map.set(s.dayOfWeek, list);
    }
    map.forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [slots]);

  const timeSet = useMemo(() => {
    const set = new Set<string>();
    slots.forEach((s) => set.add(s.startTime));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [slots]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="f-eyebrow">Official GNDEC timetable · synced</p>
          <h1 className="mt-2 flex items-center gap-2.5 font-display text-[2rem] leading-tight font-semibold tracking-[-0.015em]">
            <CalendarDays size={24} className="text-[var(--f-green)]" />
            Weekly schedule
          </h1>
        </div>
        <p className="text-[0.82rem] text-[var(--f-ink-2)]">
          {slots.length} class{slots.length === 1 ? "" : "es"} across the week
        </p>
      </div>

      {isWeekend && (
        <p className="rounded-xl border border-dashed border-[var(--f-line)] bg-white px-4 py-3 text-[0.82rem] text-[var(--f-ink-2)]">
          It&apos;s the weekend — Monday is highlighted.
        </p>
      )}

      {/* desktop grid */}
      <div className="f-card hidden overflow-x-auto p-5 lg:block">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-[4.5rem] pb-3 text-left align-bottom">
                <span className="f-eyebrow !text-[0.56rem]">Time</span>
              </th>
              {WEEKDAY_NAMES.map((name, i) => (
                <th key={name} className="pb-3 pl-3 text-left align-bottom">
                  <DayPill label={name.slice(0, 3)} active={i === dayIdx} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSet.map((time) => (
              <tr key={time} className="align-top">
                <td className="border-t border-[var(--f-line)] py-2.5 pr-2 font-mono text-[0.72rem] leading-4 font-medium text-[var(--f-ink-3)]">
                  {time}
                </td>
                {WEEKDAY_NAMES.map((_, day) => {
                  const cell = (byDay.get(day) ?? []).find((s) => s.startTime === time);
                  if (!cell) return <td key={day} className="border-t border-[var(--f-line)] pl-3" />;
                  const done = day === dayIdx && submittedKeys.has(`${cell.startTime}|${cell.timetableGroup}`);
                  return (
                    <td key={day} className="border-t border-[var(--f-line)] py-2.5 pl-3">
                      <div
                        className={cn(
                          "rounded-xl border p-2.5 transition-shadow hover:shadow-[var(--f-shadow)]",
                          done ? "border-[color-mix(in_oklab,var(--f-green)_35%,var(--f-line))] bg-[var(--f-tint)]"
                            : day === dayIdx ? "border-[color-mix(in_oklab,var(--f-navy)_25%,var(--f-line))] bg-white"
                              : "border-[var(--f-line)] bg-white",
                        )}
                      >
                        <p className="text-[0.8rem] leading-tight font-semibold">{prettySubject(cell.subjectName)}</p>
                        <p className="mt-1 font-mono text-[0.62rem] text-[var(--f-ink-2)]">{cell.timetableGroup}</p>
                        {cell.venue ? <p className="mt-0.5 truncate font-mono text-[0.6rem] text-[var(--f-ink-3)]">{cell.venue}</p> : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {lectureTypeChip(cell.lectureType)}
                          {done && <span className="rounded-full bg-[var(--f-green)] px-1.5 py-[0.05rem] font-mono text-[0.56rem] font-semibold tracking-[0.1em] text-white uppercase">Done</span>}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile / tablet list */}
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-6 lg:hidden">
        {WEEKDAY_NAMES.map((name, day) => {
          const daySlots = byDay.get(day) ?? [];
          if (!daySlots.length) return null;
          return (
            <motion.section key={name} variants={fadeUpItem}>
              <div className="mb-3 flex items-center gap-2.5">
                <DayPill label={name} active={day === dayIdx} />
                <span className="text-[0.85rem] font-semibold">{daySlots.length} class{daySlots.length === 1 ? "" : "es"}</span>
              </div>
              <div className="space-y-2.5">
                {daySlots.map((slot) => {
                  const done = day === dayIdx && submittedKeys.has(`${slot.startTime}|${slot.timetableGroup}`);
                  return (
                    <div key={`${slot.startTime}-${slot.timetableGroup}`} className={cn("f-card p-4", done && "border-[color-mix(in_oklab,var(--f-green)_35%,var(--f-line))] bg-[var(--f-tint)]")}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.95rem] font-semibold">{prettySubject(slot.subjectName)}</p>
                        {lectureTypeChip(slot.lectureType)}
                      </div>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] text-[var(--f-ink-2)]">
                        <Clock size={12} />
                        {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
                        {slot.venue ? <><MapPin size={12} className="ml-1" />{slot.venue}</> : null}
                      </p>
                      <div className="mt-2.5">{groupChip(slot.timetableGroup)}</div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </motion.div>
    </div>
  );
}
