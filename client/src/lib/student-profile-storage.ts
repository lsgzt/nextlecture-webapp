import type { StudentProfile } from "@shared/student-profile";

export const STUDENT_PROFILE_KEY = "nextlecture:student-profile";
/** Bumped when every client must re-pick their official profile (Sep 2026 PDF layout + mobile/venue split). v3 forces another reset after intermediate bad parses. */
export const STUDENT_PROFILE_SCHEMA_VERSION = 3;
export const STUDENT_PROFILE_SCHEMA_KEY = "nextlecture:student-profile-schema";

export type ManualStudentProfileFields = {
  studentName: string;
  crn: string;
  registrationNumber: string;
  fatherName: string;
  motherName: string;
  section: string;
  subsection: string;
  mentoringGroup: string;
  mentorName: string;
  mentorMobileNumber: string;
  venue: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

function isStudentProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<StudentProfile>;
  return (
    typeof profile.studentName === "string" &&
    typeof profile.crn === "string" &&
    typeof profile.branch === "string" &&
    typeof profile.section === "string" &&
    typeof profile.subsection === "string"
  );
}

function clearStoredStudentProfile(storage: StorageLike) {
  storage.removeItem?.(STUDENT_PROFILE_KEY);
  // Fallback when removeItem is unavailable (tests / partial Storage mocks).
  if (!storage.removeItem) storage.setItem(STUDENT_PROFILE_KEY, "");
}

/**
 * One-time migration gate: profiles saved under an older schema are discarded so the user
 * re-selects from the corrected permanent-section directory (fixes merged mobile/venue, etc.).
 */
function ensureProfileSchema(storage: StorageLike): boolean {
  const current = Number(storage.getItem(STUDENT_PROFILE_SCHEMA_KEY) ?? "0");
  if (current === STUDENT_PROFILE_SCHEMA_VERSION) return true;
  clearStoredStudentProfile(storage);
  storage.setItem(STUDENT_PROFILE_SCHEMA_KEY, String(STUDENT_PROFILE_SCHEMA_VERSION));
  return false;
}

export function readStoredStudentProfile(storage: StorageLike): StudentProfile | null {
  try {
    if (!ensureProfileSchema(storage)) return null;
    const raw = storage.getItem(STUDENT_PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return isStudentProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

export function saveStudentProfile(storage: StorageLike, profile: StudentProfile) {
  storage.setItem(STUDENT_PROFILE_SCHEMA_KEY, String(STUDENT_PROFILE_SCHEMA_VERSION));
  storage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
}

export function createManualStudentProfile(branch: string, fields: ManualStudentProfileFields): StudentProfile {
  if (!fields.studentName.trim() || !fields.crn.trim()) {
    throw new Error("Name and CRN are required for a manual profile.");
  }
  return {
    studentName: fields.studentName.trim(),
    crn: fields.crn.trim(),
    registrationNumber: fields.registrationNumber.trim() || null,
    fatherName: fields.fatherName.trim() || null,
    motherName: fields.motherName.trim() || null,
    branch,
    section: fields.section.trim() || branch,
    subsection: fields.subsection.trim() || "Not provided",
    mentoringGroup: fields.mentoringGroup.trim() || null,
    mentorName: fields.mentorName.trim() || null,
    mentorMobileNumber: fields.mentorMobileNumber.trim() || null,
    venue: fields.venue.trim() || null,
    source: "manual",
    sourceUrl: null,
    savedAt: Date.now(),
  };
}
