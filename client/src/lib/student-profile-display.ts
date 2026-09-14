import type { StudentProfile } from "@shared/student-profile";

export type StudentProfileDetail = {
  label: string;
  value: string | null;
};

/**
 * College email pattern used by GNDEC: firstName + CRN + @gndec.ac.in (all lowercase).
 * First name is the first whitespace-separated token of the student name.
 */
export function getCollegeEmail(profile: Pick<StudentProfile, "studentName" | "crn">): string | null {
  const firstName = profile.studentName.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const crn = profile.crn.trim().toLowerCase();
  if (!firstName || !crn) return null;
  return `${firstName}${crn}@gndec.ac.in`;
}

export function getStudentProfileSubtitle(profile: StudentProfile) {
  return [`CRN ${profile.crn}`, profile.subsection, profile.source === "manual" ? "Manual profile" : null]
    .filter(Boolean)
    .join(" · ");
}

export function getStudentProfileDetailFields(profile: StudentProfile): StudentProfileDetail[] {
  return [
    { label: "Registration number", value: profile.registrationNumber ?? null },
    { label: "CRN", value: profile.crn },
    { label: "Mail", value: getCollegeEmail(profile) },
    { label: "Father name", value: profile.fatherName },
    { label: "Mother name", value: profile.motherName },
    { label: "Branch", value: profile.branch },
    { label: "Section", value: profile.section },
    { label: "Subsection", value: profile.subsection },
    { label: "Mentoring group", value: profile.mentoringGroup },
    { label: "Mentor name", value: profile.mentorName },
    { label: "Mentor mobile", value: profile.mentorMobileNumber },
    { label: "Venue", value: profile.venue },
  ];
}

/** Frontend-only CR recognition (no backend involvement). */
const CLASS_REPRESENTATIVES: Array<{ name: string; branch: string }> = [
  { name: "imtoz kaur", branch: "IT" },
  { name: "jaswant singh", branch: "IT" },
];

function normalizePersonName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Whether this saved profile should show the exclusive Class Representative badge.
 * Matched by student name + branch on the client only.
 */
export function isClassRepresentative(profile: Pick<StudentProfile, "studentName" | "branch">): boolean {
  const name = normalizePersonName(profile.studentName);
  const branch = profile.branch.trim().toUpperCase();
  return CLASS_REPRESENTATIVES.some(
    entry => entry.name === name && entry.branch === branch,
  );
}
