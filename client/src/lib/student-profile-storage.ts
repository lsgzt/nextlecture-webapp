import type { StudentProfile } from "@shared/student-profile";

export const STUDENT_PROFILE_KEY = "nextlecture:student-profile";

export type ManualStudentProfileFields = {
  studentName: string;
  crn: string;
  fatherName: string;
  motherName: string;
  section: string;
  subsection: string;
  mentoringGroup: string;
  mentorName: string;
  mentorMobileNumber: string;
  venue: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isStudentProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<StudentProfile>;
  return typeof profile.studentName === "string" && typeof profile.crn === "string" && typeof profile.branch === "string" && typeof profile.section === "string" && typeof profile.subsection === "string";
}

export function readStoredStudentProfile(storage: StorageLike): StudentProfile | null {
  try {
    const raw = storage.getItem(STUDENT_PROFILE_KEY);
    const profile = raw ? JSON.parse(raw) : null;
    return isStudentProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

export function saveStudentProfile(storage: StorageLike, profile: StudentProfile) {
  storage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
}

export function createManualStudentProfile(branch: string, fields: ManualStudentProfileFields): StudentProfile {
  if (!fields.studentName.trim() || !fields.crn.trim()) {
    throw new Error("Name and CRN are required for a manual profile.");
  }
  return {
    studentName: fields.studentName.trim(),
    crn: fields.crn.trim(),
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
