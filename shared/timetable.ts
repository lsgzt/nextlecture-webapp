export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type TimetableGroup = {
  code: string;
  sourceYear: string;
};

export type Lecture = {
  day: Weekday;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string | null;
  venue: string | null;
  lectureType: string | null;
  raw: string;
  confidence: "structured" | "partial";
};

export type GroupTimetable = {
  group: TimetableGroup;
  timeSlots: string[];
  lectures: Lecture[];
};

export type TimetablePayload = {
  groups: TimetableGroup[];
  timetables: GroupTimetable[];
  sourceGeneratedAt: string | null;
};

export type TimetableCacheEnvelope = {
  data: TimetablePayload;
  fetchedAt: number;
  sourceUrl: string;
};

export type TimetableResponse = {
  timetable: GroupTimetable;
  fetchedAt: number;
  sourceUrl: string;
  sourceGeneratedAt: string | null;
  freshness: "fresh" | "stale";
  updateError: string | null;
};
