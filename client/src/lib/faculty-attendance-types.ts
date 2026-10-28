/**
 * Shared types for the faculty attendance portal (attendance_record project).
 * Mirrors supabase/faculty-attendance/0001_init.sql one-for-one.
 */

export type LectureType = "L" | "T" | "P";

export const LECTURE_TYPE_LABEL: Record<LectureType, string> = {
  L: "Lecture",
  T: "Tutorial",
  P: "Practical",
};

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export type FacultyTeacher = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  profile_id: string | null;
  must_change_password: boolean;
  is_active: boolean;
};

export type FacultyStudent = {
  id?: string;
  roll_number: string;
  crn: string | null;
  full_name: string;
  branch: string;
  year: number;
  section: string;
  subsection: string | null;
  timetable_group: string;
};

export type FacultyAssignment = {
  id?: string;
  subject_name: string;
  branch: string | null;
  year: number | null;
  section: string | null;
  timetable_group: string;
  lecture_types: string;
};

export type FacultySlot = {
  id?: string;
  teacher_id?: string;
  teacherId?: string;
  day_of_week?: number;
  dayOfWeek?: number;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  subject_name?: string;
  subjectName?: string;
  branch?: string | null;
  year?: number | null;
  section?: string | null;
  timetable_group?: string;
  timetableGroup?: string;
  lecture_type?: LectureType | null;
  lectureType?: LectureType | null;
  venue?: string | null;
};

/** Normalized slot shape used by the UI. */
export type NormalSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  branch: string | null;
  year: number | null;
  section: string | null;
  timetableGroup: string;
  lectureType: LectureType | null;
  venue: string | null;
};

export type AttendanceStatus = "present" | "absent";

export type AttendanceSession = {
  id: string;
  teacher_id: string;
  subject_name: string;
  attendance_date: string;
  start_time: string;
  end_time: string;
  branch: string | null;
  year: number | null;
  section: string | null;
  timetable_group: string;
  lecture_type: LectureType | null;
  venue: string | null;
  status: "submitted";
  total_students: number;
  present_count: number;
  absent_count: number;
  submitted_at: string | null;
};

export type AttendanceEntry = {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
  updated_at: string;
  student?: FacultyStudent;
};

export type AuditRow = {
  id: string;
  session_id: string | null;
  student_id: string | null;
  actor_id: string | null;
  action: "submit" | "correct";
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

export type SyncReport = {
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  report: {
    students?: {
      upserted?: number;
      inactive?: number;
      missing_roll_numbers?: number;
      duplicate_roll_numbers?: string[];
      invalid_rows?: number;
      groups_without_roster?: string[];
      [key: string]: unknown;
    };
    assignments?: Record<string, unknown>;
    timetable?: Record<string, unknown>;
    unmatched_teachers?: string[];
    [key: string]: unknown;
  };
};

export type SubmitAttendanceInput = {
  teacherId?: string;
  subjectName: string;
  attendanceDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timetableGroup: string; // "CSF1" or "CSF1+CSF2"
  lectureType: LectureType | null;
  branch: string | null;
  year: number | null;
  section: string | null;
  venue: string | null;
  entries: { studentId: string; status: AttendanceStatus }[];
};

export function normalizeSlot(slot: FacultySlot): NormalSlot {
  return {
    id: slot.id ?? `${slot.teacherId ?? slot.teacher_id ?? "t"}-${slot.dayOfWeek ?? slot.day_of_week}-${slot.startTime ?? slot.start_time}-${slot.timetableGroup ?? slot.timetable_group}`,
    dayOfWeek: slot.dayOfWeek ?? slot.day_of_week ?? 0,
    startTime: slot.startTime ?? slot.start_time ?? "00:00",
    endTime: slot.endTime ?? slot.end_time ?? "00:00",
    subjectName: slot.subjectName ?? slot.subject_name ?? "",
    branch: slot.branch ?? null,
    year: slot.year ?? null,
    section: slot.section ?? null,
    timetableGroup: slot.timetableGroup ?? slot.timetable_group ?? "",
    lectureType: slot.lectureType ?? slot.lecture_type ?? null,
    venue: slot.venue ?? null,
  };
}

export function slotGroups(timetableGroup: string): string[] {
  return timetableGroup.split("+").map((g) => g.trim()).filter(Boolean);
}

export function prettySubject(subject: string): string {
  const map: Record<string, string> = {
    "MATH I": "Mathematics-I",
    "MATH II": "Mathematics-II",
    PHYSICS: "Physics",
    CHEMISTRY: "Chemistry",
    PRP: "PRP (Problem Solving & Programming)",
    PWP: "PWP (Programming with Python)",
    BEE: "Basic Electrical Engineering",
    ME: "Mechanical Engineering",
  };
  return map[subject.toUpperCase()] ?? subject;
}
