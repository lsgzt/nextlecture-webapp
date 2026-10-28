import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileClock,
  History,
  ListChecks,
  MapPin,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  correctAttendance,
  findExistingSession,
  getSession,
  listAuditTrail,
  listEntries,
  listSessions,
  listStudentsForGroups,
  listTimetableSlots,
  submitAttendance,
} from "@/lib/faculty-attendance";
import {
  prettySubject,
  slotGroups,
  type AttendanceEntry,
  type AttendanceSession,
  type AttendanceStatus,
  type AuditRow,
  type FacultyStudent,
  type NormalSlot,
} from "@/lib/faculty-attendance-types";
import { FacultyShell, useFacultyIdentity, type FacultyIdentity } from "./shell";
import { attendancePct, fadeUpItem, formatTime12, groupChip, lectureTypeChip, pctTone, staggerParent } from "./parts";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function FacultySession() {
  const identity = useFacultyIdentity();
  const [matched, matchParams] = useRoute<{ rest?: string }>("/faculty/attendance/:rest?");
  const [, navigate] = useLocation();
  const search = useSearch();

  const rest = matchParams?.rest; // "new" | uuid | undefined
  const isNew = !matched || rest === undefined || rest === "new";

  if (!identity) return <SessionSkeleton />;
  if (isNew) {
    return <NewSessionView identity={identity} search={search} />;
  }
  return <SessionDetailView identity={identity} sessionId={rest!} />;
}

function SessionSkeleton() {
  return (
    <div className="f-scope grid min-h-screen place-items-center bg-[var(--f-paper)]">
      <div className="flex items-center gap-3 text-[var(--f-ink-2)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--f-line)] border-t-[var(--f-navy)]" />
        <span className="font-mono text-[0.8rem] tracking-[0.12em] uppercase">Preparing the register…</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* New session — take the register                                     */
/* ================================================================== */

type SlotResolution = { slot: NormalSlot; date: string } | { error: string };

function resolveSlotParam(search: string): { slot: NormalSlot | null; date: string } {
  const params = new URLSearchParams(search);
  const date = params.get("date") ?? todayISO();
  const slotId = params.get("slot");
  return { slot: null, date };
}

function NewSessionView({ identity, search }: { identity: FacultyIdentity; search: string }) {
  const [, navigate] = useLocation();
  const { date: dateParam } = resolveSlotParam(search);
  const params = new URLSearchParams(search);
  const slotId = params.get("slot");
  const fallbackDate = dateParam;

  const [slots, setSlots] = useState<NormalSlot[] | null>(null);
  const [slot, setSlot] = useState<NormalSlot | null>(null);
  const [date, setDate] = useState(fallbackDate);
  const [students, setStudents] = useState<FacultyStudent[] | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [existing, setExisting] = useState<AttendanceSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRoster, setNoRoster] = useState(false);

  // load the teacher's slots once, resolve the requested one
  useEffect(() => {
    if (!identity) return;
    let active = true;
    (async () => {
      const s = await listTimetableSlots(identity.teacher.id);
      if (!active) return;
      setSlots(s);
      if (slotId) {
        const found = s.find((x) => x.id === slotId) ?? null;
        setSlot(found);
        if (!found) setError("That class slot could not be found in your timetable.");
      }
    })().catch((e) => active && setError(e instanceof Error ? e.message : "Could not load your timetable."));
    return () => {
      active = false;
    };
  }, [identity, slotId]);

  // load the roster when slot/date change + check for duplicates
  useEffect(() => {
    if (!identity || !slot) return;
    let active = true;
    setStudents(null);
    setMarks({});
    setExisting(null);
    setNoRoster(false);
    (async () => {
      const [roster, dupe] = await Promise.all([
        listStudentsForGroups(slotGroups(slot.timetableGroup)),
        findExistingSession(identity.teacher.id, date, slot.startTime, slot.timetableGroup),
      ]);
      if (!active) return;
      setStudents(roster);
      setNoRoster(roster.length === 0);
      setExisting(dupe);
    })().catch((e) => active && setError(e instanceof Error ? e.message : "Could not load the roster."));
    return () => {
      active = false;
    };
  }, [identity, slot, date]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const s of students ?? []) {
      const status = marks[s.id ?? s.roll_number];
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
    }
    return { present, absent, unmarked: (students?.length ?? 0) - present - absent };
  }, [students, marks]);

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students ?? []) next[s.id ?? s.roll_number] = status;
    setMarks(next);
  }

  function flip(student: FacultyStudent, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [student.id ?? student.roll_number]: status }));
  }

  async function handleSubmit() {
    if (!slot || !students) return;
    setBusy(true);
    try {
      const entries = students.map((s) => ({
        studentId: s.id ?? s.roll_number,
        status: marks[s.id ?? s.roll_number] as AttendanceStatus,
      }));
      await submitAttendance({
        teacherId: identity.teacher.id,
        subjectName: slot.subjectName,
        attendanceDate: date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timetableGroup: slot.timetableGroup,
        lectureType: slot.lectureType,
        branch: slot.branch,
        year: slot.year,
        section: slot.section,
        venue: slot.venue,
        entries,
      });
      toast.success(`Attendance submitted — ${counts.present} present, ${counts.absent} absent.`);
      navigate("/faculty/attendance");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The submission was rejected.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const canSubmit = !!slot && !!students && students.length > 0 && counts.unmarked === 0 && !existing && !busy;

  return (
    <FacultyShell identity={identity} wide>
      <div className="space-y-6">
        <Link href="/faculty/attendance" className="f-handlink inline-flex items-center gap-1.5 text-[0.85rem] font-medium">
          <ArrowLeft size={14} />
          Back to attendance
        </Link>

        {error && (
          <div className="f-card border-[#E5C9C4] bg-[#FBEEEC] p-4 text-[0.85rem] text-[#8F3B2E]">{error}</div>
        )}

        {/* class picker when opened without a slot */}
        {!slotId && slots && (
          <div className="f-card p-4">
            <p className="f-eyebrow mb-3">Choose a class</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-[0.8rem] transition-colors",
                    slot?.id === s.id ? "border-[var(--f-navy)] bg-[var(--f-navy)] text-white" : "border-[var(--f-line)] bg-white hover:border-[var(--f-navy)]",
                  )}
                >
                  <span className="font-semibold">{s.subjectName}</span>
                  <span className="ml-2 font-mono text-[0.72rem] opacity-80">{["Mon", "Tue", "Wed", "Thu", "Fri"][s.dayOfWeek]} {s.startTime} · {s.timetableGroup}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {slot && (
          <>
            {/* header card */}
            <div className="f-card f-grain relative overflow-hidden bg-[var(--f-navy)] p-6 text-[#E9EEF2] sm:p-7">
              <div className="relative z-10">
                <p className="f-eyebrow !text-[#8FB3C9]">Attendance register</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-[-0.015em] text-white">
                    {prettySubject(slot.subjectName)}
                  </h1>
                  {lectureTypeChip(slot.lectureType)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.84rem] text-[#B9CBDA]">
                  <span className="flex items-center gap-1.5"><Clock size={13} />{formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}</span>
                  {slot.venue ? <span className="flex items-center gap-1.5"><MapPin size={13} />{slot.venue}</span> : null}
                  <span className="flex items-center gap-1.5"><Users size={13} />{slot.timetableGroup.split("+").join(" + ")}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-[0.8rem]">
                    <span className="font-mono text-[0.62rem] tracking-[0.14em] text-[#8FB3C9] uppercase">Date</span>
                    <input
                      type="date"
                      value={date}
                      min={daysAgoISO(30)}
                      max={todayISO()}
                      onChange={(e) => setDate(e.target.value)}
                      className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 font-mono text-[0.8rem] text-white [color-scheme:dark] focus:border-white/40 focus:outline-none"
                    />
                  </label>
                  <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.66rem] tracking-[0.08em] text-[#B9CBDA]">
                    <ShieldCheck size={12} />
                    atomic · audit-logged
                  </span>
                </div>
              </div>
            </div>

            {/* already submitted? */}
            {existing && (
              <div className="f-card flex flex-wrap items-center justify-between gap-3 border-[#BFDCC9] bg-[var(--f-tint)] p-4 sm:p-5">
                <p className="flex items-center gap-2.5 text-[0.9rem] font-medium text-[var(--f-green-deep)]">
                  <CheckCircle2 size={18} />
                  Attendance for this class was already submitted {existing.attendance_date === todayISO() ? "today" : `on ${existing.attendance_date}`} ({existing.present_count}/{existing.total_students} present).
                </p>
                <Link href={`/faculty/attendance/${existing.id}`} className="f-btn f-btn-ghost h-9 !text-[0.78rem]">
                  Open the submission
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* no roster */}
            {noRoster && students && (
              <div className="f-card flex items-start gap-3 border-[#E8DCBF] bg-[#FBF3DD] p-4 sm:p-5">
                <AlertTriangle size={18} className="mt-[2px] shrink-0 text-[#8A6212]" />
                <div>
                  <p className="text-[0.9rem] font-semibold text-[#5E430D]">No student roster is available for group {slot.timetableGroup}.</p>
                  <p className="mt-1 text-[0.82rem] leading-relaxed text-[#6B4E10]">
                    This class is verified in your timetable, but the {slot.year && slot.year > 1 ? `${slot.year === 2 ? "second" : "third"}-year` : ""} roster for {slot.timetableGroup} has not been imported into the attendance database yet. Ask the administrator to run the roster sync — attendance cannot be invented for students who are not enrolled.
                  </p>
                </div>
              </div>
            )}

            {/* roster */}
            {students && students.length > 0 && !existing && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ListChecks size={18} className="text-[var(--f-green)]" />
                    <p className="text-[0.95rem] font-semibold">
                      {students.length} student{students.length === 1 ? "" : "s"}
                      <span className="ml-2 font-mono text-[0.72rem] font-normal text-[var(--f-ink-3)]">{slot.timetableGroup.split("+").join(" + ")}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setAll("present")} className="f-btn f-btn-ghost h-9 !text-[0.78rem] !text-[var(--f-green)]">
                      <UserCheck size={13} />
                      Mark all present
                    </button>
                    <button onClick={() => setAll("absent")} className="f-btn f-btn-ghost h-9 !text-[0.78rem] !text-[#A23B2E]">
                      <UserX size={13} />
                      Mark all absent
                    </button>
                    <button onClick={() => setMarks({})} className="f-btn f-btn-quiet h-9 !text-[0.78rem]">
                      Clear
                    </button>
                  </div>
                </div>

                {/* live tally */}
                <div className="f-card sticky top-[4.6rem] z-20 grid grid-cols-3 divide-x divide-[var(--f-line)] overflow-hidden">
                  <div className="px-4 py-3 text-center">
                    <p className="font-mono text-[0.6rem] tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Present</p>
                    <p className="mt-0.5 font-display text-[1.5rem] font-semibold text-[var(--f-green)]">{counts.present}</p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="font-mono text-[0.6rem] tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Absent</p>
                    <p className="mt-0.5 font-display text-[1.5rem] font-semibold text-[#A23B2E]">{counts.absent}</p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="font-mono text-[0.6rem] tracking-[0.14em] text-[var(--f-ink-3)] uppercase">Unmarked</p>
                    <p className={cn("mt-0.5 font-display text-[1.5rem] font-semibold", counts.unmarked > 0 ? "text-[#8A6212]" : "text-[var(--f-ink-3)]")}>{counts.unmarked}</p>
                  </div>
                </div>

                {/* student rows */}
                <motion.div variants={staggerParent} initial="hidden" animate="show" className="f-card divide-y divide-dashed divide-[var(--f-line)] overflow-hidden">
                  {students.map((student, index) => {
                    const key = student.id ?? student.roll_number;
                    const status = marks[key];
                    return (
                      <motion.div key={key} variants={fadeUpItem} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", status === "present" && "bg-[color-mix(in_oklab,var(--f-tint)_55%,white)]", status === "absent" && "bg-[color-mix(in_oklab,#FBEEEC_60%,white)]")}>
                        <span className="w-7 shrink-0 text-right font-mono text-[0.68rem] text-[var(--f-ink-3)]">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.9rem] font-medium">{student.full_name}</p>
                          <p className="font-mono text-[0.68rem] text-[var(--f-ink-3)]">
                            {student.roll_number}{student.subsection ? ` · ${student.subsection}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 overflow-hidden rounded-xl border border-[var(--f-line)]">
                          <button
                            onClick={() => flip(student, "present")}
                            className={cn(
                              "flex h-10 items-center gap-1.5 px-3 text-[0.74rem] font-semibold transition-colors",
                              status === "present" ? "bg-[var(--f-green)] text-white" : "bg-white text-[var(--f-ink-2)] hover:bg-[var(--f-tint)]",
                            )}
                            aria-label={`Mark ${student.full_name} present`}
                            aria-pressed={status === "present"}
                          >
                            <UserCheck size={14} />
                            <span className="hidden sm:inline">P</span>
                          </button>
                          <button
                            onClick={() => flip(student, "absent")}
                            className={cn(
                              "flex h-10 items-center gap-1.5 border-l border-[var(--f-line)] px-3 text-[0.74rem] font-semibold transition-colors",
                              status === "absent" ? "bg-[#A23B2E] text-white" : "bg-white text-[var(--f-ink-2)] hover:bg-[#FBEEEC]",
                            )}
                            aria-label={`Mark ${student.full_name} absent`}
                            aria-pressed={status === "absent"}
                          >
                            <UserX size={14} />
                            <span className="hidden sm:inline">A</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* submit bar */}
                <div className="f-card sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-[0.82rem] text-[var(--f-ink-2)]">
                    {counts.unmarked > 0
                      ? `${counts.unmarked} student${counts.unmarked > 1 ? "s" : ""} still unmarked — every student must be marked before submitting.`
                      : `Ready: ${counts.present} present, ${counts.absent} absent of ${students.length}.`}
                  </p>
                  <button onClick={() => setConfirming(true)} disabled={!canSubmit} className="f-btn f-btn-primary h-11">
                    <ClipboardCheck size={16} />
                    Review &amp; submit
                  </button>
                </div>
              </>
            )}

            {/* confirmation dialog */}
            {confirming && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,28,38,0.55)] p-4" role="dialog" aria-modal="true" aria-label="Confirm attendance submission">
                <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="f-card w-full max-w-md bg-white p-6">
                  <p className="f-eyebrow">Final step</p>
                  <h3 className="mt-2 font-display text-[1.35rem] font-semibold tracking-[-0.01em]">Submit this register?</h3>
                  <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--f-ink-2)]">
                    <strong>{prettySubject(slot.subjectName)}</strong> · {slot.timetableGroup} · {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}, {formatTime12(slot.startTime)}.
                  </p>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--f-line)] rounded-xl border border-[var(--f-line)]">
                    <div className="py-3 text-center">
                      <p className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--f-ink-3)] uppercase">Present</p>
                      <p className="mt-0.5 text-[1.3rem] font-semibold text-[var(--f-green)]">{counts.present}</p>
                    </div>
                    <div className="py-3 text-center">
                      <p className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--f-ink-3)] uppercase">Absent</p>
                      <p className="mt-0.5 text-[1.3rem] font-semibold text-[#A23B2E]">{counts.absent}</p>
                    </div>
                    <div className="py-3 text-center">
                      <p className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--f-ink-3)] uppercase">Total</p>
                      <p className="mt-0.5 text-[1.3rem] font-semibold">{students?.length}</p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-start gap-2 text-[0.76rem] leading-relaxed text-[var(--f-ink-3)]">
                    <FileClock size={14} className="mt-[1px] shrink-0" />
                    Once submitted the register locks. Corrections are possible afterwards but require a written reason and are recorded in the audit trail.
                  </p>
                  <div className="mt-6 flex justify-end gap-2.5">
                    <button onClick={() => setConfirming(false)} className="f-btn f-btn-ghost h-11">Go back</button>
                    <button onClick={handleSubmit} disabled={busy} className="f-btn f-btn-primary h-11">
                      {busy ? "Submitting…" : "Confirm submission"}
                      <CheckCircle2 size={15} />
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
    </FacultyShell>
  );
}

/* ================================================================== */
/* Session detail — review & correct                                   */
/* ================================================================== */

function SessionDetailView({ identity, sessionId }: { identity: FacultyIdentity; sessionId: string }) {
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [entries, setEntries] = useState<AttendanceEntry[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<AttendanceEntry | null>(null);
  const [reload, setReload] = useState(0);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, e, a] = await Promise.all([
        getSession(sessionId),
        listEntries(sessionId),
        listAuditTrail(sessionId),
      ]);
      if (!active) return;
      if (!s) {
        setError("That attendance session was not found — it may belong to another teacher.");
        return;
      }
      setSession(s);
      setEntries(e);
      setAudit(a);
    })().catch((e) => active && setError(e instanceof Error ? e.message : "Could not load the session."));
    return () => {
      active = false;
    };
  }, [sessionId, reload]);

  if (error) {
    return (
      <FacultyShell identity={identity}>
        <div className="f-card mx-auto max-w-lg p-8 text-center">
          <XCircle size={28} className="mx-auto text-[#A23B2E]" />
          <p className="mt-3 text-[0.95rem] font-semibold">Session unavailable.</p>
          <p className="mt-2 text-[0.85rem] text-[var(--f-ink-2)]">{error}</p>
          <Link href="/faculty/attendance" className="f-btn f-btn-ghost mt-5 h-10">Back to attendance</Link>
        </div>
      </FacultyShell>
    );
  }

  if (!session || !entries) return <SessionSkeleton />;

  return (
    <FacultyShell identity={identity} wide>
      <div className="space-y-6">
        <Link href="/faculty/attendance" className="f-handlink inline-flex items-center gap-1.5 text-[0.85rem] font-medium">
          <ArrowLeft size={14} />
          Back to attendance
        </Link>

        {/* header */}
        <div className="f-card f-grain relative overflow-hidden bg-[var(--f-navy)] p-6 text-[#E9EEF2] sm:p-7">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="f-eyebrow !text-[#8FB3C9]">Submitted register</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-[-0.015em] text-white">{prettySubject(session.subject_name)}</h1>
                {lectureTypeChip(session.lecture_type)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.84rem] text-[#B9CBDA]">
                <span className="flex items-center gap-1.5"><FileClock size={13} />{new Date(`${session.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="flex items-center gap-1.5"><Clock size={13} />{formatTime12(session.start_time)} – {formatTime12(session.end_time)}</span>
                {session.venue ? <span className="flex items-center gap-1.5"><MapPin size={13} />{session.venue}</span> : null}
              </div>
              <div className="mt-2.5">{groupChip(session.timetable_group)}</div>
            </div>
            <div className="grid w-full max-w-[19rem] shrink-0 grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5 px-1 py-3 sm:w-auto">
              <div className="text-center">
                <p className="font-mono text-[0.58rem] tracking-[0.12em] text-[#8FB3C9] uppercase">Present</p>
                <p className="mt-0.5 text-[1.5rem] font-semibold text-[#7CC6A4]">{session.present_count}</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[0.58rem] tracking-[0.12em] text-[#8FB3C9] uppercase">Absent</p>
                <p className="mt-0.5 text-[1.5rem] font-semibold text-[#E5A199]">{session.absent_count}</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[0.58rem] tracking-[0.12em] text-[#8FB3C9] uppercase">Rate</p>
                <p className="mt-0.5 text-[1.5rem] font-semibold text-white">{attendancePct(session.present_count, session.total_students)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* entries */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold">
            <Users size={16} className="text-[var(--f-green)]" />
            The register
          </h2>
          <button onClick={() => setShowAudit((v) => !v)} className="f-btn f-btn-quiet h-9 !text-[0.78rem]">
            <History size={13} />
            {showAudit ? "Hide" : "Show"} audit trail ({audit.length})
          </button>
        </div>

        <div className="f-card divide-y divide-dashed divide-[var(--f-line)] overflow-hidden">
          {entries.map((entry) => {
            const student = entry.student;
            return (
              <div key={entry.id} className={cn("flex items-center gap-3 px-4 py-3", entry.status === "present" ? "bg-[color-mix(in_oklab,var(--f-tint)_40%,white)]" : "bg-[color-mix(in_oklab,#FBEEEC_45%,white)]")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", entry.status === "present" ? "bg-[var(--f-green)]/12 text-[var(--f-green)]" : "bg-[#A23B2E]/10 text-[#A23B2E]")}>
                  {entry.status === "present" ? <UserCheck size={15} /> : <UserX size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-medium">{student?.full_name ?? "Student"}</p>
                  <p className="font-mono text-[0.68rem] text-[var(--f-ink-3)]">{student?.roll_number ?? entry.student_id}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 font-mono text-[0.62rem] font-semibold tracking-[0.1em] uppercase", entry.status === "present" ? "bg-[var(--f-green)]/12 text-[var(--f-green-deep)]" : "bg-[#A23B2E]/10 text-[#A23B2E]")}>
                  {entry.status}
                </span>
                <button
                  onClick={() => setCorrecting(entry)}
                  className="rounded-lg border border-[var(--f-line)] bg-white px-2.5 py-1.5 text-[0.72rem] font-medium text-[var(--f-ink-2)] transition-colors hover:border-[var(--f-navy)] hover:text-[var(--f-navy)]"
                >
                  Correct
                </button>
              </div>
            );
          })}
        </div>

        {/* audit trail */}
        {showAudit && (
          <div className="f-card overflow-hidden">
            <p className="border-b border-[var(--f-line)] bg-[var(--f-paper-2)] px-4 py-3 font-mono text-[0.66rem] font-medium tracking-[0.14em] text-[var(--f-ink-3)] uppercase">
              Audit trail
            </p>
            <div className="divide-y divide-dashed divide-[var(--f-line)]">
              {audit.length === 0 ? (
                <p className="px-4 py-6 text-center text-[0.82rem] text-[var(--f-ink-2)]">No audit entries.</p>
              ) : (
                audit.map((row) => {
                  const student = entries.find((e) => e.student_id === row.student_id)?.student;
                  return (
                    <div key={row.id} className="px-4 py-3">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[0.82rem]">
                        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase", row.action === "submit" ? "bg-[var(--f-navy)]/10 text-[var(--f-navy)]" : "bg-[#8A6212]/10 text-[#8A6212]")}>
                          {row.action}
                        </span>
                        {student ? <span className="font-medium">{student.full_name}</span> : null}
                        {row.old_status && row.new_status ? (
                          <span className="font-mono text-[0.72rem] text-[var(--f-ink-2)]">{row.old_status} → {row.new_status}</span>
                        ) : null}
                        <span className="ml-auto font-mono text-[0.68rem] text-[var(--f-ink-3)]">
                          {new Date(row.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      {row.reason ? <p className="mt-1 text-[0.78rem] leading-relaxed text-[var(--f-ink-2)]">“{row.reason}”</p> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* correction dialog */}
        {correcting && (
          <CorrectDialog
            entry={correcting}
            onClose={() => setCorrecting(null)}
            onDone={() => {
              setCorrecting(null);
              setReload((n) => n + 1);
            }}
          />
        )}
      </div>
    </FacultyShell>
  );
}

function CorrectDialog({ entry, onClose, onDone }: { entry: AttendanceEntry; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<AttendanceStatus>(entry.status === "present" ? "absent" : "present");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  const reasonClean = reason.replace(/\s/g, "");

  async function handleCorrect() {
    setBusy(true);
    try {
      await correctAttendance(entry.session_id, entry.student_id, status, reason.trim());
      toast.success(`Corrected to ${status} — recorded in the audit trail.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The correction was rejected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,28,38,0.55)] p-4" role="dialog" aria-modal="true" aria-label="Correct attendance">
      <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="f-card w-full max-w-md bg-white p-6">
        <p className="f-eyebrow">Audited correction</p>
        <h3 className="mt-2 font-display text-[1.25rem] font-semibold tracking-[-0.01em]">
          {entry.student?.full_name ?? "Student"}
        </h3>
        <p className="mt-1 font-mono text-[0.72rem] text-[var(--f-ink-3)]">
          {entry.student?.roll_number ?? entry.student_id} · currently <span className="font-semibold text-[var(--f-ink-2)]">{entry.status}</span>
        </p>

        <div className="mt-4 flex overflow-hidden rounded-xl border border-[var(--f-line)]">
          <button
            onClick={() => setStatus("present")}
            className={cn("flex h-11 flex-1 items-center justify-center gap-2 text-[0.82rem] font-semibold transition-colors", status === "present" ? "bg-[var(--f-green)] text-white" : "bg-white text-[var(--f-ink-2)] hover:bg-[var(--f-tint)]")}
          >
            <UserCheck size={15} />
            Present
          </button>
          <button
            onClick={() => setStatus("absent")}
            className={cn("flex h-11 flex-1 items-center justify-center gap-2 border-l border-[var(--f-line)] text-[0.82rem] font-semibold transition-colors", status === "absent" ? "bg-[#A23B2E] text-white" : "bg-white text-[var(--f-ink-2)] hover:bg-[#FBEEEC]")}
          >
            <UserX size={15} />
            Absent
          </button>
        </div>

        <label className="mt-4 block">
          <span className="f-eyebrow mb-2 block">Reason (required, min 10 characters)</span>
          <textarea
            ref={areaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Student provided a medical certificate for this hour."
            className="f-input !h-auto resize-none !py-2.5"
          />
        </label>

        <p className="mt-3 flex items-start gap-2 text-[0.74rem] leading-relaxed text-[var(--f-ink-3)]">
          <ShieldCheck size={13} className="mt-[1px] shrink-0" />
          The original mark is preserved in the audit trail with your name, the new mark and this reason. Submissions are never silently overwritten.
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onClose} className="f-btn f-btn-ghost h-11">Cancel</button>
          <button onClick={handleCorrect} disabled={busy || reasonClean.length < 10 || status === entry.status} className="f-btn f-btn-primary h-11">
            {busy ? "Correcting…" : "Save correction"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
