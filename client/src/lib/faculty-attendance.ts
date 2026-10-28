/**
 * Faculty attendance portal — data layer for the SEPARATE "attendance_record"
 * Supabase project (https://jchoopzbwihjmhkjulfz.supabase.co).
 *
 * This client is completely independent of the student-facing NextLecture
 * clients: it uses its own env vars and its own Supabase Auth realm.
 *   VITE_FACULTY_ATTENDANCE_SUPABASE_URL            (browser-safe)
 *   VITE_FACULTY_ATTENDANCE_SUPABASE_PUBLISHABLE_KEY (browser-safe)
 * The matching secret key never ships to the browser — it is only used by the
 * server-side sync/provisioning scripts and the /api/faculty/sync endpoint.
 *
 * Degradation model (mirrors the LMS module):
 *   - env vars missing            → sample mode (read-only demo dataset)
 *   - env vars set, schema absent → auth works against Supabase Auth, data
 *     falls back to the same sample dataset with a persistent warning
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import {
  type AttendanceEntry,
  type AttendanceSession,
  type AttendanceStatus,
  type AuditRow,
  type FacultyAssignment,
  type FacultyStudent,
  type FacultyTeacher,
  type NormalSlot,
  type SubmitAttendanceInput,
  normalizeSlot,
  slotGroups,
} from "./faculty-attendance-types";
import {
  DEMO_ASSIGNMENTS,
  DEMO_SLOTS,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_TEACHER_BY_EMAIL,
} from "./faculty-attendance-demo";

const supabaseUrl = import.meta.env.VITE_FACULTY_ATTENDANCE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_FACULTY_ATTENDANCE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const facultySupabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** True when the env vars are missing entirely (read-only sample mode). */
export const facultyDemo = !facultySupabase;

/** Becomes true when the project is configured but the tables are missing. */
let schemaMissing = false;
export function isFacultySchemaMissing() {
  return schemaMissing;
}

function requireClient(): SupabaseClient {
  if (!facultySupabase) throw new Error("Faculty attendance is not configured. Add VITE_FACULTY_ATTENDANCE_SUPABASE_URL and VITE_FACULTY_ATTENDANCE_SUPABASE_PUBLISHABLE_KEY.");
  return facultySupabase;
}

/** Marks the schema as missing when a query hits an uninitialized project. */
function schemaGuard(error: { message: string; code?: string } | null) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  if (
    message.includes("does not exist")
    || message.includes("could not find the table")
    || message.includes("schema cache")
    || error.code === "PGRST205"
    || error.code === "42P01"
  ) {
    schemaMissing = true;
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function signInTeacher(email: string, password: string): Promise<Session | null> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    if (error.message?.toLowerCase().includes("invalid login")) {
      throw new Error("That email and password combination is incorrect.");
    }
    throw error;
  }
  return data.session ?? null;
}

export async function signOutTeacher() {
  if (!facultySupabase) return;
  await facultySupabase.auth.signOut();
}

export async function getFacultySession(): Promise<Session | null> {
  if (!facultySupabase) return null;
  const { data } = await facultySupabase.auth.getSession();
  return data.session ?? null;
}

export function subscribeFacultyAuth(callback: (session: Session | null) => void) {
  if (!facultySupabase) return () => undefined;
  const { data } = facultySupabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** Change the Supabase Auth password, then clear the must-change flag. */
export async function changeTeacherPassword(newPassword: string) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  const { error: rpcError } = await client.rpc("faculty_mark_password_changed");
  if (rpcError && !schemaGuard(rpcError)) throw rpcError;
}

/* ------------------------------------------------------------------ */
/* Teacher profile                                                     */
/* ------------------------------------------------------------------ */

export type TeacherResolution =
  | { mode: "live"; teacher: FacultyTeacher }
  | { mode: "auth-only"; teacher: FacultyTeacher } // auth ok, schema missing -> demo profile
  | { mode: "demo"; teacher: FacultyTeacher };

/**
 * Resolves the signed-in user to a teacher profile.
 * Throws on accounts that exist in Auth but are not active teachers.
 */
export async function resolveTeacher(session: Session | null): Promise<TeacherResolution> {
  if (!session?.user?.email) throw new Error("Not signed in.");

  if (!facultySupabase) {
    const demoId = DEMO_TEACHER_BY_EMAIL[session.user.email.toLowerCase()] ?? "demo-neeraj";
    return { mode: "demo", teacher: DEMO_TEACHERS[demoId] };
  }

  const { data, error } = await facultySupabase
    .from("faculty_teachers")
    .select("id,full_name,email,department,designation,profile_id,must_change_password,is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    if (schemaGuard(error)) {
      // Auth succeeded but the attendance tables are not applied yet.
      const demoId = DEMO_TEACHER_BY_EMAIL[session.user.email.toLowerCase()];
      if (!demoId) {
        throw new Error("Your account is not registered as a teacher in this portal.");
      }
      return { mode: "auth-only", teacher: DEMO_TEACHERS[demoId] };
    }
    throw error;
  }
  if (!data || data.is_active === false) {
    throw new Error("Your account is not authorized for the faculty portal. Contact the administrator.");
  }
  return { mode: "live", teacher: data as FacultyTeacher };
}

/* ------------------------------------------------------------------ */
/* Assignments & timetable                                             */
/* ------------------------------------------------------------------ */

export async function listAssignments(teacherId: string): Promise<FacultyAssignment[]> {
  if (!facultySupabase || schemaMissing) return DEMO_ASSIGNMENTS[teacherId] ?? [];
  const { data, error } = await facultySupabase
    .from("faculty_teaching_assignments")
    .select("id,subject_name,branch,year,section,timetable_group,lecture_types")
    .order("subject_name")
    .order("timetable_group");
  if (error) {
    if (schemaGuard(error)) return DEMO_ASSIGNMENTS[teacherId] ?? [];
    throw error;
  }
  return (data ?? []) as FacultyAssignment[];
}

export async function listTimetableSlots(teacherId: string): Promise<NormalSlot[]> {
  let raw;
  if (!facultySupabase || schemaMissing) {
    raw = DEMO_SLOTS.filter((s) => (s.teacherId ?? s.teacher_id) === teacherId);
  } else {
    const { data, error } = await facultySupabase
      .from("faculty_timetable_slots")
      .select("id,day_of_week,start_time,end_time,subject_name,branch,year,section,timetable_group,lecture_type,venue")
      .order("day_of_week")
      .order("start_time");
    if (error) {
      if (schemaGuard(error)) raw = DEMO_SLOTS.filter((s) => (s.teacherId ?? s.teacher_id) === teacherId);
      else throw error;
    } else {
      raw = data ?? [];
    }
  }
  return (raw ?? []).map(normalizeSlot).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

export async function listStudentsForGroups(groups: string[]): Promise<FacultyStudent[]> {
  if (!facultySupabase || schemaMissing) {
    return DEMO_STUDENTS.filter((s) => groups.includes(s.timetable_group))
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  }
  const { data, error } = await facultySupabase
    .from("faculty_students")
    .select("id,roll_number,crn,full_name,branch,year,section,subsection,timetable_group")
    .in("timetable_group", groups)
    .order("roll_number");
  if (error) {
    if (schemaGuard(error)) {
      return DEMO_STUDENTS.filter((s) => groups.includes(s.timetable_group))
        .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
    }
    throw error;
  }
  return (data ?? []) as FacultyStudent[];
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function listSessions(teacherId: string, options?: { date?: string; limit?: number }): Promise<AttendanceSession[]> {
  if (!facultySupabase || schemaMissing) return demoSessions(teacherId, options);
  let query = facultySupabase
    .from("faculty_attendance_sessions")
    .select("id,teacher_id,subject_name,attendance_date,start_time,end_time,branch,year,section,timetable_group,lecture_type,venue,status,total_students,present_count,absent_count,submitted_at")
    .order("attendance_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(options?.limit ?? 200);
  if (options?.date) query = query.eq("attendance_date", options.date);
  const { data, error } = await query;
  if (error) {
    if (schemaGuard(error)) return demoSessions(teacherId, options);
    throw error;
  }
  return (data ?? []) as AttendanceSession[];
}

export async function getSession(sessionId: string): Promise<AttendanceSession | null> {
  if (!facultySupabase || schemaMissing) {
    return demoSessions("*").find((s) => s.id === sessionId) ?? null;
  }
  const { data, error } = await facultySupabase
    .from("faculty_attendance_sessions")
    .select("id,teacher_id,subject_name,attendance_date,start_time,end_time,branch,year,section,timetable_group,lecture_type,venue,status,total_students,present_count,absent_count,submitted_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    if (schemaGuard(error)) return demoSessions("*").find((s) => s.id === sessionId) ?? null;
    throw error;
  }
  return (data as AttendanceSession) ?? null;
}

export async function listEntries(sessionId: string): Promise<AttendanceEntry[]> {
  if (!facultySupabase || schemaMissing) {
    const session = demoSessions("*").find((s) => s.id === sessionId);
    if (!session) return [];
    return demoEntriesFor(session);
  }
  const { data, error } = await facultySupabase
    .from("faculty_attendance_entries")
    .select("id,session_id,student_id,status,marked_at,updated_at,faculty_students(id,roll_number,crn,full_name,branch,year,section,subsection,timetable_group)")
    .eq("session_id", sessionId)
    .order("student_id");
  if (error) {
    if (schemaGuard(error)) return [];
    throw error;
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    session_id: row.session_id as string,
    student_id: row.student_id as string,
    status: row.status as AttendanceStatus,
    marked_at: row.marked_at as string,
    updated_at: row.updated_at as string,
    student: row.faculty_students as FacultyStudent | null ?? undefined,
  }));
}

export async function listAuditTrail(sessionId: string): Promise<AuditRow[]> {
  if (!facultySupabase || schemaMissing) {
    const session = demoSessions("*").find((s) => s.id === sessionId);
    if (!session) return [];
    return demoAuditFor(session);
  }
  const { data, error } = await facultySupabase
    .from("faculty_attendance_audit_log")
    .select("id,session_id,student_id,actor_id,action,old_status,new_status,reason,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) {
    if (schemaGuard(error)) return [];
    throw error;
  }
  return (data ?? []) as AuditRow[];
}

/* ------------------------------------------------------------------ */
/* Atomic submission & corrections (server-verified RPCs)              */
/* ------------------------------------------------------------------ */

export async function submitAttendance(input: SubmitAttendanceInput): Promise<string> {
  if (!facultySupabase || schemaMissing) {
    // Sample mode: keep the submission in memory so the workflow is explorable.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const id = `demo-submitted-${Date.now()}`;
    const present = input.entries.filter((e) => e.status === "present").length;
    demoSubmittedSessions.set(id, {
      id,
      teacher_id: input.teacherId ?? "",
      subject_name: input.subjectName,
      attendance_date: input.attendanceDate,
      start_time: input.startTime,
      end_time: input.endTime,
      branch: input.branch,
      year: input.year,
      section: input.section,
      timetable_group: input.timetableGroup,
      lecture_type: input.lectureType,
      venue: input.venue,
      status: "submitted",
      total_students: input.entries.length,
      present_count: present,
      absent_count: input.entries.length - present,
      submitted_at: new Date().toISOString(),
    });
    input.entries.forEach((entry) => demoEntryStatus.set(`${id}:${entry.studentId}`, entry.status));
    return id;
  }
  const payload = {
    p_subject_name: input.subjectName,
    p_attendance_date: input.attendanceDate,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_timetable_group: input.timetableGroup,
    p_lecture_type: input.lectureType,
    p_branch: input.branch,
    p_year: input.year,
    p_section: input.section,
    p_venue: input.venue,
    p_entries: input.entries.map((e) => ({ student_id: e.studentId, status: e.status })),
  };
  const { data, error } = await facultySupabase.rpc("faculty_submit_attendance", payload);
  if (error) {
    if (schemaGuard(error)) return `demo-${Date.now()}`;
    const raw = (error.message || "").replace(/^rpc error:?\s*/i, "");
    const known = [
      "NOT_AUTHORIZED", "INVALID_SUBJECT", "INVALID_TIMES", "INVALID_DATE",
      "INVALID_LECTURE_TYPE", "INVALID_ENTRIES", "INVALID_GROUP", "NOT_ASSIGNED",
      "DUPLICATE_SESSION", "NO_ROSTER", "DUPLICATE_STUDENTS", "ROSTER_MISMATCH",
      "INVALID_STATUS",
    ];
    const hit = known.find((code) => raw.includes(code));
    if (hit) throw new Error(raw.replace(`${hit}: `, "").trim());
    throw error;
  }
  return data as string;
}

export async function correctAttendance(sessionId: string, studentId: string, newStatus: AttendanceStatus, reason: string): Promise<void> {
  if (!facultySupabase || schemaMissing) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const session = demoSessions("*").find((s) => s.id === sessionId);
    const oldEntry = session ? demoEntriesFor(session).find((e) => e.student_id === studentId) : null;
    const oldStatus = oldEntry?.status;
    if (session && oldStatus && oldStatus !== newStatus) {
      demoEntryStatus.set(`${sessionId}:${studentId}`, newStatus);
      session.present_count += newStatus === "present" ? 1 : -1;
      session.absent_count += newStatus === "absent" ? 1 : -1;
      const studentName = oldEntry?.student?.full_name ?? "Student";
      demoAuditExtra.set(sessionId, [
        ...(demoAuditExtra.get(sessionId) ?? []),
        {
          id: `${sessionId}-audit-${Date.now()}`,
          session_id: sessionId,
          student_id: studentId,
          actor_id: session.teacher_id,
          action: "correct" as const,
          old_status: oldStatus,
          new_status: newStatus,
          reason,
          created_at: new Date().toISOString(),
        },
      ]);
      void studentName;
    }
    return;
  }
  const { error } = await facultySupabase.rpc("faculty_correct_attendance", {
    p_session_id: sessionId,
    p_student_id: studentId,
    p_new_status: newStatus,
    p_reason: reason,
  });
  if (error) {
    if (schemaGuard(error)) return;
    const raw = (error.message || "").replace(/^rpc error:?\s*/i, "");
    const hit = ["NOT_AUTHORIZED", "REASON_REQUIRED", "INVALID_STATUS", "ENTRY_NOT_FOUND", "NO_CHANGE"].find((code) => raw.includes(code));
    if (hit) throw new Error(raw.replace(`${hit}: `, "").trim());
    throw error;
  }
}

/** True when a session already exists for this slot on this date. */
export async function findExistingSession(
  teacherId: string,
  attendanceDate: string,
  startTime: string,
  timetableGroup: string,
): Promise<AttendanceSession | null> {
  const sessions = await listSessions(teacherId, { date: attendanceDate, limit: 100 });
  return sessions.find(
    (s) => s.start_time === startTime && s.timetable_group === timetableGroup,
  ) ?? null;
}

/* ------------------------------------------------------------------ */
/* Demo session generation (sample mode)                               */
/* ------------------------------------------------------------------ */

let demoSessionCache: AttendanceSession[] | null = null;
/**
 * Sample-mode overlay: submissions and corrections made while the database is
 * not connected are kept in memory so the whole workflow can be explored.
 * They never reach any server and reset on reload.
 */
const demoSubmittedSessions = new Map<string, AttendanceSession>();
const demoEntryStatus = new Map<string, AttendanceStatus>();
const demoAuditExtra = new Map<string, AuditRow[]>();

function demoEntriesFor(session: AttendanceSession): AttendanceEntry[] {
  const groups = slotGroups(session.timetable_group);
  const students = DEMO_STUDENTS.filter((s) => groups.includes(s.timetable_group))
    .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  return students.map((student, i) => {
    const key = `${session.id}:${student.id ?? student.roll_number}`;
    const fallback: AttendanceStatus = i % 7 === 3 ? "absent" : "present";
    return {
      id: `${session.id}-${i}`,
      session_id: session.id,
      student_id: student.id ?? student.roll_number,
      status: demoEntryStatus.get(key) ?? fallback,
      marked_at: session.submitted_at ?? new Date().toISOString(),
      updated_at: session.submitted_at ?? new Date().toISOString(),
      student: { ...student, id: student.id ?? student.roll_number },
    };
  });
}

function demoAuditFor(session: AttendanceSession): AuditRow[] {
  const base: AuditRow = {
    id: `${session.id}-audit`,
    session_id: session.id,
    student_id: null,
    actor_id: session.teacher_id,
    action: "submit",
    old_status: null,
    new_status: "submitted",
    reason: `Initial submission for ${session.subject_name} (${session.timetable_group}).`,
    created_at: session.submitted_at ?? new Date().toISOString(),
  };
  return [base, ...(demoAuditExtra.get(session.id) ?? [])];
}

function demoSessions(teacherId: string, options?: { date?: string; limit?: number }): AttendanceSession[] {
  if (!demoSessionCache) {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const seed = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const all: AttendanceSession[] = [];
    DEMO_SLOTS.forEach((raw, index) => {
      const slot = normalizeSlot(raw);
      // render a handful of past days of the week
      for (let back = 0; back < 14; back++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() - back);
        if ((day.getDay() + 6) % 7 !== slot.dayOfWeek) continue;
        if (day > now) continue;
        if (seed(index * 31 + back) > 0.45) continue; // not every class was marked
        const groups = slotGroups(slot.timetableGroup);
        const students = DEMO_STUDENTS.filter((s) => groups.includes(s.timetable_group));
        if (!students.length) continue;
        const present = students.filter((_, i) => seed(index * 97 + back * 13 + i) > 0.12).length;
        all.push({
          id: `demo-${index}-${back}`,
          teacher_id: (raw.teacherId ?? raw.teacher_id) ?? "",
          subject_name: slot.subjectName,
          attendance_date: iso(day),
          start_time: slot.startTime,
          end_time: slot.endTime,
          branch: slot.branch,
          year: slot.year,
          section: slot.section,
          timetable_group: slot.timetableGroup,
          lecture_type: slot.lectureType,
          venue: slot.venue,
          status: "submitted",
          total_students: students.length,
          present_count: present,
          absent_count: students.length - present,
          submitted_at: new Date(day).toISOString(),
        });
      }
    });
    demoSessionCache = all.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date) || b.start_time.localeCompare(a.start_time));
  }
  let rows = teacherId === "*" ? demoSessionCache : demoSessionCache.filter((s) => s.teacher_id === teacherId);
  // include submissions made during this sample-mode session
  const submitted = Array.from(demoSubmittedSessions.values());
  rows = (teacherId === "*" ? submitted : submitted.filter((s) => s.teacher_id === teacherId)).concat(rows);
  if (options?.date) rows = rows.filter((s) => s.attendance_date === options.date);
  if (options?.limit) rows = rows.slice(0, options.limit);
  return rows;
}

/** Test helper-ish: resets demo cache (used when switching demo identities). */
export function resetFacultyDemoCache() {
  demoSessionCache = null;
}
