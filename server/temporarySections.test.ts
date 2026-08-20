import { describe, expect, it } from "vitest";
import { findBranchDocumentUrl, parseTemporarySectionText } from "./temporarySections";

const sourceUrl = "https://appsc.gndec.ac.in/sites/default/files/2026-08/IT.pdf";

describe("temporary-section PDF parsing", () => {
  it("extracts every available source field while discarding the serial-number column", () => {
    const source = `S.No.\tCRN\tStudent Name\tFather Name\tMother Name\tBranch\tSection\tSubsection\tGroup\tMentor Name\tMobile No.\tVenue
      1\t2621001\tAaditya Koundal\tKapil Dev\tMonika\tIT\tITA\tITA1\tITAM1\tDr. Pankaj Bhambri\t9814828414\tS213
      2\t2621002\tAaditya Koundal\tBalindawan Pandey\tPooja Pandey\tIT\tITB\tITB1\tITBM1\tDr. Sidharath Jain\t9501011768\tTNP SEMINAR HALL 1`;

    const students = parseTemporarySectionText(source, "IT", sourceUrl);

    expect(students).toHaveLength(2);
    expect(students[0]).toMatchObject({
      studentName: "Aaditya Koundal",
      crn: "2621001",
      fatherName: "Kapil Dev",
      motherName: "Monika",
      branch: "IT",
      section: "ITA",
      subsection: "ITA1",
      mentoringGroup: "ITAM1",
      mentorName: "Dr. Pankaj Bhambri",
      mentorMobileNumber: "9814828414",
      venue: "S213",
      source: "official",
    });
    expect(students.map(student => student.crn)).toEqual(["2621001", "2621002"]);
    expect(students[0]).not.toHaveProperty("serialNumber");
  });

  it("discovers the correct branch document rather than relying on a fixed month-specific link", () => {
    const page = `<a href="/sites/default/files/2026-08/IT%20Permanent%20Sections%202026.pdf">IT Branch Students</a>`;
    expect(findBranchDocumentUrl(page, "IT")).toBe("https://appsc.gndec.ac.in/sites/default/files/2026-08/IT%20Permanent%20Sections%202026.pdf");
  });

  it("fails safely when no valid rows are present", () => {
    expect(() => parseTemporarySectionText("Permanent Sections 2026", "IT", sourceUrl)).toThrow(/did not contain readable student rows/i);
  });
});
