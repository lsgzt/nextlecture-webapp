import { describe, expect, it } from "vitest";
import { findBranchDocumentUrl, parseTemporarySectionText } from "./temporarySections";

const sourceUrl = "https://appsc.gndec.ac.in/sites/default/files/2026-09/IT%20Permanent%20Section%2015_09_2026.pdf";

describe("temporary-section PDF parsing", () => {
  it("extracts every available source field including registration number, class coordinator, and split CRN/branch + mobile/venue", () => {
    // September 2026 layout: Sr.No | Registration | CRN+Branch | Student | Mother | Father | Section | Sub | Group | Mentor | Mobile+Venue | Class Coordinator
    const source = `Sr.No.\tRegistration No.\tCRN Branch\tStudent Name\tMother Name\tFather Name\tSection\tSubsection\tGroup\tMentor Name\tMobile Venue\tClass Coordinator
1\t26013653\t2621001 IT\tAaditya Koundal\tMonika\tKapil Dev\tITA\tITA1\tITAM1\tDr. Palwinder Kaur\t9814828414 S213\tMr. Sunil Kumar
2\t26012726\t2621002IT\tAbhishek Pandey\tPooja Pandey\tBarindawan Pandey\tITB\tITB1\tITBM1\tDr. Sidharath Jain\t9501011768TNP-HALL\tMs. Coordinator`;

    const students = parseTemporarySectionText(source, "IT", sourceUrl);

    expect(students).toHaveLength(2);
    expect(students[0]).toMatchObject({
      studentName: "Aaditya Koundal",
      crn: "2621001",
      registrationNumber: "26013653",
      fatherName: "Kapil Dev",
      motherName: "Monika",
      branch: "IT",
      section: "ITA",
      subsection: "ITA1",
      mentoringGroup: "ITAM1",
      mentorName: "Dr. Palwinder Kaur",
      mentorMobileNumber: "9814828414",
      venue: "S213",
      classCoordinator: "Mr. Sunil Kumar",
      source: "official",
    });
    expect(students[1]).toMatchObject({
      crn: "2621002",
      mentorMobileNumber: "9501011768",
      venue: "TNP-HALL",
      classCoordinator: "Ms. Coordinator",
    });
    expect(students.map(student => student.crn)).toEqual(["2621001", "2621002"]);
    expect(students[0]).not.toHaveProperty("serialNumber");
    expect(students[0].studentName).not.toMatch(/^\d/);
  });

  it("rejects rows where registration number leaked into the student name", () => {
    const source = `Sr.No.\tRegistration No.\tCRN Branch\tStudent Name\tMother Name\tFather Name\tSection\tSubsection\tGroup\tMentor Name\tMobile Venue\tClass Coordinator
1\t26013653\t2621001 IT\t26013653 Aaditya Koundal\tMonika\tKapil Dev\tITA\tITA1\tITAM1\tDr. Palwinder Kaur\t9814828414 S213\tMr. Sunil Kumar`;
    expect(() => parseTemporarySectionText(source, "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });

  it("discovers the correct branch document rather than relying on a fixed month-specific link", () => {
    const page = `<a href="/sites/default/files/2026-09/IT%20Permanent%20Section%2015_09_2026.pdf">IT Branch Students</a>`;
    expect(findBranchDocumentUrl(page, "IT")).toBe(
      "https://appsc.gndec.ac.in/sites/default/files/2026-09/IT%20Permanent%20Section%2015_09_2026.pdf",
    );
  });

  it("fails safely when no valid rows are present", () => {
    expect(() => parseTemporarySectionText("Permanent Sections 2026", "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });
});
