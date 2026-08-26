import type { GroupTimetable, Lecture, Weekday } from "@shared/timetable";

export const DAY_ORDER: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatRange(lecture: Lecture) {
  return `${formatTime(lecture.startTime)} – ${formatTime(lecture.endTime)}`;
}

export function getTodayName(now = new Date()): Weekday | null {
  const index = now.getDay();
  return index >= 1 && index <= 5 ? DAY_ORDER[index - 1] : null;
}

export function getMinutesNow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function getTodayLectures(timetable: GroupTimetable | null, now = new Date()) {
  const day = getTodayName(now);
  return getLecturesForDay(timetable, day);
}

export function getLecturesForDay(timetable: GroupTimetable | null, day: Weekday | null) {
  if (!day || !timetable) return [];
  return timetable.lectures.filter(lecture => lecture.day === day);
}

export function getTomorrowLectures(timetable: GroupTimetable | null, now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLecturesForDay(timetable, getTodayName(tomorrow));
}

export function lectureStatus(lecture: Lecture, now = new Date()) {
  const current = getMinutesNow(now);
  const today = getTodayName(now);
  if (lecture.day !== today) return "upcoming" as const;
  if (current >= timeToMinutes(lecture.endTime)) return "past" as const;
  if (current >= timeToMinutes(lecture.startTime)) return "current" as const;
  return "upcoming" as const;
}

export type NextLectureResult = {
  lecture: Lecture;
  dayOffset: number;
  phase: "upcoming" | "current";
} | null;

export function getNextLecture(timetable: GroupTimetable | null, now = new Date()): NextLectureResult {
  if (!timetable?.lectures.length) return null;
  const jsDay = now.getDay();
  const todayIndex = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : 5;
  const currentMinute = getMinutesNow(now);

  for (let offset = 0; offset < 7; offset += 1) {
    const targetIndex = (todayIndex + offset) % DAY_ORDER.length;
    const day = DAY_ORDER[targetIndex];
    const lessons = timetable.lectures.filter(lecture => lecture.day === day);
    for (const lecture of lessons) {
      const starts = timeToMinutes(lecture.startTime);
      const ends = timeToMinutes(lecture.endTime);
      if (offset === 0 && jsDay >= 1 && jsDay <= 5 && currentMinute >= ends) continue;
      if (offset === 0 && jsDay >= 1 && jsDay <= 5 && currentMinute >= starts && currentMinute < ends) {
        return { lecture, dayOffset: 0, phase: "current" };
      }
      if (offset > 0 || jsDay === 0 || jsDay === 6 || starts > currentMinute) {
        return { lecture, dayOffset: offset || (jsDay === 0 || jsDay === 6 ? 1 : 0), phase: "upcoming" };
      }
    }
  }
  return null;
}

export function humanizeDuration(minutes: number) {
  if (minutes < 1) return "less than a minute";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export function getDayLabel(offset: number, current = new Date()) {
  if (offset === 0 && current.getDay() >= 1 && current.getDay() <= 5) return "Today";
  if (offset === 1 || (current.getDay() === 0 && offset === 1)) return "Tomorrow";
  const target = new Date(current);
  target.setDate(current.getDate() + offset);
  return target.toLocaleDateString(undefined, { weekday: "long" });
}

export function deriveGroupParts(code: string) {
  const match = code.match(/^(.*?)(\d+)$/);
  return {
    branch: match?.[1] || code,
    section: match?.[2] || "All",
  };
}
