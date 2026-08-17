import { describe, expect, it } from "vitest";
import { createManualStudentProfile, readStoredStudentProfile, saveStudentProfile } from "./student-profile-storage";

function createStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("student profile local persistence", () => {
  it("creates and saves a complete manual fallback profile", () => {
    const profile = createManualStudentProfile("IT", {
      candidateName: "  Sam Singh  ",
      registrationNumber: " 26015555 ",
      rollNumber: " 101 ",
      temporarySection: " ITB ",
      temporarySubsection: " ITB2 ",
      mentorName: " Er. Jaspreet Kaur ",
    });
    const storage = createStorage();
    saveStudentProfile(storage, profile);

    expect(readStoredStudentProfile(storage)).toMatchObject({
      candidateName: "Sam Singh",
      registrationNumber: "26015555",
      rollNumber: "101",
      temporarySubsection: "ITB2",
      source: "manual",
    });
  });

  it("keeps an invalid or unavailable local profile from breaking onboarding", () => {
    const storage = { getItem: () => "not-json", setItem: () => undefined };
    expect(readStoredStudentProfile(storage)).toBeNull();
    expect(() => createManualStudentProfile("IT", { candidateName: "", registrationNumber: "", rollNumber: "", temporarySection: "", temporarySubsection: "", mentorName: "" })).toThrow(/required/i);
  });
});
