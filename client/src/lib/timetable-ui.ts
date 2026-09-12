import type { GroupTimetable, Lecture, Weekday } from "@shared/timetable";

export const DAY_ORDER: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getTimeParts(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return {
    clock: `${displayHour}:${String(minutes).padStart(2, "0")}`,
    meridiem,
  };
}

export function formatTime(time: string) {
  const { clock, meridiem } = getTimeParts(time);
  return `${clock} ${meridiem}`;
}

export function formatRange(lecture: Lecture) {
  return `${formatTime(lecture.startTime)} – ${formatTime(lecture.endTime)}`;
}

/** Map official activity tags L / T / P to readable labels. */
export function formatLectureType(lectureType: string | null | undefined): string | null {
  if (!lectureType) return null;
  const code = lectureType.trim().toUpperCase();
  if (code === "L" || code === "LECTURE") return "Lecture";
  if (code === "T" || code === "TUTORIAL") return "Tutorial";
  if (code === "P" || code === "PRACTICAL" || code === "LAB") return "Practical";
  return lectureType.trim();
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
  const currentMinute = getMinutesNow(now);

  // Walk real calendar days so weekend → Monday uses the correct offset
  // (Saturday→Monday = 2, Sunday→Monday = 1), not a weekday-index shortcut.
  for (let calendarOffset = 0; calendarOffset < 8; calendarOffset += 1) {
    const candidate = new Date(now);
    candidate.setHours(12, 0, 0, 0);
    candidate.setDate(now.getDate() + calendarOffset);
    const candidateJsDay = candidate.getDay();
    if (candidateJsDay === 0 || candidateJsDay === 6) continue;

    const day = DAY_ORDER[candidateJsDay - 1];
    const lessons = timetable.lectures
      .filter(lecture => lecture.day === day)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (const lecture of lessons) {
      const starts = timeToMinutes(lecture.startTime);
      const ends = timeToMinutes(lecture.endTime);

      if (calendarOffset === 0) {
        if (currentMinute >= ends) continue;
        if (currentMinute >= starts && currentMinute < ends) {
          return { lecture, dayOffset: 0, phase: "current" };
        }
        if (starts > currentMinute) {
          return { lecture, dayOffset: 0, phase: "upcoming" };
        }
        continue;
      }

      return { lecture, dayOffset: calendarOffset, phase: "upcoming" };
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
  if (offset <= 0) {
    return current.getDay() >= 1 && current.getDay() <= 5 ? "Today" : "Today";
  }
  if (offset === 1) return "Tomorrow";
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
