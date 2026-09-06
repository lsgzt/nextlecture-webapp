import { describe, expect, it } from "vitest";
import { findBranchDocumentUrl, parseTemporarySectionText } from "./temporarySections";

const sourceUrl = "https://appsc.gndec.ac.in/sites/default/files/2026-08/IT%20Permanent%20Sections%202026_0.pdf";

describe("temporary-section PDF parsing", () => {
  it("extracts every available source field including registration number while discarding serial", () => {
    const source = `S.No.\tCRN\tRegistration No.\tStudent Name\tFather Name\tMother Name\tBranch\tSection\tSubsection\tGroup\tMentor Name\tMobile No.\tVenue
1\t2621001\t26013653\tAaditya Koundal\tKapil Dev\tMonika\tIT\tITA\tITA1\tITAM1\tDr. Palwinder Kaur\t9814828414\tS213
2\t2621002\t26012726\tAbhishek Pandey\tBarindawan Pandey\tPooja Pandey\tIT\tITB\tITB1\tITBM1\tDr. Sidharath Jain\t9501011768\tTNP SEMINAR HALL 1`;

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
      source: "official",
    });
    expect(students.map(student => student.crn)).toEqual(["2621001", "2621002"]);
    expect(students[0]).not.toHaveProperty("serialNumber");
    expect(students[0].studentName).not.toMatch(/^\d/);
  });

  it("rejects rows where registration number leaked into the student name", () => {
    const source = `S.No.\tCRN\tRegistration No.\tStudent Name\tFather Name\tMother Name\tBranch\tSection\tSubsection\tGroup\tMentor Name\tMobile No.\tVenue
1\t2621001\t26013653\t26013653 Aaditya Koundal\tKapil Dev\tMonika\tIT\tITA\tITA1\tITAM1\tDr. Palwinder Kaur\t9814828414\tS213`;
    expect(() => parseTemporarySectionText(source, "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });

  it("discovers the correct branch document rather than relying on a fixed month-specific link", () => {
    const page = `<a href="/sites/default/files/2026-08/IT%20Permanent%20Sections%202026_0.pdf">IT Branch Students</a>`;
    expect(findBranchDocumentUrl(page, "IT")).toBe("https://appsc.gndec.ac.in/sites/default/files/2026-08/IT%20Permanent%20Sections%202026_0.pdf");
  });

  it("fails safely when no valid rows are present", () => {
    expect(() => parseTemporarySectionText("Permanent Sections 2026", "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });
});
