/**
 * Run the faculty-attendance sync (roster + timetable + assignments) into the
 * SEPARATE "attendance_record" Supabase project, printing a validation report.
 *
 * Usage (from the repository root):
 *   bunx tsx scripts/faculty_attendance_sync.ts
 *
 * Requires:
 *   1. supabase/faculty-attendance/0001_init.sql applied in the project
 *   2. scripts/faculty_attendance_provision.ts run at least once (teachers)
 *   3. server env vars:
 *        FACULTY_ATTENDANCE_SUPABASE_URL (or VITE_FACULTY_ATTENDANCE_SUPABASE_URL)
 *        FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY
 */
import "dotenv/config";
import { runFacultyAttendanceSync } from "../server/facultyAttendanceSync";

async function main() {
  console.log("[sync] Faculty attendance synchronization — attendance_record project\n");
  const report = await runFacultyAttendanceSync();

  console.log(`Timetable source : ${report.timetable.sourceUrl ?? "(unknown)"}`);
  console.log(`Generated at     : ${report.timetable.sourceGeneratedAt ?? "(unknown)"}`);
  console.log(`Groups examined  : ${report.timetable.groupsExamined}`);
  console.log("\nTeachers:");
  for (const t of report.teachers) {
    console.log(`  - ${t.fullName} <${t.email}>`);
    console.log(`      groups     : ${t.matchedGroups.join(", ") || "(none found)"}`);
    console.log(`      assignments: ${t.assignments} · slots: ${t.slots}`);
    if (t.unmatchedLabels.length) {
      console.log(`      ⚠ similar-but-unmatched labels (flagged for review): ${t.unmatchedLabels.join(" / ")}`);
    }
  }
  console.log("\nStudents:");
  console.log(`  source records : ${report.students.sourceRecords}`);
  console.log(`  upserted       : ${report.students.upserted}`);
  console.log(`  invalid rows   : ${report.students.invalidRows}`);
  console.log(`  missing rolls  : ${report.students.missingRollNumbers}`);
  console.log(`  duplicates     : ${report.students.duplicateRollNumbers.length ? report.students.duplicateRollNumbers.join(", ") : "none"}`);
  if (report.students.groupsInDbWithoutRoster.length) {
    console.log(`  groups without roster: ${report.students.groupsInDbWithoutRoster.join(", ")}`);
  }
  if (report.warnings.length) {
    console.log("\nWarnings:");
    for (const w of report.warnings) console.log(`  ⚠ ${w}`);
  }
  console.log(`\n[sync] status: ${report.status} (started ${report.startedAt}, finished ${report.finishedAt})`);
  if (report.status !== "success") process.exit(2);
}

main().catch((error) => {
  console.error("[sync] failed:", error);
  process.exit(1);
});
