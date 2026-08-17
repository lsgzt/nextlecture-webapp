import { describe, expect, it } from "vitest";
import { findBranchDocumentUrl, parseTemporarySectionText } from "./temporarySections";

const sourceUrl = "https://appsc.gndec.ac.in/sites/default/files/2026-08/IT.pdf";

describe("temporary-section PDF parsing", () => {
  it("extracts source rows, including roll number, registration number, section, subsection, and mentor", () => {
    const source = `Sr. No. Candidate Name Registration No. Branch T-Section T-Subsection Mentor Name
      96 KARISHMA 26013850 IT ITB ITB2 Er. Jaspreet Kaur
      97 KOMALPREET KAUR 26011555 IT ITB ITB2 Er. Jaspreet Kaur
      98 KOMALPREET KAUR 26014150 IT ITB ITB2 Er. Jaspreet Kaur`;

    const students = parseTemporarySectionText(source, "IT", sourceUrl);

    expect(students).toHaveLength(3);
    expect(students[0]).toMatchObject({
      candidateName: "KARISHMA",
      rollNumber: "96",
      registrationNumber: "26013850",
      branch: "IT",
      temporarySection: "ITB",
      temporarySubsection: "ITB2",
      mentorName: "Er. Jaspreet Kaur",
      source: "official",
    });
    expect(students.filter(student => student.candidateName === "KOMALPREET KAUR").map(student => student.registrationNumber)).toEqual(["26011555", "26014150"]);
  });

  it("discovers the correct branch document rather than relying on a fixed month-specific link", () => {
    const page = `<a href="/sites/default/files/2026-08/IT%20Branch%20Temporary%20Sections%202026_0.pdf">IT Branch Students</a>`;
    expect(findBranchDocumentUrl(page, "IT")).toBe("https://appsc.gndec.ac.in/sites/default/files/2026-08/IT%20Branch%20Temporary%20Sections%202026_0.pdf");
  });

  it("fails safely when no valid rows are present", () => {
    expect(() => parseTemporarySectionText("Temporary Sections 2026", "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });
});
