import { describe, expect, it } from "vitest";
import { getPreferredTimetableGroup } from "./timetable-selection";

describe("getPreferredTimetableGroup", () => {
  it("uses the saved student subsection instead of a mentoring group or stale selected group", () => {
    expect(getPreferredTimetableGroup(" itb2 ", "ITBM2", "ITB1")).toBe("ITB2");
  });

  it("retains route and local selections only when no saved subsection exists", () => {
    expect(getPreferredTimetableGroup(null, "csb1", "ITB2")).toBe("CSB1");
    expect(getPreferredTimetableGroup(null, null, "itb2")).toBe("ITB2");
  });
});
