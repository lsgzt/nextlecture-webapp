import { describe, expect, it } from "vitest";
import { createManualStudentProfile, readStoredStudentProfile, saveStudentProfile } from "./student-profile-storage";

function createStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("student profile local persistence", () => {
  it("creates and saves a complete manual fallback profile", () => {
    const profile = createManualStudentProfile("IT", {
      studentName: "  Sam Singh  ",
      crn: " 2621555 ",
      fatherName: "  Raj Singh  ",
      motherName: "  Simran Kaur  ",
      section: " ITB ",
      subsection: " ITB2 ",
      mentoringGroup: " ITBM1 ",
      mentorName: " Dr. Sidharath Jain ",
      mentorMobileNumber: " 9501011768 ",
      venue: " TNP Seminar Hall 1 ",
    });
    const storage = createStorage();
    saveStudentProfile(storage, profile);

    expect(readStoredStudentProfile(storage)).toMatchObject({
      studentName: "Sam Singh",
      crn: "2621555",
      subsection: "ITB2",
      mentorMobileNumber: "9501011768",
      source: "manual",
    });
  });

  it("keeps an invalid or unavailable local profile from breaking onboarding", () => {
    const storage = { getItem: () => "not-json", setItem: () => undefined };
    expect(readStoredStudentProfile(storage)).toBeNull();
    expect(() => createManualStudentProfile("IT", { studentName: "", crn: "", fatherName: "", motherName: "", section: "", subsection: "", mentoringGroup: "", mentorName: "", mentorMobileNumber: "", venue: "" })).toThrow(/required/i);
  });
});
