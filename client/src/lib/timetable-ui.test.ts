import { describe, expect, it } from "vitest";
import { getLecturesForDay, getTomorrowLectures } from "./timetable-ui";

const timetable = {
  lectures: [
    { day: "Monday", startTime: "09:00", endTime: "10:00", subject: "Monday class", teacher: "", venue: "" },
    { day: "Tuesday", startTime: "10:00", endTime: "11:00", subject: "Tuesday class", teacher: "", venue: "" },
  ],
} as Parameters<typeof getTomorrowLectures>[0];

describe("expanded timetable navigation", () => {
  it("selects the next calendar day for the Tomorrow view and has no weekday lectures on weekends", () => {
    expect(getTomorrowLectures(timetable, new Date("2026-08-24T12:00:00"))).toMatchObject([{ subject: "Tuesday class" }]);
    expect(getTomorrowLectures(timetable, new Date("2026-08-28T12:00:00"))).toEqual([]);
  });

  it("returns the matching weekday lectures for the Full week view", () => {
    expect(getLecturesForDay(timetable, "Monday")).toMatchObject([{ subject: "Monday class" }]);
    expect(getLecturesForDay(timetable, "Wednesday")).toEqual([]);
  });
});
