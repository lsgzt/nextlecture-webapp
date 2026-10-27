/**
 * Derives each teacher's weekly timetable from the room-occupancy data the
 * vacant-rooms feature already fetches — a web-native port of the Android
 * app's FacultyTimetableManager + FacultyNameMatcher.
 *
 * Every room cell carries the teacher label the department website
 * publishes ("DR AMANDEEP KAUR", "SSK (Dr. Sehijpal Singh)", "HVS").
 * Those labels are matched to the bundled faculty directory with the same
 * two-pass strategy the Android app validated against all seven live
 * department files: strict full-name scoring (with department annotations
 * and honorific tie-breaks), then bare-code subsequence matching.
 */
import type { GlobalRoomData, RoomCell } from "@shared/vacant-rooms";
import type { FacultyMember } from "@/data/faculty-directory";
import { FACULTY_MEMBERS } from "@/lib/faculty-directory";

export type FacultySlot = {
  dayIndex: number;
  slotIndex: number;
  startMinutes: number;
  subject: string | null;
  room: string | null;
  activity: string | null;
};

export type FacultySchedules = Map<string, FacultySlot[]>;

const TITLES = new Set(["dr", "er", "prof", "professor", "pf", "mrs", "mr", "ms", "miss", "sh", "smt", "shri"]);

/** Short uppercase codes that actually name a DEPARTMENT, not a teacher. */
const DEPT_CODES: Record<string, string> = {
  ee: "Electrical Engineering",
  ec: "Electronics & Communication Engineering",
  ece: "Electronics & Communication Engineering",
  me: "Mechanical Engineering",
  mpe: "Mechanical Engineering",
  ce: "Civil Engineering",
  it: "Information Technology",
  cse: "Computer Science & Engg.",
  cs: "Computer Science & Engg.",
  ws: "Workshops",
  as: "Applied Science",
  aps: "Applied Science",
  appsc: "Applied Science",
  applied: "Applied Science",
  mba: "Business Administration",
  mca: "Computer Applications",
  ca: "Computer Applications",
};

/** Teacher codes that are NOT department codes ("ER. X (TA)" is an assistant). */
const TEACHER_CODES = new Set(["ta", "ta1", "ta2", "ta3"]);

const PARENS_TAIL = /^([^(]+)\s*\(([^)]+)\)\s*$/;
const DASH_CODE = /[-–]\s*([A-Za-z]{2,5})\s*$/;

/** Lowercase alnum tokens with honorific titles removed. */
export function nameTokens(name: string | null | undefined): string[] {
  return (name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 0 && !TITLES.has(token));
}

export function normName(name: string | null | undefined): string {
  return nameTokens(name).join(" ");
}

/** Honorific at the start of the name, or "" when absent. */
function titleOf(name: string): string {
  const first = (name.trim().split(/[^A-Za-z]+/)[0] ?? "").toLowerCase();
  return TITLES.has(first) ? first : "";
}

/** Department annotation embedded in a label: "(EE)", "JJK_ME", "(AppSc)". */
function deptHintOf(label: string): string | null {
  for (const token of label.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    const dept = DEPT_CODES[token];
    if (dept) return dept;
  }
  return null;
}

function isCode(value: string): boolean {
  const core = value.replace(/[-_ ]/g, "");
  return core.length >= 2 && core.length <= 5 && /^[A-Z]+$/.test(core);
}

function isNameLike(value: string): boolean {
  const tokens = value.replace(/_/g, " ").split(/\s+/).filter(Boolean);
  return tokens.length >= 2 || value.length >= 8;
}

/**
 * Splits a TOC/caption label into its full-name and code parts:
 * "SSK (Dr. Sehijpal Singh)" -> "Dr. Sehijpal Singh" / "SSK".
 */
export function extractFullName(label: string): { fullName: string | null; code: string | null } {
  const trimmed = label.trim();
  const paren = PARENS_TAIL.exec(trimmed);
  if (paren) {
    const left = paren[1].trim();
    const right = paren[2].trim();
    const rightParts = right.replace(/_/g, " ").split(/\s+/).filter(Boolean);
    const rightCore = rightParts[0] ?? "";
    if (isCode(rightCore)) {
      return { fullName: isNameLike(left) ? left : null, code: rightCore };
    }
    const leftParts = left.replace(/_/g, " ").split(/\s+/).filter(Boolean);
    const leftCore = leftParts[0] ?? "";
    if (isCode(leftCore) && leftParts.length <= 2) {
      if (isNameLike(right)) return { fullName: right, code: leftCore };
      return { fullName: null, code: leftCore };
    }
    if (isNameLike(left)) return { fullName: left, code: null };
    if (isNameLike(right)) return { fullName: right, code: null };
    return { fullName: null, code: null };
  }
  const dash = DASH_CODE.exec(trimmed);
  if (dash) {
    const base = trimmed.slice(0, dash.index).trim();
    return { fullName: isNameLike(base) ? base : null, code: dash[1] };
  }
  if (isCode(trimmed)) {
    return { fullName: null, code: trimmed.replace(/[-_ ]/g, "") };
  }
  return { fullName: trimmed, code: null };
}

/** Damerau-Levenshtein distance (optimal string alignment). */
function damerau(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function tokenSimilar(a: string, b: string, threshold: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const longer = Math.max(a.length, b.length);
  return damerau(a, b) / longer <= 1 - threshold;
}

/**
 * How well a published teacher name matches a directory name.
 * 100 exact · 100 space-insensitive · 85 initial-per-token · 78 leading
 * token-subset · 75 given-name prefix · 70/65 fuzzy spelling variants.
 */
export function nameScore(published: string, directory: string): number {
  if (normName(published) === normName(directory)) return 100;
  if (nameTokens(published).join("") === nameTokens(directory).join("")) return 100;

  const cap = nameTokens(published);
  const dir = nameTokens(directory);
  if (cap.length === 0 || dir.length === 0) return 0;

  if (cap.length === dir.length) {
    if (cap.every((token, i) => token === dir[i] || (token.length === 1 && dir[i].startsWith(token)))) return 85;
    if (cap.every((token, i) => tokenSimilar(token, dir[i], 0.8))) return 70;
    if (cap.every((token, i) => tokenSimilar(token, dir[i], 0.75))) return 65;
  }
  if (cap.length < dir.length && dir.slice(0, cap.length).join(" ") === cap.join(" ")) return 78;
  if (dir.length < cap.length && cap.slice(0, dir.length).join(" ") === dir.join(" ")) return 78;
  if (cap.length === 1 && dir.length >= 2 && cap[0].length >= 4 && dir[0].startsWith(cap[0])) return 75;
  return 0;
}

/** True when a label is one of the teacher's other published spellings. */
function matchesAlias(published: string, aliases: string[]): boolean {
  if (aliases.length === 0) return false;
  const target = normName(published);
  if (!target) return false;
  return aliases.some(alias => normName(alias) === target);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const char of haystack) {
    if (i < needle.length && needle[i] === char) i++;
  }
  return i === needle.length;
}

/**
 * Cheap prefilter so per-label scoring stays fast with 319 members:
 * shares a token, shares the first token's initial with a similar-length
 * name, or one is a prefix of the other.
 */
function couldMatch(publishedTokens: string[], memberTokens: string[]): boolean {
  const firstA = publishedTokens[0] ?? "";
  const firstB = memberTokens[0] ?? "";
  if (!firstA || !firstB) return false;
  if (firstA === firstB) return true;
  const lenDiff = Math.abs(publishedTokens.length - memberTokens.length);
  if (lenDiff > 2) return false;
  if (firstA.charAt(0) !== firstB.charAt(0)) return false;
  return Math.abs(firstA.length - firstB.length) <= 2;
}

type ParsedLabel = { label: string; fullName: string | null; code: string | null; deptHint: string | null };

/**
 * Assigns every distinct teacher label it can trust to exactly one
 * directory member, then flattens the matching cells into per-member
 * weekly slot lists. Strict on purpose: an ambiguous label is left
 * unassigned rather than opening on the wrong teacher's profile.
 */
export function deriveFacultySchedules(roomData: GlobalRoomData, members: FacultyMember[] = FACULTY_MEMBERS): FacultySchedules {
  // 1) Collect every distinct teacher label with its cells.
  const byLabel = new Map<string, Array<{ room: string; dayIndex: number; slotIndex: number; cell: RoomCell }>>();
  for (const room of roomData.rooms) {
    room.occupancy.forEach((dayCells, dayIndex) => {
      dayCells.forEach((cellOrNull, slotIndex) => {
        if (!cellOrNull) return;
        const label = cellOrNull.teacher?.trim();
        if (!label) return;
        const key = label.replace(/\s+/g, " ");
        let cells = byLabel.get(key);
        if (!cells) {
          cells = [];
          byLabel.set(key, cells);
        }
        cells.push({ room: room.name, dayIndex, slotIndex, cell: cellOrNull });
      });
    });
  }

  // 2) Parse each distinct label once.
  const parsed: ParsedLabel[] = [];
  for (const label of Array.from(byLabel.keys())) {
    const { fullName, code } = extractFullName(label);
    if (!fullName && !code) continue;
    parsed.push({ label, fullName, code, deptHint: deptHintOf(label) });
  }

  // 3) Pass 1 — full-name matches. A label belongs to exactly one teacher.
  const assignment = new Map<string, ParsedLabel>();
  const claimed = new Set<string>();
  const aliasIndex = new Map<string, FacultyMember>();
  for (const member of members) {
    for (const alias of member.also_published_as ?? []) {
      const key = normName(alias);
      if (key) aliasIndex.set(key, member);
    }
  }

  for (const entry of parsed) {
    if (!entry.fullName) continue;
    const aliasOwner = aliasIndex.get(normName(entry.fullName));
    if (aliasOwner && !assignment.has(aliasOwner.profile_id)) {
      assignment.set(aliasOwner.profile_id, entry);
      claimed.add(entry.label);
      continue;
    }
    let best: FacultyMember | null = null;
    let bestScore = 0;
    let tie = false;
    const publishedTokens = nameTokens(entry.fullName);
    const publishedTitle = titleOf(entry.fullName);
    for (const member of members) {
      if (!couldMatch(publishedTokens, nameTokens(member.name))) continue;
      let score = nameScore(entry.fullName, member.name);
      if (score > 0) {
        if (entry.deptHint && entry.deptHint !== member.department) score = Math.max(0, score - 40);
        if (score > 0 && publishedTitle && titleOf(member.name) === publishedTitle) score += 3;
      }
      if (score > bestScore) {
        best = member;
        bestScore = score;
        tie = false;
      } else if (score === bestScore && score > 0) {
        tie = true;
      }
    }
    if (best && bestScore >= 65 && !tie) {
      assignment.set(best.profile_id, entry);
      claimed.add(entry.label);
    }
  }

  // 4) Pass 2 — bare codes, iterated to a fixpoint, globally unique.
  const assignedNames = new Set(Array.from(assignment.values()).map(entry => normName(entry.fullName ?? "")));
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of parsed) {
      if (!entry.code || entry.code.length < 2) continue;
      const codeKey = entry.code.toLowerCase();
      if (DEPT_CODES[codeKey] || TEACHER_CODES.has(codeKey)) continue;
      if (claimed.has(entry.label)) continue;
      const hits = members.filter(member => {
        const key = normName(member.name);
        return (
          !assignedNames.has(key) &&
          isSubsequence(codeKey, nameTokens(member.name).join("")) &&
          codeKey.charAt(0) === (nameTokens(member.name)[0] ?? " ").charAt(0)
        );
      });
      if (hits.length === 1) {
        assignment.set(hits[0].profile_id, entry);
        assignedNames.add(normName(hits[0].name));
        claimed.add(entry.label);
        changed = true;
      }
    }
  }

  // 5) Flatten cells of each assigned label into the member's slot list.
  const schedules: FacultySchedules = new Map();
  const slotStarts = roomData.slotStarts;
  for (const [profileId, entry] of Array.from(assignment)) {
    const cells = byLabel.get(entry.label) ?? [];
    const slots: FacultySlot[] = cells
      .filter(({ cell }) => cell.busy)
      .map(({ room, dayIndex, slotIndex, cell }) => ({
        dayIndex,
        slotIndex,
        startMinutes: slotStarts[slotIndex] ?? 0,
        subject: cell.subject ?? null,
        room: room ?? null,
        activity: cell.activity ?? null,
      }))
      .sort((a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex);
    if (slots.length > 0) schedules.set(profileId, slots);
  }
  return schedules;
}

export type FacultyLiveStatus =
  | { kind: "no-timetable" }
  | { kind: "weekend" }
  | { kind: "free"; until: string | null }
  | { kind: "busy"; until: string | null; subject: string | null; room: string | null };

function minutesFromParts(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatMinutes(total: number): string {
  let h = Math.floor(total / 60);
  const m = total % 60;
  const meridiem = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/** Today's day index for occupancy rows (0=Mon … 6=Sun), null on weekends. */
export function facultyDayIndex(date: Date): number | null {
  const dow = date.getDay();
  return dow === 0 || dow === 6 ? null : dow - 1;
}

/** Live free/busy answer for one teacher, mirroring the Android detail screen. */
export function facultyLiveStatus(slots: FacultySlot[] | undefined, slotStarts: number[], now: Date): FacultyLiveStatus {
  if (!slots || slots.length === 0) return { kind: "no-timetable" };
  const dayIndex = facultyDayIndex(now);
  if (dayIndex === null) return { kind: "weekend" };
  const today = slots.filter(slot => slot.dayIndex === dayIndex).sort((a, b) => a.slotIndex - b.slotIndex);
  if (today.length === 0) return { kind: "free", until: null };
  const nowMinutes = minutesFromParts(now);
  const current = today.find(slot => {
    const start = slot.startMinutes;
    return nowMinutes >= start && nowMinutes < start + 60;
  });
  if (current) {
    const next = today.find(slot => slot.slotIndex > current.slotIndex);
    return { kind: "busy", until: formatMinutes(current.startMinutes + 60), subject: current.subject, room: current.room };
  }
  const next = today.find(slot => slot.startMinutes > nowMinutes);
  if (next) {
    return { kind: "free", until: formatMinutes(next.startMinutes) };
  }
  const lastEnd = today[today.length - 1].startMinutes + 60;
  if (nowMinutes >= lastEnd) return { kind: "free", until: null };
  return { kind: "free", until: formatMinutes(today[0].startMinutes) };
}
