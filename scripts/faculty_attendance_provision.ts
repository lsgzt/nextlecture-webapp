/**
 * Provision the initial faculty portal accounts in the SEPARATE
 * "attendance_record" Supabase project.
 *
 * Creates the Supabase Auth users and their faculty_teachers profile rows.
 * Idempotent: re-running never duplicates users and never resets passwords
 * that teachers have already changed.
 *
 * Usage (from the repository root):
 *   bunx tsx scripts/faculty_attendance_provision.ts
 *   FORCE_PASSWORD_RESET=1 bunx tsx scripts/faculty_attendance_provision.ts   # re-issue initial passwords
 *
 * Requires the migration supabase/faculty-attendance/0001_init.sql to be
 * applied in the attendance_record project, plus server env vars:
 *   FACULTY_ATTENDANCE_SUPABASE_URL (or VITE_FACULTY_ATTENDANCE_SUPABASE_URL)
 *   FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_HOST = "jchoopzbwihjmhkjulfz.supabase.co";

type TeacherSeed = {
  fullName: string;
  email: string;
  initialPassword: string;
  department: string;
  designation: string;
  /** GNDEC faculty-directory profile id (traceability). */
  profileId: string;
};

/**
 * The two initial teachers. Details verified against the repository's bundled
 * faculty directory (client/src/data/faculty-directory.ts) — do not invent.
 */
const TEACHERS: TeacherSeed[] = [
  {
    fullName: "Neeraj Kumar",
    email: "neerajkumar735561@gmail.com",
    initialPassword: "Neeraj",
    department: "Applied Science",
    designation: "Assistant Professor",
    profileId: "402",
  },
  {
    fullName: "Dr. Randhir Singh",
    email: "rsingh@gndec.ac.in",
    initialPassword: "rsingh",
    department: "Applied Science",
    designation: "Professor",
    profileId: "75",
  },
];

async function main() {
  const url = (process.env.FACULTY_ATTENDANCE_SUPABASE_URL || process.env.VITE_FACULTY_ATTENDANCE_SUPABASE_URL || "").trim();
  const secretKey = (process.env.FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY || "").trim();

  if (!url || !secretKey) {
    console.error(
      "[provision] Missing configuration.\n" +
      "Set FACULTY_ATTENDANCE_SUPABASE_URL and FACULTY_ATTENDANCE_SUPABASE_SECRET_KEY (server-only) in the environment.\n" +
      "The secret key must never be exposed to the browser or committed to GitHub.",
    );
    process.exit(1);
  }

  const host = url.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  if (host !== EXPECTED_HOST) {
    console.error(
      `[provision] SAFETY ABORT: the configured URL (${host}) is not the attendance_record project (${EXPECTED_HOST}).\n` +
      "Faculty accounts may only be provisioned in the dedicated project. Fix the environment variables and retry.",
    );
    process.exit(1);
  }

  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const forceReset = process.env.FORCE_PASSWORD_RESET === "1";

  // ---- check the schema (profiles can only be linked once it exists) ----
  const probe = await admin.from("faculty_teachers").select("id").limit(1);
  const schemaMissing = Boolean(
    probe.error
    && (probe.error.code === "PGRST205"
      || probe.error.code === "42P01"
      || /does not exist|schema cache/i.test(probe.error.message ?? "")),
  );
  if (probe.error && !schemaMissing) {
    console.error(`[provision] Could not read faculty_teachers: ${probe.error.message}`);
    process.exit(1);
  }
  if (schemaMissing) {
    console.warn(
      "[provision] ⚠ faculty_teachers does not exist yet — apply supabase/faculty-attendance/0001_init.sql in the attendance_record project.\n" +
      "  The Auth users will still be created now; re-run this script after the migration to link their profiles.",
    );
  }

  for (const teacher of TEACHERS) {
    const email = teacher.email.toLowerCase();

    // ---- locate or create the auth user -----------------------------------
    let page = 1;
    let userId: string | null = null;
    while (userId === null) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (list.error) {
        console.error(`[provision] listUsers failed: ${list.error.message}`);
        process.exit(1);
      }
      const match = list.data?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (match) {
        userId = match.id;
        break;
      }
      const nextPage = list.data?.nextPage ?? null;
      if (nextPage === null) break;
      page = nextPage;
    }

    let userExisted = userId !== null;

    if (userId === null) {
      const created = await admin.auth.admin.createUser({
        email,
        password: teacher.initialPassword,
        email_confirm: true, // no verification email; initial passwords are issued by the administrator
        user_metadata: { full_name: teacher.fullName, role: "faculty_teacher" },
      });
      if (created.error) {
        console.error(`[provision] createUser failed for ${email}: ${created.error.message}`);
        process.exit(1);
      }
      userId = created.data.user.id;
      userExisted = false;
      console.log(`[provision] created auth user ${email} (${userId})`);
    } else {
      console.log(`[provision] auth user already exists ${email} (${userId})`);
    }

    // ---- password handling (never clobber a changed password) --------------
    if (userExisted && forceReset) {
      const updated = await admin.auth.admin.updateUserById(userId, { password: teacher.initialPassword, email_confirm: true });
      if (updated.error) {
        console.error(`[provision] password reset failed for ${email}: ${updated.error.message}`);
        process.exit(1);
      }
      console.log(`[provision] password re-issued for ${email} (FORCE_PASSWORD_RESET=1)`);
    } else if (userExisted) {
      console.log(`[provision] leaving the existing password for ${email} untouched (use FORCE_PASSWORD_RESET=1 to re-issue)`);
    }

    // ---- upsert the profile row (id = auth user id) ------------------------
    if (schemaMissing) {
      console.log(`[provision] profile link SKIPPED for ${email} (faculty_teachers missing — re-run after the migration)`);
      continue;
    }
    const { error: profileError } = await admin.from("faculty_teachers").upsert(
      {
        id: userId,
        full_name: teacher.fullName,
        email,
        department: teacher.department,
        designation: teacher.designation,
        profile_id: teacher.profileId,
        must_change_password: true,
        is_active: true,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      console.error(`[provision] faculty_teachers upsert failed for ${email}: ${profileError.message}`);
      process.exit(1);
    }
    console.log(`[provision] profile linked: ${teacher.fullName} — ${teacher.department}, ${teacher.designation} (profile_id ${teacher.profileId})`);
  }

  console.log("\n[provision] Done. Both teachers can now sign in at /faculty/login.");
  console.log("[provision] Next: run the sync script (scripts/faculty_attendance_sync.ts) to import rosters and timetables.");
}

main().catch((error) => {
  console.error("[provision] failed:", error);
  process.exit(1);
});
