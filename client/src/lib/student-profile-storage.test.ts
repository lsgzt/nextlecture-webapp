import { describe, expect, it } from "vitest";
import {
  STUDENT_PROFILE_KEY,
  STUDENT_PROFILE_SCHEMA_KEY,
  STUDENT_PROFILE_SCHEMA_VERSION,
  createManualStudentProfile,
  readStoredStudentProfile,
  saveStudentProfile,
} from "./student-profile-storage";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("student profile local persistence", () => {
  it("creates and saves a complete manual fallback profile", () => {
    const profile = createManualStudentProfile("IT", {
      studentName: "  Sam Singh  ",
      crn: " 2621555 ",
      registrationNumber: " 202600111 ",
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
      registrationNumber: "202600111",
      subsection: "ITB2",
      mentorMobileNumber: "9501011768",
      source: "manual",
    });
    expect(storage.getItem(STUDENT_PROFILE_SCHEMA_KEY)).toBe(String(STUDENT_PROFILE_SCHEMA_VERSION));
  });

  it("discards profiles saved under an older schema so users re-onboard once", () => {
    const storage = createStorage();
    storage.setItem(
      STUDENT_PROFILE_KEY,
      JSON.stringify({
        studentName: "Lovepreet Singh",
        crn: "2621101",
        branch: "IT",
        section: "ITB",
        subsection: "ITB2",
        fatherName: null,
        motherName: null,
        mentoringGroup: null,
        mentorName: null,
        mentorMobileNumber: "8968801937 HW LAB",
        venue: null,
        source: "official",
        sourceUrl: null,
        savedAt: 1,
      }),
    );
    // No schema key (or stale version) → one-time wipe.
    expect(readStoredStudentProfile(storage)).toBeNull();
    expect(storage.getItem(STUDENT_PROFILE_KEY)).toBeNull();
    expect(storage.getItem(STUDENT_PROFILE_SCHEMA_KEY)).toBe(String(STUDENT_PROFILE_SCHEMA_VERSION));

    // After the user saves again under the current schema, the profile sticks.
    const profile = createManualStudentProfile("IT", {
      studentName: "Lovepreet Singh",
      crn: "2621101",
      registrationNumber: "",
      fatherName: "",
      motherName: "",
      section: "ITB",
      subsection: "ITB2",
      mentoringGroup: "",
      mentorName: "",
      mentorMobileNumber: "8968801937",
      venue: "HW LAB",
    });
    saveStudentProfile(storage, profile);
    expect(readStoredStudentProfile(storage)?.crn).toBe("2621101");
  });

  it("keeps an invalid or unavailable local profile from breaking onboarding", () => {
    const storage = { getItem: () => "not-json", setItem: () => undefined };
    expect(readStoredStudentProfile(storage)).toBeNull();
    expect(() =>
      createManualStudentProfile("IT", {
        studentName: "",
        crn: "",
        registrationNumber: "",
        fatherName: "",
        motherName: "",
        section: "",
        subsection: "",
        mentoringGroup: "",
        mentorName: "",
        mentorMobileNumber: "",
        venue: "",
      }),
    ).toThrow(/required/i);
  });
});
