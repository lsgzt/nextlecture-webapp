import { describe, expect, it } from "vitest";
import type { StudentProfile } from "@shared/student-profile";
import { getStudentProfileDetailFields, getStudentProfileSubtitle } from "./student-profile-display";

const profile: StudentProfile = {
  studentName: "Lovepreet Singh",
  crn: "2621101",
  fatherName: "Harpreet Singh",
  motherName: "Baljeet Kaur",
  branch: "IT",
  section: "ITB",
  subsection: "ITB2",
  mentoringGroup: "ITBM2",
  mentorName: "Er. Jaspreet Kaur",
  mentorMobileNumber: "8968801937",
  venue: "HW LAB",
  source: "official",
  sourceUrl: "https://example.test/profile.pdf",
  savedAt: 1,
};

describe("student profile display helpers", () => {
  it("creates a concise subtitle for the compact dashboard profile card", () => {
    expect(getStudentProfileSubtitle(profile)).toBe("CRN 2621101 · ITB2");
    expect(getStudentProfileSubtitle({ ...profile, source: "manual" })).toBe("CRN 2621101 · ITB2 · Manual profile");
  });

  it("returns the full official information only for the expanded profile section", () => {
    const details = getStudentProfileDetailFields(profile);
    expect(details).toContainEqual({ label: "Mentor mobile", value: "8968801937" });
    expect(details.map(detail => detail.label)).not.toContain("Serial number");
    expect(details).toHaveLength(10);
  });
});
