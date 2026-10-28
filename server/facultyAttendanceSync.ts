/**
 * Faculty attendance — controlled synchronization into the SEPARATE
 * "attendance_record" Supabase project.
 *
 * This process:
 *   1. reads the official GNDEC timetable (same public source the app uses —
 *      read-only, never modified),
 *   2. reads the public first-year student directory (same source the Android
 *      profile recovery uses — read-only),
 *   3. matches every ACTIVE teacher registered in faculty_teachers against the
 *      timetable's teacher labels,
 *   4. upserts students / teaching assignments / weekly slots into the new
 *      project using the SECRET key (server-only env),
 *   5. records a run in faculty_sync_runs and returns a validation report.
 *
 * The existing NextLecture database is never touched. The new project is
 * independently usable: once data is copied, later changes to the original
 * sources do not silently delete it.
 *
 * Invoked from:
 *   - scripts/faculty_attendance_sync.ts (admin CLI, one-off / scheduled)
 *   - POST /api/faculty/sync (secret-protected endpoint, e.g. Vercel cron)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAndroidStudentDirectory } from "./androidProfileRecovery";
import { getOfficialTimetable } from "./timetable";
import type { Lecture, TimetablePayload, Weekday } from "../shared/timetable";

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const BRANCHES = ["RAI", "MCA", "MBA", "BCA", "BBA", "CE", "CS", "EC", "EE", "IT", "ME"];

export type FacultySyncReport = {
  startedAt: string;
  finishedAt: string | null;
  status: "success" | "partial" | "failed";
  teachers: Array<{
    email: string;
    fullName: string;
    matchedGroups: string[];
    unmatchedLabels: string[];
    assignments: number;
    slots: number;
  }>;
  students: {
    sourceRecords: number;
    upserted: number;
    invalidRows: number;
    missingRollNumbers: number;
    duplicateRollNumbers: string[];
    groupsInDbWithoutRoster: string[];
  };
  timetable: {
    sourceUrl: string | null;
    sourceGeneratedAt: string | null;
    groupsExamined: number;
  };
  warnings: string[];
};

/** Attends project admin client — the secret key NEVER leaves this module. */
export function getFacultyAttendanceAdminClient(): SupabaseClient | null {
  const url = (process.env.FACULTY_ATTENDANCE_SUPABASE_URL || process.env.VITE_FACULTY_ATTENDANCE_SUPABASE_URL || "").trim();
  const secretKey = (process.env.FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secretKey) return null;
  if (!/jchoopzbwihjmhkjulfz\.supabase\.co/.test(url)) {
    throw new Error(
      `Refusing to sync: FACULTY_ATTENDANCE_SUPABASE_URL (${url.replace(/https:\/\//, "").split(".")[0]}) is not the attendance_record project. ` +
      "Faculty attendance data may only be written to the dedicated project.",
    );
  }
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function norm(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Damerau-free lightweight token scoring — strict equality is the primary path. */
function labelMatchesTeacher(cellTeacher: string | null, fullName: string): boolean {
  if (!cellTeacher) return false;
  const target = norm(fullName);
  const parts = cellTeacher.split(/[,/]| and /i);
  return parts.some((part) => norm(part) === target);
}

/** CSF1 -> (1, 'CS', 'CSF'); D2ECA1 -> (2, 'EC', 'ECA') */
function deriveYearBranchSection(groupCode: string): { year: number; branch: string; section: string } {
  const dPrefix = /^D(\d)(.+)$/.exec(groupCode);
  const year = dPrefix ? Number(dPrefix[1]) : 1;
  const rest = dPrefix ? dPrefix[2] : groupCode;
  const branch = BRANCHES.find((b) => rest.startsWith(b)) ?? rest.slice(0, 2);
  const section = /\d$/.test(rest) ? rest.slice(0, -1) : rest;
  return { year, branch, section };
}

type DerivedSlot = {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  branch: string | null;
  year: number | null;
  section: string | null;
  timetableGroup: string;
  lectureType: string | null;
  venue: string | null;
  sourceUrl: string | null;
};

/**
 * The full sync. Throws only on configuration errors; data-quality issues are
 * reported through the returned report.
 */
export async function runFacultyAttendanceSync(): Promise<FacultySyncReport> {
  const report: FacultySyncReport = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "success",
    teachers: [],
    students: {
      sourceRecords: 0,
      upserted: 0,
      invalidRows: 0,
      missingRollNumbers: 0,
      duplicateRollNumbers: [],
      groupsInDbWithoutRoster: [],
    },
    timetable: { sourceUrl: null, sourceGeneratedAt: null, groupsExamined: 0 },
    warnings: [],
  };

  const admin = getFacultyAttendanceAdminClient();
  if (!admin) {
    throw new Error(
      "Faculty sync is not configured. Set FACULTY_ATTENDANCE_SUPABASE_URL (or VITE_FACULTY_ATTENDANCE_SUPABASE_URL) and FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY in the server environment.",
    );
  }

  // Start a sync run row (service-role bypasses RLS on faculty_sync_runs).
  const run = await admin.from("faculty_sync_runs").insert({}).select("id").single();
  const runId = (run.data as { id?: string } | null)?.id ?? null;

  try {
    // ---------------------------------------------------------------- sources
    const [timetableResult, directory] = await Promise.all([
      getOfficialTimetable(true),
      getAndroidStudentDirectory(),
    ]);
    const payload: TimetablePayload = timetableResult.cache.data;
    report.timetable.sourceUrl = timetableResult.cache.sourceUrl;
    report.timetable.sourceGeneratedAt = payload.sourceGeneratedAt ?? null;
    report.timetable.groupsExamined = payload.groups.length;

    // ---------------------------------------------------------------- teachers
    const { data: teacherRows, error: teacherError } = await admin
      .from("faculty_teachers")
      .select("id,full_name,email,is_active");
    if (teacherError) throw new Error(`Could not read faculty_teachers: ${teacherError.message}`);
    const teachers = (teacherRows ?? []).filter((t: { is_active: boolean }) => t.is_active);
    if (teachers.length === 0) {
      report.warnings.push("No active teachers are registered in faculty_teachers — nothing to map. Run the provisioning script first.");
    }

    // ------------------------------------------------- derive assignments/slots
    type AssignmentRow = {
      teacher_id: string;
      subject_name: string;
      branch: string | null;
      year: number | null;
      section: string | null;
      timetable_group: string;
      lecture_types: string;
    };
    const assignmentRows = new Map<string, AssignmentRow>();
    const slotRows: DerivedSlot[] = [];

    for (const teacher of teachers as Array<{ id: string; full_name: string; email: string }>) {
      const matched = new Set<string>();
      const unmatchedLabels = new Set<string>();

      // (groupCode -> lectures of THIS teacher)
      const byGroup = new Map<string, Lecture[]>();
      for (const groupTimetable of payload.timetables) {
        const code = groupTimetable.group.code;
        for (const lecture of groupTimetable.lectures) {
          if (labelMatchesTeacher(lecture.teacher, teacher.full_name)) {
            const list = byGroup.get(code) ?? [];
            list.push(lecture);
            byGroup.set(code, list);
            matched.add(code);
          } else if (lecture.teacher) {
            // record labels that mention part of the teacher's name but did
            // not match exactly — flagged for admin review, never guessed
            const targetTokens = norm(teacher.full_name);
            const cellTokens = norm(lecture.teacher);
            if (targetTokens.length > 3 && cellTokens.includes(targetTokens.slice(0, 4)) && !labelMatchesTeacher(lecture.teacher, teacher.full_name)) {
              unmatchedLabels.add(lecture.teacher);
            }
          }
        }
      }

      // assignments: one per (teacher, subject, group)
      byGroup.forEach((lectures, code) => {
        const { year, branch, section } = deriveYearBranchSection(code);
        const subjectSet = Array.from(new Set(lectures.map((l) => l.subject)));
        subjectSet.forEach((subject) => {
          const types = Array.from(new Set(lectures.filter((l) => l.subject === subject).map((l) => l.lectureType).filter(Boolean))) as string[];
          const key = `${teacher.id}|${subject}|${code}`;
          assignmentRows.set(key, {
            teacher_id: teacher.id,
            subject_name: subject,
            branch,
            year,
            section,
            timetable_group: code,
            lecture_types: types.join(","),
          });
        });
      });

      // slots: merge identical (day,time,subject,venue) lectures across groups
      const merged = new Map<string, { groups: string[]; lecture: Lecture }>();
      byGroup.forEach((lectures, code) => {
        lectures.forEach((lecture) => {
          const key = `${lecture.day}|${lecture.startTime}|${lecture.subject}|${lecture.lectureType ?? ""}|${lecture.venue ?? ""}`;
          const entry = merged.get(key);
          if (entry) entry.groups.push(code);
          else merged.set(key, { groups: [code], lecture });
        });
      });
      merged.forEach(({ groups, lecture }) => {
        const unique = Array.from(new Set(groups)).sort();
        const { year, branch, section } = deriveYearBranchSection(unique[0]);
        slotRows.push({
          teacherId: teacher.id,
          dayOfWeek: WEEKDAYS.indexOf(lecture.day),
          startTime: lecture.startTime,
          endTime: lecture.endTime,
          subjectName: lecture.subject,
          branch,
          year,
          section,
          timetableGroup: unique.join("+"),
          lectureType: lecture.lectureType,
          venue: lecture.venue,
          sourceUrl: timetableResult.cache.sourceUrl,
        });
      });

      report.teachers.push({
        email: teacher.email,
        fullName: teacher.full_name,
        matchedGroups: Array.from(matched).sort(),
        unmatchedLabels: Array.from(unmatchedLabels).slice(0, 10),
        assignments: 0, // filled after upsert
        slots: slotRows.filter((s) => s.teacherId === teacher.id).length,
      });
    }

    // ---------------------------------------------------------------- students
    const seenRoll = new Set<string>();
    const duplicates = new Set<string>();
    let invalid = 0;
    let missingRoll = 0;
    const studentRows: Array<{
      roll_number: string;
      crn: string | null;
      full_name: string;
      branch: string;
      year: number;
      section: string;
      subsection: string | null;
      timetable_group: string;
      is_active: boolean;
    }> = [];

    type DirectoryRecord = { crn?: string; registrationNumber?: string; candidateName?: string; branch?: string; section?: string; subsection?: string };
    for (const record of directory as unknown as DirectoryRecord[]) {
      const roll = (record.registrationNumber ?? "").trim();
      const name = (record.candidateName ?? "").trim();
      const group = (record.subsection ?? "").trim();
      if (!roll) {
        missingRoll += 1;
        continue;
      }
      if (!name || !(record.branch ?? "").trim() || !(record.section ?? "").trim() || !group) {
        invalid += 1;
        continue;
      }
      if (seenRoll.has(roll)) {
        duplicates.add(roll);
        continue;
      }
      seenRoll.add(roll);
      studentRows.push({
        roll_number: roll,
        crn: (record.crn ?? "").trim() || null,
        full_name: name,
        branch: (record.branch ?? "").trim(),
        year: 1, // the official directory is the first-year roster
        section: (record.section ?? "").trim(),
        subsection: group,
        timetable_group: group,
        is_active: true,
      });
    }
    report.students.sourceRecords = directory.length;
    report.students.missingRollNumbers = missingRoll;
    report.students.invalidRows = invalid;
    report.students.duplicateRollNumbers = Array.from(duplicates);

    // Upsert in batches (PostgREST body limits)
    for (let i = 0; i < studentRows.length; i += 400) {
      const batch = studentRows.slice(i, i + 400);
      const { error } = await admin
        .from("faculty_students")
        .upsert(batch, { onConflict: "roll_number", ignoreDuplicates: false });
      if (error) throw new Error(`Student upsert failed (batch ${Math.floor(i / 400) + 1}): ${error.message}`);
      report.students.upserted += batch.length;
    }

    // ---------------------------------------------------------------- upserts
    const assignmentList = Array.from(assignmentRows.values());
    for (let i = 0; i < assignmentList.length; i += 200) {
      const batch = assignmentList.slice(i, i + 200);
      const { error } = await admin
        .from("faculty_teaching_assignments")
        .upsert(batch, { onConflict: "teacher_id,subject_name,timetable_group" });
      if (error) throw new Error(`Assignment upsert failed: ${error.message}`);
    }
    for (const row of report.teachers) {
      row.assignments = assignmentList.filter((a) => a.teacher_id === (teachers as Array<{ id: string; email: string }>).find((t) => t.email === row.email)?.id).length;
    }

    for (let i = 0; i < slotRows.length; i += 200) {
      const batch = slotRows.slice(i, i + 200);
      const dbBatch = batch.map((slot) => ({
        teacher_id: slot.teacherId,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime,
        end_time: slot.endTime,
        subject_name: slot.subjectName,
        branch: slot.branch,
        year: slot.year,
        section: slot.section,
        timetable_group: slot.timetableGroup,
        lecture_type: slot.lectureType,
        venue: slot.venue,
        source_url: slot.sourceUrl,
        is_active: true,
      }));
      const { error } = await admin
        .from("faculty_timetable_slots")
        .upsert(dbBatch, { onConflict: "teacher_id,day_of_week,start_time,timetable_group,subject_name" });
      if (error) throw new Error(`Timetable slot upsert failed: ${error.message}`);
    }

    // --------------------------------------------------------- roster coverage
    const neededGroups = new Set<string>([
      ...assignmentList.map((a) => a.timetable_group),
      ...slotRows.map((s) => s.timetableGroup.split("+")).flat(),
    ]);
    const { data: covered } = await admin.from("faculty_students").select("timetable_group").in("timetable_group", Array.from(neededGroups));
    const coveredSet = new Set((covered ?? []).map((r: { timetable_group: string }) => r.timetable_group));
    report.students.groupsInDbWithoutRoster = Array.from(neededGroups).filter((g) => !coveredSet.has(g)).sort();
    if (report.students.groupsInDbWithoutRoster.length > 0) {
      report.warnings.push(
        `No student roster exists for: ${report.students.groupsInDbWithoutRoster.join(", ")}. ` +
        "These classes stay in the timetable but attendance cannot be submitted for them until an administrator imports their roster (the bundled directory only covers first-year).",
      );
    }

    if (missingRoll > 0 || invalid > 0 || duplicates.size > 0) {
      report.status = "partial";
    }
    report.finishedAt = new Date().toISOString();
  } catch (error) {
    report.status = "failed";
    report.finishedAt = new Date().toISOString();
    if (runId) {
      await admin.from("faculty_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), report }).eq("id", runId);
    }
    throw error;
  }

  if (runId) {
    await admin.from("faculty_sync_runs").update({ status: report.status, finished_at: report.finishedAt, report }).eq("id", runId);
  }
  return report;
}
