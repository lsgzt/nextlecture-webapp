import { describe, expect, it } from "vitest";
import { getLecturesForDay, getTomorrowLectures, formatLectureType, getNextLecture, getDayLabel } from "./timetable-ui";

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

describe("formatLectureType", () => {
  it("maps L T P codes to readable labels", () => {
    expect(formatLectureType("L")).toBe("Lecture");
    expect(formatLectureType("T")).toBe("Tutorial");
    expect(formatLectureType("P")).toBe("Practical");
    expect(formatLectureType(null)).toBeNull();
  });
});

describe("getNextLecture weekend handling", () => {
  const week = {
    lectures: [
      { day: "Monday", startTime: "09:30", endTime: "10:30", subject: "BEE", teacher: "T", venue: "S205", lectureType: "L", raw: "", confidence: "structured" as const },
      { day: "Friday", startTime: "09:30", endTime: "10:30", subject: "Math", teacher: "T", venue: "S205", lectureType: "L", raw: "", confidence: "structured" as const },
    ],
  } as Parameters<typeof getNextLecture>[0];

  it("from Saturday points at Monday with dayOffset 2, not Tomorrow", () => {
    const saturday = new Date("2026-09-12T08:40:00"); // Saturday
    const next = getNextLecture(week, saturday);
    expect(next?.lecture.subject).toBe("BEE");
    expect(next?.dayOffset).toBe(2);
    expect(getDayLabel(next!.dayOffset, saturday)).toBe("Monday");
  });

  it("from Sunday points at Monday with dayOffset 1 (Tomorrow)", () => {
    const sunday = new Date("2026-09-13T10:00:00");
    const next = getNextLecture(week, sunday);
    expect(next?.lecture.subject).toBe("BEE");
    expect(next?.dayOffset).toBe(1);
    expect(getDayLabel(next!.dayOffset, sunday)).toBe("Tomorrow");
  });
});


import { enrichLectureWithMentorProfile, enrichTimetableWithMentorProfile, isMentoringSubject } from "./timetable-ui";

describe("mentoring profile enrichment", () => {
  const mentoring = {
    day: "Monday" as const,
    startTime: "14:30",
    endTime: "15:30",
    subject: "MENTORING",
    teacher: null,
    venue: null,
    lectureType: null,
    raw: "MENTORING",
    confidence: "partial" as const,
  };

  it("detects mentoring subjects", () => {
    expect(isMentoringSubject("MENTORING")).toBe(true);
    expect(isMentoringSubject("Mentoring")).toBe(true);
    expect(isMentoringSubject("CHEMISTRY")).toBe(false);
  });

  it("fills teacher and venue from the student profile when the timetable cell is empty", () => {
    const enriched = enrichLectureWithMentorProfile(mentoring, {
      mentorName: "Er. Jaspreet Kaur",
      venue: "HW LAB",
    });
    expect(enriched.teacher).toBe("Er. Jaspreet Kaur");
    expect(enriched.venue).toBe("HW LAB");
  });

  it("does not override an explicit timetable teacher or room", () => {
    const enriched = enrichLectureWithMentorProfile(
      { ...mentoring, teacher: "Official Teacher", venue: "S100" },
      { mentorName: "Er. Jaspreet Kaur", venue: "HW LAB" },
    );
    expect(enriched.teacher).toBe("Official Teacher");
    expect(enriched.venue).toBe("S100");
  });

  it("leaves non-mentoring lectures untouched", () => {
    const lecture = { ...mentoring, subject: "CHEMISTRY", teacher: null, venue: null };
    expect(enrichLectureWithMentorProfile(lecture, { mentorName: "X", venue: "Y" })).toBe(lecture);
  });

  it("enriches every mentoring cell on a timetable", () => {
    const tt = {
      group: { code: "ITB2", sourceYear: "2026" },
      timeSlots: ["14:30"],
      lectures: [mentoring, { ...mentoring, day: "Wednesday" as const, subject: "BEE", teacher: null, venue: null }],
    };
    const enriched = enrichTimetableWithMentorProfile(tt, { mentorName: "Er. Jaspreet Kaur", venue: "HW LAB" });
    expect(enriched?.lectures[0].teacher).toBe("Er. Jaspreet Kaur");
    expect(enriched?.lectures[0].venue).toBe("HW LAB");
    expect(enriched?.lectures[1].teacher).toBeNull();
    expect(enriched?.lectures[1].venue).toBeNull();
  });
});
