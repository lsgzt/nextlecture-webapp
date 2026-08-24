import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const timetableMocks = vi.hoisted(() => ({
  getOfficialTimetable: vi.fn(),
  findGroupTimetable: vi.fn(),
}));

vi.mock("./timetable", () => timetableMocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const cache = {
  data: {
    groups: [{ code: "ITB2", sourceYear: "Year BTECH FIRST YEAR CHEMISTRY GROUP" }],
    timetables: [],
    sourceGeneratedAt: "Timetable generated with FET",
  },
  fetchedAt: 1_755_350_400_000,
  sourceUrl: "https://example.test/official-timetable.html",
};

const timetable = {
  group: cache.data.groups[0],
  timeSlots: ["08:30"],
  lectures: [{
    day: "Monday" as const,
    startTime: "08:30",
    endTime: "09:30",
    subject: "CHEMISTRY",
    teacher: "DR AMANDEEP KAUR",
    venue: "S205",
    lectureType: "L",
    raw: "CHEMISTRY",
    confidence: "structured" as const,
  }],
};

function createCaller() {
  const ctx = {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("timetable tRPC procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timetableMocks.getOfficialTimetable.mockResolvedValue({ cache, freshness: "fresh", updateError: null });
    timetableMocks.findGroupTimetable.mockReturnValue(timetable);
  });

  it("returns source-discovered groups and clearly exposes a stale-cache state", async () => {
    timetableMocks.getOfficialTimetable.mockResolvedValueOnce({
      cache,
      freshness: "stale",
      updateError: "The official source timed out.",
    });

    const result = await createCaller().timetable.groups();

    expect(result).toMatchObject({
      groups: cache.data.groups,
      fetchedAt: cache.fetchedAt,
      freshness: "stale",
      updateError: "The official source timed out.",
    });
  });

  it("returns the selected dashboard and forces a fresh upstream fetch on manual refresh", async () => {
    const caller = createCaller();
    const dashboard = await caller.timetable.dashboard({ group: "ITB2" });
    const refreshed = await caller.timetable.refresh({ group: "ITB2" });

    expect(dashboard.timetable).toEqual(timetable);
    expect(refreshed.timetable).toEqual(timetable);
    expect(timetableMocks.getOfficialTimetable).toHaveBeenNthCalledWith(1, false, "ITB2");
    expect(timetableMocks.getOfficialTimetable).toHaveBeenNthCalledWith(2, true, "ITB2");
  });

  it("returns a typed not-found error for a removed or unknown group", async () => {
    timetableMocks.findGroupTimetable.mockReturnValueOnce(null);

    await expect(createCaller().timetable.dashboard({ group: "UNKNOWN" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<TRPCError>);
  });

  it("normalizes a source outage into a safe gateway error when no cache can be used", async () => {
    timetableMocks.getOfficialTimetable.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(createCaller().timetable.groups()).rejects.toMatchObject({ code: "BAD_GATEWAY" } satisfies Partial<TRPCError>);
  });
});
