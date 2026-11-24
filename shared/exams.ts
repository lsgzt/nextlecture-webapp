/**
 * Exam-mode date-sheet parser and gate (ported from nextlecture-android ExamGate / Exams).
 * An announcement with exam_mode: "on" switches the UI to show exams instead of lectures.
 */

import type { Announcement } from "./announcements";

export type Exam = {
  date: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
  subject: string;
  sections: string[];
  group: string;
};

export type ExamSchedule = {
  groups: string[];
  exams: Exam[];
  unreadable: number;
};

export type ExamState = {
  announcement: Announcement;
  schedule: ExamSchedule;
  group: string | null;
  exams: Exam[];
  needsGroupPick: boolean;
};

export type ExamFeaturedPhase = "ongoing" | "today" | "upcoming";

export type ExamFeatured = {
  exam: Exam;
  phase: ExamFeaturedPhase;
  daysAhead: number;
  minutes: number;
};

export type ExamTimelineView = {
  featured: ExamFeatured | null;
  upcoming: Exam[];
  finished: number;
  total: number;
  allOver: boolean;
};

const ON_VALUES = new Set(["on", "true", "1", "yes", "enabled", "active"]);

export function isExamModeOn(raw: string | null | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function activeExamAnnouncement(announcements: Announcement[]): Announcement | null {
  const active = announcements.filter(a => isExamModeOn(a.examMode));
  if (active.length === 0) return null;
  return active.reduce((best, cur) => {
    const left = Date.parse(best.publishedAt) || 0;
    const right = Date.parse(cur.publishedAt) || 0;
    return right >= left ? cur : best;
  });
}

const DASH_CHARS = "—–‒―‐‑-";
const DASH = `[${DASH_CHARS}]`;
const BULLET = "(?:[-*•·]\\s+)?";
const ORDINAL = "(?:st|nd|rd|th)?";
const YEAR = "(?:[\\s,.\\-]*(?<year>\\d{4}))?";

const DAY_FIRST = new RegExp(
  `^${BULLET}(?<day>\\d{1,2})${ORDINAL}[\\s.-]*(?<month>[A-Za-z]{3,9})\\.?${YEAR}\\s*${DASH}\\s*(?<rest>.*)$`,
  "i",
);
const MONTH_FIRST = new RegExp(
  `^${BULLET}(?<month>[A-Za-z]{3,9})\\.?[\\s.-]*(?<day>\\d{1,2})${ORDINAL}${YEAR}\\s*${DASH}\\s*(?<rest>.*)$`,
  "i",
);
const SUBJECT_FIRST = new RegExp(
  `^${BULLET}(?<subject>.+?)\\s*${DASH}\\s*(?<day>\\d{1,2})${ORDINAL}[\\s.-]*(?<month>[A-Za-z]{3,9})\\.?${YEAR}\\s*${DASH}\\s*(?<rest>.*)$`,
  "i",
);
const TIME_RANGE = new RegExp(
  `^\\s*(?<sh>\\d{1,2})(?:[.:](?<sm>\\d{2}))?\\s*(?<smer>[ap]\\.?[m]\\.?)?\\s*(?:${DASH}|to)\\s*` +
    `(?<eh>\\d{1,2})(?:[.:](?<em>\\d{2}))?\\s*(?<emer>[ap]\\.?[m]\\.?)?` +
    `\\s*(?:\\((?<sections>[^)]*)\\))?\\s*(?:${DASH}.*)?$`,
  "i",
);
const SECTION_SPLIT = /\s*(?:[,;|]|&|\band\b)\s*/i;
const ONLY_SUFFIX = /\s+only$/i;
const SPACES = /\s+/g;
const HEADING_MARKS = /^\s*#{1,6}\s+/;
const UNDERSCORE_EMPHASIS = /(?<![\p{L}\p{N}])_+(.+?)_+(?![\p{L}\p{N}])/gu;

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function plain(raw: string): string {
  return raw
    .replace(HEADING_MARKS, "")
    .replace(UNDERSCORE_EMPHASIS, "$1")
    .replace(/\*/g, "")
    .replace(/：/g, ":")
    .trim();
}

function heading(line: string): string | null {
  if (!line.endsWith(":")) return null;
  const name = line.slice(0, -1).trim();
  return name || null;
}

function monthNumber(text: string): number | null {
  const key = text.toLowerCase();
  return MONTH_MAP[key] ?? MONTH_MAP[key.slice(0, 3)] ?? null;
}

function isoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const t0 = Date.parse(a + "T00:00:00Z");
  const t1 = Date.parse(b + "T00:00:00Z");
  return Math.round((t1 - t0) / 86_400_000);
}

function resolveDate(
  day: number,
  monthText: string,
  yearText: string,
  referenceIso: string,
): string | null {
  const month = monthNumber(monthText);
  if (!month) return null;
  if (yearText) {
    return isoDate(Number(yearText), month, day);
  }
  const refYear = Number(referenceIso.slice(0, 4));
  let best: string | null = null;
  let bestDist = Infinity;
  for (let y = refYear - 1; y <= refYear + 1; y++) {
    const candidate = isoDate(y, month, day);
    if (!candidate) continue;
    const dist = Math.abs(daysBetween(candidate, referenceIso));
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function minuteOf(
  hour: number,
  minute: number,
  meridiem: string | undefined,
): number | null {
  if (minute < 0 || minute > 59) return null;
  let h = hour;
  if (meridiem) {
    const m = meridiem[0].toLowerCase();
    if (m === "a") h = hour === 12 ? 0 : hour;
    else if (m === "p") h = hour === 12 ? 12 : hour + 12;
    else return null;
  }
  if (h < 0 || h > 23) return null;
  return h * 60 + minute;
}

function sectionsFrom(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(SECTION_SPLIT)
    .map(s => s.replace(ONLY_SUFFIX, "").replace(/[*().]/g, "").trim().replace(SPACES, " "))
    .filter(Boolean);
}

function cleanSubject(text: string): string {
  return text.trim().replace(/^[*_]+|[*_]+$/g, "").replace(SPACES, " ").trim();
}

function looksLikeExam(line: string): boolean {
  if (DAY_FIRST.test(line) || MONTH_FIRST.test(line) || SUBJECT_FIRST.test(line)) return true;
  for (let i = 0; i < line.length; i++) {
    if (DASH_CHARS.includes(line[i])) {
      const before = line.slice(0, i).trim();
      const after = line.slice(i + 1).trimStart();
      if (before && TIME_RANGE.test(after)) return true;
    }
  }
  return false;
}

function parseLine(line: string, referenceIso: string): Exam | null {
  let date: string | null = null;
  let body = "";

  let m = DAY_FIRST.exec(line);
  if (m?.groups) {
    date = resolveDate(Number(m.groups.day), m.groups.month, m.groups.year ?? "", referenceIso);
    body = m.groups.rest ?? "";
  } else {
    m = MONTH_FIRST.exec(line);
    if (m?.groups) {
      date = resolveDate(Number(m.groups.day), m.groups.month, m.groups.year ?? "", referenceIso);
      body = m.groups.rest ?? "";
    } else {
      m = SUBJECT_FIRST.exec(line);
      if (m?.groups) {
        date = resolveDate(Number(m.groups.day), m.groups.month, m.groups.year ?? "", referenceIso);
        body = `${m.groups.subject} — ${m.groups.rest ?? ""}`;
      }
    }
  }
  if (!date || !body) return null;

  const dashIndexes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (DASH_CHARS.includes(body[i])) dashIndexes.push(i);
  }
  for (const dash of dashIndexes.reverse()) {
    const timePart = body.slice(dash + 1).trimStart();
    const time = TIME_RANGE.exec(timePart);
    if (!time?.groups) continue;
    const subject = cleanSubject(body.slice(0, dash));
    if (!subject) continue;

    const startMer = time.groups.smer;
    const endMer = time.groups.emer;
    const start = minuteOf(
      Number(time.groups.sh),
      time.groups.sm ? Number(time.groups.sm) : 0,
      startMer ?? endMer,
    );
    const end = minuteOf(
      Number(time.groups.eh),
      time.groups.em ? Number(time.groups.em) : 0,
      endMer ?? startMer,
    );
    if (start == null || end == null) continue;

    let rangeStart = start;
    let rangeEnd = end;
    if (start < end) {
      // ok
    } else if (!startMer && endMer && start - 12 * 60 >= 0 && start - 12 * 60 < end) {
      rangeStart = start - 12 * 60;
    } else if (startMer && end + 12 * 60 <= 24 * 60 && start < end + 12 * 60) {
      rangeEnd = end + 12 * 60;
    } else {
      continue;
    }

    return {
      date,
      startMinutes: rangeStart,
      endMinutes: rangeEnd,
      subject,
      sections: sectionsFrom(time.groups.sections),
      group: "",
    };
  }
  return null;
}

/** Parse announcement message as a date sheet. referenceDateIso = YYYY-MM-DD of publishedAt. */
export function parseExamSchedule(message: string, referenceDateIso: string): ExamSchedule {
  let group = "";
  const exams: Exam[] = [];
  let unreadable = 0;

  for (const raw of message.split(/\r?\n/)) {
    const line = plain(raw);
    if (!line) continue;
    const h = heading(line);
    if (h != null) {
      group = h;
      continue;
    }
    const exam = parseLine(line, referenceDateIso);
    if (exam) {
      exams.push({ ...exam, group });
    } else if (looksLikeExam(line)) {
      unreadable++;
    }
  }

  const groups = [...new Set(exams.map(e => e.group).filter(Boolean))];
  exams.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
  return { groups, exams, unreadable };
}

function token(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase().replace(/[\s\-_]/g, "");
  return code || null;
}

function studentTokens(profile: {
  branch?: string | null;
  section?: string | null;
  subsection?: string | null;
  group?: string | null;
}): Set<string> {
  const set = new Set<string>();
  for (const v of [profile.branch, profile.section, profile.subsection, profile.group]) {
    const t = token(v);
    if (t) set.add(t);
  }
  return set;
}

function namesStudent(listed: string, mine: Set<string>): boolean {
  const code = token(listed);
  if (!code) return false;
  for (const it of mine) {
    if (it === code || (code.length >= 3 && it.startsWith(code))) return true;
  }
  return false;
}

/** Keep exams this student sits (section filter), matching Android applySections. */
export function applyExamSections(
  exams: Exam[],
  profile: { branch?: string | null; section?: string | null; subsection?: string | null; group?: string | null },
): Exam[] {
  const mine = studentTokens(profile);
  const byDate = new Map<string, Exam[]>();
  for (const e of exams) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const out: Exam[] = [];
  for (const thatDay of byDate.values()) {
    const tagged = thatDay.filter(e => e.sections.length > 0);
    const forMe = tagged.filter(e => e.sections.some(s => namesStudent(s, mine)));
    if (tagged.length === 0 || forMe.length === 0) {
      out.push(...thatDay);
    } else {
      out.push(...thatDay.filter(e => e.sections.length === 0 || forMe.includes(e)));
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
  return out;
}

function publishedOnIso(publishedAt: string, fallbackIso: string): string {
  if (!publishedAt) return fallbackIso;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return fallbackIso;
  const d = new Date(t);
  // Use local calendar date of publication
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ExamGroupChoice = {
  announcementId: string;
  groupName: string;
};

const EXAM_GROUP_KEY = "nextlecture:exam-group-choice";

export function readExamGroupChoice(): ExamGroupChoice | null {
  try {
    const raw = localStorage.getItem(EXAM_GROUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExamGroupChoice;
    if (typeof parsed?.announcementId === "string" && typeof parsed?.groupName === "string") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeExamGroupChoice(announcementId: string, groupName: string) {
  try {
    if (!announcementId || !groupName) {
      localStorage.removeItem(EXAM_GROUP_KEY);
      return;
    }
    localStorage.setItem(EXAM_GROUP_KEY, JSON.stringify({ announcementId, groupName }));
  } catch {
    /* ignore */
  }
}

/** Resolve exam state for the student from an exam-mode announcement. */
export function resolveExamState(
  announcement: Announcement,
  profile: { branch?: string | null; section?: string | null; subsection?: string | null; group?: string | null } | null,
  todayIso: string,
  groupChoice: ExamGroupChoice | null,
): ExamState | null {
  if (!isExamModeOn(announcement.examMode)) return null;
  const schedule = parseExamSchedule(announcement.message, publishedOnIso(announcement.publishedAt, todayIso));
  const groups = schedule.groups;
  let group: string | null = null;
  if (groups.length <= 1) {
    group = groups[0] ?? null;
  } else if (groupChoice?.announcementId === announcement.id) {
    group = groups.find(g => g.trim().toLowerCase() === groupChoice.groupName.trim().toLowerCase()) ?? null;
  }
  const forGroup = schedule.exams.filter(e => !e.group || e.group === group);
  const exams = applyExamSections(forGroup, profile ?? {});
  return {
    announcement,
    schedule,
    group,
    exams,
    needsGroupPick: groups.length > 1 && group == null,
  };
}

export function computeExamTimeline(exams: Exam[], now: Date): ExamTimelineView {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const ordered = [...exams].sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);

  const over = (exam: Exam) =>
    exam.date < today || (exam.date === today && exam.endMinutes <= nowMinutes);

  const ongoing = ordered.find(
    e => e.date === today && e.startMinutes <= nowMinutes && nowMinutes < e.endMinutes,
  );
  const laterToday = ordered.find(e => e.date === today && e.startMinutes > nowMinutes);

  let featured: ExamFeatured | null = null;
  if (ongoing) {
    featured = { exam: ongoing, phase: "ongoing", daysAhead: 0, minutes: ongoing.endMinutes - nowMinutes };
  } else if (laterToday) {
    featured = { exam: laterToday, phase: "today", daysAhead: 0, minutes: laterToday.startMinutes - nowMinutes };
  } else {
    const next = ordered.find(e => e.date > today);
    if (next) {
      const days = daysBetween(today, next.date);
      featured = {
        exam: next,
        phase: "upcoming",
        daysAhead: days,
        minutes: days * 24 * 60 + next.startMinutes - nowMinutes,
      };
    }
  }

  const upcoming = ordered.filter(e => !over(e) && e !== featured?.exam);
  const finished = ordered.filter(over).length;
  return {
    featured,
    upcoming,
    finished,
    total: ordered.length,
    allOver: featured == null && ordered.length > 0,
  };
}

export function formatExamTimeRange(startMinutes: number, endMinutes: number): string {
  const fmt = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(startMinutes)}–${fmt(endMinutes)}`;
}

export function formatExamDate(iso: string, now: Date = new Date()): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(dt);
}

export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
