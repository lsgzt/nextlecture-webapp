/**
 * Types for the GNDEC vacant-room finder.
 * Ported from nextlecture-android (VacantRoomsManager / RoomMerger / parsers).
 */

export type SourceKind = "ROOMS" | "GROUPS_CELLS";

/** One physical room in one 1-hour slot. null cell = unknown (never vacant). */
export type RoomCell = {
  busy: boolean;
  subject?: string | null;
  teacher?: string | null;
  studentsSet?: string | null;
  activity?: string | null;
};

export type SourceRoom = {
  key: string;
  name: string;
  /** [dayIndex 0=Mon..6=Sun][slotIndex] */
  occupancy: (RoomCell | null)[][];
};

export type SourceRoomDoc = {
  rootId: string;
  kind: SourceKind;
  url: string;
  slotStarts: number[];
  rooms: SourceRoom[];
  generatedAtMillis: number | null;
  fetchedAtMillis: number;
};

export type RoomSourceSummary = {
  rootId: string;
  kind: SourceKind;
  url: string;
  roomCount: number;
  generatedAtMillis: number | null;
  fetchedAtMillis: number;
};

export type MergedRoom = {
  key: string;
  name: string;
  occupancy: (RoomCell | null)[][];
};

export type GlobalRoomData = {
  sources: RoomSourceSummary[];
  incompleteRoots: string[];
  days: string[];
  slotStarts: number[];
  rooms: MergedRoom[];
  fetchedAtMillis: number;
};

export const VACANT_ROOMS_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const SLOT_MINUTES = 60;

export function slotEndMinutes(slotStartMinutes: number): number {
  return slotStartMinutes + SLOT_MINUTES;
}

/** Today when Mon–Fri, else Monday (index 0). */
export function defaultDayIndex(today = new Date()): number {
  const dow = today.getDay(); // 0=Sun … 6=Sat
  if (dow === 0 || dow === 6) return 0;
  return dow - 1;
}

export function defaultSlotIndex(slotStarts: number[], now = new Date()): number {
  if (!slotStarts.length) return 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best = 0;
  for (let i = 0; i < slotStarts.length; i++) {
    if (nowMinutes >= slotStarts[i]) best = i;
  }
  if (nowMinutes < slotStarts[0]) return 0;
  return best;
}

export function isToday(dayIndex: number, today = new Date()): boolean {
  const dow = today.getDay();
  if (dow === 0 || dow === 6) return false;
  return dayIndex === dow - 1;
}

export function isCurrentSlot(slotStart: number, nowMinutes: number): boolean {
  return nowMinutes >= slotStart && nowMinutes < slotStart + SLOT_MINUTES;
}

export function rootLabel(rootId: string): string {
  switch (rootId) {
    case "appsc":
      return "College";
    case "cse":
      return "CSE";
    case "ece":
      return "ECE";
    case "ee":
      return "EE";
    case "me":
      return "ME";
    case "ce":
      return "CE";
    case "it":
      return "IT";
    case "mca":
      return "MCA";
    case "mba":
      return "MBA";
    default:
      return rootId.toUpperCase();
  }
}

export function formatSlotRange(startMinutes: number): string {
  const end = slotEndMinutes(startMinutes);
  return `${formatMinutes(startMinutes)} – ${formatMinutes(end)}`;
}

export function formatMinutes(total: number): string {
  let h = Math.floor(total / 60);
  const m = total % 60;
  const meridiem = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${meridiem}`;
}

const LETTER_NUMBER = /^([A-Z]{1,3})[\s\-_]*(\d{1,4}[A-Z]{0,2})$/;
const LAB_SHORTHAND = /^(.+?)\s*\/\s*L\s*(\([^)]*\))?$/;
const PARENS = /\(([^)]*)\)/g;
const LAB_ANNOTATION = /^[A-Z]+\s*LAB\s*\S+$/;
const PUNCT = /[-_.,/]/g;
const WHITESPACE = /\s+/g;

const ROOM_ALIASES: Record<string, string> = {
  "WS SEMINAR HALL": "W S SEMINAR HALL",
  "W SHOP SEM HALL": "W S SEMINAR HALL",
  "W S SEM HALL": "W S SEMINAR HALL",
  "SEM HALL": "SEMINAR HALL BA",
  "MEAS LAB": "MEASUREMENT LAB",
  "ADV MEAS LAB": "ADVANCE MEASUREMENT LAB",
  "F102 AUTO BLK": "F102",
  "MBA COMP LAB": "COMP LAB MBA",
};

/** Normalized merge key used for search + cross-department identity. */
export function canonicalRoomName(raw: string): string | null {
  let s = raw.replace(/\u00a0/g, " ").replace(/\u202f/g, " ").toUpperCase().trim();
  if (!s) return null;
  s = s.replace(WHITESPACE, " ").trim().replace(/\.$/, "").trim();
  const shorthand = LAB_SHORTHAND.exec(s);
  if (shorthand) {
    const annotation = (shorthand[2] ?? "").replace(/[()]/g, "").trim();
    s = `${shorthand[1]} LAB ${annotation}`.trim();
  }
  s = s.replace(PARENS, (_m, inner: string) => {
    const t = String(inner).trim();
    return LAB_ANNOTATION.test(t) ? ` ${t} ` : " ";
  });
  s = s.replace(PUNCT, " ").replace(WHITESPACE, " ").trim();
  if (!s) return null;
  if (ROOM_ALIASES[s]) s = ROOM_ALIASES[s];
  const ln = LETTER_NUMBER.exec(s);
  if (ln) s = ln[1] + ln[2];
  return s;
}

/** Search matching tolerant of separators and partial numbers (matches Android). */
export function roomNameMatches(roomName: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (roomName.toLowerCase().includes(q.toLowerCase())) return true;
  const qKey = canonicalRoomName(q);
  const nKey = canonicalRoomName(roomName);
  if (!qKey || !nKey) return false;
  if (nKey.includes(qKey)) return true;
  const qMatch = LETTER_NUMBER.exec(qKey);
  if (qMatch) {
    const nMatch = LETTER_NUMBER.exec(nKey);
    if (nMatch && nMatch[1] === qMatch[1]) {
      const qDigits = qMatch[2].replace(/\D.*/, "");
      const nDigits = nMatch[2].replace(/\D.*/, "");
      if (
        qDigits &&
        nDigits &&
        (nDigits === qDigits || nDigits.endsWith(qDigits) || qDigits.endsWith(nDigits))
      ) {
        return true;
      }
    }
  }
  return false;
}
