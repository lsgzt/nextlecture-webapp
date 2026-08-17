import type { StudentProfile } from "@shared/student-profile";

export const STUDENT_PROFILE_KEY = "nextlecture:student-profile";

export type ManualStudentProfileFields = {
  candidateName: string;
  registrationNumber: string;
  rollNumber: string;
  temporarySection: string;
  temporarySubsection: string;
  mentorName: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readStoredStudentProfile(storage: StorageLike): StudentProfile | null {
  try {
    const raw = storage.getItem(STUDENT_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StudentProfile) : null;
  } catch {
    return null;
  }
}

export function saveStudentProfile(storage: StorageLike, profile: StudentProfile) {
  storage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
}

export function createManualStudentProfile(branch: string, fields: ManualStudentProfileFields): StudentProfile {
  if (!fields.candidateName.trim() || !fields.registrationNumber.trim()) {
    throw new Error("Name and registration number are required for a manual profile.");
  }
  return {
    candidateName: fields.candidateName.trim(),
    registrationNumber: fields.registrationNumber.trim(),
    rollNumber: fields.rollNumber.trim() || "Not provided",
    branch,
    temporarySection: fields.temporarySection.trim() || branch,
    temporarySubsection: fields.temporarySubsection.trim() || "Not provided",
    mentorName: fields.mentorName.trim() || null,
    source: "manual",
    sourceUrl: null,
    savedAt: Date.now(),
  };
}
