import { beforeEach, describe, expect, it, vi } from "vitest";

const temporarySectionMocks = vi.hoisted(() => ({
  prepareTemporarySectionBranch: vi.fn(),
  searchTemporarySectionStudents: vi.fn(),
  getTemporarySectionStudent: vi.fn(),
}));

vi.mock("./temporarySections", () => temporarySectionMocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCaller() {
  const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("temporary-section tRPC procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    temporarySectionMocks.prepareTemporarySectionBranch.mockResolvedValue({
      branch: "IT",
      studentCount: 120,
      fetchedAt: 1_786_968_000_000,
      sourceUrl: "https://example.test/it.pdf",
      freshness: "fresh",
      updateError: null,
    });
    temporarySectionMocks.searchTemporarySectionStudents.mockResolvedValue({
      matches: [{ studentName: "AADITYA KOUNDAL", crn: "2621001", branch: "IT", section: "ITA", subsection: "ITA1", mentoringGroup: "ITAM1" }],
      fetchedAt: 1_786_968_000_000,
      freshness: "fresh",
      updateError: null,
    });
    temporarySectionMocks.getTemporarySectionStudent.mockResolvedValue({
      student: { studentName: "AADITYA KOUNDAL", crn: "2621001", fatherName: "Kapil Dev", motherName: "Monika", branch: "IT", section: "ITA", subsection: "ITA1", mentoringGroup: "ITAM1", mentorName: "Dr. Pankaj Bhambri", mentorMobileNumber: "9814828414", venue: "S213", source: "official", sourceUrl: "https://example.test/it.pdf", savedAt: 1_786_968_000_000 },
      fetchedAt: 1_786_968_000_000,
      freshness: "fresh",
      updateError: null,
    });
  });

  it("returns source-derived duplicate-disambiguation fields for a name search", async () => {
    const result = await createCaller().temporarySections.search({ branch: "IT", query: "Aaditya" });
    expect(result.matches[0]).toMatchObject({ studentName: "AADITYA KOUNDAL", crn: "2621001", subsection: "ITA1", mentoringGroup: "ITAM1" });
    expect(temporarySectionMocks.searchTemporarySectionStudents).toHaveBeenCalledWith("IT", "Aaditya");
  });

  it("prepares a branch cache before the student begins typing", async () => {
    const result = await createCaller().temporarySections.prepare({ branch: "IT" });
    expect(result).toMatchObject({ branch: "IT", studentCount: 120, freshness: "fresh" });
    expect(temporarySectionMocks.prepareTemporarySectionBranch).toHaveBeenCalledWith("IT");
  });

  it("returns the complete selected profile from the official document", async () => {
    const result = await createCaller().temporarySections.profile({ branch: "IT", crn: "2621001" });
    expect(result.student).toMatchObject({ crn: "2621001", mentorName: "Dr. Pankaj Bhambri", subsection: "ITA1", venue: "S213" });
  });

  it("returns a safe gateway error when the official document cannot be reached", async () => {
    temporarySectionMocks.searchTemporarySectionStudents.mockRejectedValueOnce(new Error("Source timeout"));
    await expect(createCaller().temporarySections.search({ branch: "IT", query: "Komal" })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});
