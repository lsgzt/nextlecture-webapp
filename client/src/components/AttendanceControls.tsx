import { Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AttendanceRecordInput, AttendanceStatus } from "@shared/attendance";
import type { StudentProfile } from "@shared/student-profile";
import type { Lecture } from "@shared/timetable";
import { createAttendanceClient, createAttendanceRecordInput, createLectureKey } from "@/lib/attendance";

type AttendanceControlsProps = {
  profile: StudentProfile;
  groupName: string;
  attendanceDate: string;
  lecture: Lecture;
  recordsByKey?: Record<string, AttendanceStatus | undefined>;
  onSynchronized?: (record: AttendanceRecordInput, status: AttendanceStatus | null) => void;
  compact?: boolean;
};

export function AttendanceControls({ profile, groupName, attendanceDate, lecture, recordsByKey = {}, onSynchronized, compact = false }: AttendanceControlsProps) {
  const client = useMemo(() => createAttendanceClient({ storage: localStorage }), []);
  const [lectureKey, setLectureKey] = useState<string | null>(null);
  const [pending, setPending] = useState<AttendanceStatus | "clear" | null>(null);
  const [status, setStatus] = useState<AttendanceStatus | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void createLectureKey(attendanceDate, groupName, lecture).then(key => {
      if (active) setLectureKey(key);
    }).catch(() => {
      if (active) setError("This lecture could not be prepared for attendance.");
    });
    return () => { active = false; };
  }, [attendanceDate, groupName, lecture]);

  useEffect(() => {
    if (lectureKey) setStatus(recordsByKey[lectureKey]);
  }, [lectureKey, recordsByKey]);

  async function mark(nextStatus: AttendanceStatus) {
    setPending(nextStatus);
    setError(null);
    try {
      const record = await createAttendanceRecordInput(attendanceDate, groupName, lecture, nextStatus);
      await client.saveRecord(profile, record);
      setStatus(nextStatus);
      onSynchronized?.(record, nextStatus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Attendance could not be saved. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function clear() {
    if (!lectureKey) return;
    setPending("clear");
    setError(null);
    try {
      await client.clearRecord(profile, attendanceDate, lectureKey);
      const record = await createAttendanceRecordInput(attendanceDate, groupName, lecture, status ?? "present");
      setStatus(undefined);
      onSynchronized?.(record, null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Attendance could not be cleared. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const size = compact ? "min-h-8 px-2.5 text-xs" : "min-h-10 px-3 text-sm";
  const disabled = Boolean(pending || !lectureKey);
  return <div className={compact ? "mt-3" : "mt-4 border-t border-border pt-4"}>
    <div className="flex flex-wrap items-center gap-2" aria-label={`Attendance actions for ${lecture.subject}`}>
      <button type="button" onClick={() => void mark("present")} disabled={disabled} aria-pressed={status === "present"} className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${status === "present" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-300"}`}>{pending === "present" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Present</button>
      <button type="button" onClick={() => void mark("absent")} disabled={disabled} aria-pressed={status === "absent"} className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${status === "absent" ? "border-rose-600 bg-rose-600 text-white" : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-950 dark:bg-rose-950/35 dark:text-rose-300"}`}>{pending === "absent" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}Absent</button>
      <button type="button" onClick={() => void clear()} disabled={disabled || !status} className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background font-bold text-muted-foreground transition hover:border-teal-300 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:text-teal-200`}>{pending === "clear" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Clear</button>
      {status && <span className={`text-xs font-bold ${status === "present" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{status === "present" ? "Marked present" : "Marked absent"}</span>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-700 dark:text-rose-300">{error}</p>}
  </div>;
}
