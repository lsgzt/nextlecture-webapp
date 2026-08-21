import type { StudentProfile } from "@shared/student-profile";

export type StudentProfileDetail = {
  label: string;
  value: string | null;
};

export function getStudentProfileSubtitle(profile: StudentProfile) {
  return [`CRN ${profile.crn}`, profile.subsection, profile.source === "manual" ? "Manual profile" : null]
    .filter(Boolean)
    .join(" · ");
}

export function getStudentProfileDetailFields(profile: StudentProfile): StudentProfileDetail[] {
  return [
    { label: "CRN", value: profile.crn },
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
