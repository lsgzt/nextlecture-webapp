/**
 * Vacant room finder — server port of nextlecture-android VacantRoomsManager,
 * RoomTimetableClient, RoomTimetableParser, RoomNameNormalizer, RoomMerger.
 */

import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { eq } from "drizzle-orm";
import { externalSourceCache } from "../drizzle/schema";
import type {
  GlobalRoomData,
  MergedRoom,
  RoomCell,
  RoomSourceSummary,
  SourceKind,
  SourceRoom,
  SourceRoomDoc,
} from "../shared/vacant-rooms";
import { canonicalRoomName, VACANT_ROOMS_DAYS } from "../shared/vacant-rooms";
import { getDb } from "./db";

export type RoomSourceRoot = {
  id: string;
  indexUrl: string;
  host: string;
};

export const ROOM_SOURCE_ROOTS: RoomSourceRoot[] = [
  { id: "appsc", indexUrl: "https://appsc.gndec.ac.in/time_tables", host: "appsc.gndec.ac.in" },
  { id: "cse", indexUrl: "https://cse.gndec.ac.in/?q=node/5", host: "cse.gndec.ac.in" },
  { id: "ece", indexUrl: "https://ece.gndec.ac.in/?q=node/5", host: "ece.gndec.ac.in" },
  { id: "ee", indexUrl: "https://ee.gndec.ac.in/?q=node/5", host: "ee.gndec.ac.in" },
  { id: "me", indexUrl: "https://me.gndec.ac.in/?q=node/5", host: "me.gndec.ac.in" },
  { id: "ce", indexUrl: "https://ce.gndec.ac.in/?q=node/5", host: "ce.gndec.ac.in" },
  { id: "it", indexUrl: "https://it.gndec.ac.in/?q=node/5", host: "it.gndec.ac.in" },
  { id: "mca", indexUrl: "https://mca.gndec.ac.in/?q=node/5", host: "mca.gndec.ac.in" },
  { id: "mba", indexUrl: "https://mba.gndec.ac.in/?q=node/5", host: "mba.gndec.ac.in" },
];

const ROOT_ORDER = ["appsc", "cse", "ece", "ee", "me", "ce", "it", "mca", "mba"];
/** Prefer live data newer than this. Beyond it we still serve durable cache and refresh in background. */
const FRESH_WINDOW_MS = 60 * 60 * 1000;
/** Kick a non-blocking refresh once age exceeds this soft TTL. */
const SOFT_REFRESH_MS = 20 * 60 * 1000;
const MAX_CANDIDATES = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "NextLecture/1.0 (GNDEC vacant rooms)";
/** Durable MySQL key (reuses timetable_cache table as a generic external-source store). */
const PERSISTENT_CACHE_KEY = "vacant-rooms-v1";

type RootCandidates = {
  root: RoomSourceRoot;
  roomUrls: string[];
  groupUrls: string[];
};

type CachedRoomData = {
  docs: SourceRoomDoc[];
  incompleteRoots: string[];
  fetchedAtMillis: number;
};

let memoryCache: CachedRoomData | null = null;
let inFlight: Promise<GlobalRoomData> | null = null;

function isValidCachedRoomData(value: unknown): value is CachedRoomData {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CachedRoomData>;
  return (
    Array.isArray(row.docs) &&
    row.docs.length > 0 &&
    Array.isArray(row.incompleteRoots) &&
    typeof row.fetchedAtMillis === "number" &&
    Number.isFinite(row.fetchedAtMillis)
  );
}

async function readPersistentCache(): Promise<CachedRoomData | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ payload: externalSourceCache.payload })
      .from(externalSourceCache)
      .where(eq(externalSourceCache.id, PERSISTENT_CACHE_KEY))
      .limit(1);
    if (!rows[0]?.payload) return null;
    const parsed = JSON.parse(rows[0].payload) as unknown;
    if (!isValidCachedRoomData(parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn("[Vacant rooms] Persistent cache could not be read:", error);
    return null;
  }
}

async function persistCache(cache: CachedRoomData): Promise<void> {
  if (!cache.docs.length) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(externalSourceCache)
      .values({
        id: PERSISTENT_CACHE_KEY,
        sourceUrl: "vacant-rooms-multi-root",
        payload: JSON.stringify(cache),
        fetchedAt: new Date(cache.fetchedAtMillis),
      })
      .onDuplicateKeyUpdate({
        set: {
          sourceUrl: "vacant-rooms-multi-root",
          payload: JSON.stringify(cache),
          fetchedAt: new Date(cache.fetchedAtMillis),
        },
      });
  } catch (error) {
    console.warn("[Vacant rooms] Persistent cache could not be saved:", error);
  }
}

async function getKnownCache(): Promise<CachedRoomData | null> {
  if (memoryCache?.docs.length) return memoryCache;
  const persistent = await readPersistentCache();
  if (persistent) memoryCache = persistent;
  return persistent;
}

const PLACEHOLDERS = new Set([
  "GHOST ROOM", "TEACH OFFICE", "TEACH OFFICE1", "FACULTY ROOM",
  "A OTHER DEPTT", "B OTHER DEPTT", "C OTHER DEPTT", "FIRST YEAR ROOM", "A", "B", "C",
]);

function isPlaceholder(key: string) {
  return PLACEHOLDERS.has(key);
}

function isRoomLike(key: string) {
  return /^[A-Z]{1,3}\d/.test(key);
}

function displayName(candidates: { priority: number; name: string }[]): string {
  return (
    [...candidates].sort((a, b) => a.priority - b.priority || a.name.length - b.name.length || a.name.localeCompare(b.name))[0]
      ?.name ?? ""
  );
}

function isCandidateUrl(raw: string, root: RoomSourceRoot): boolean {
  try {
    const parsed = new URL(raw.trim());
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname.toLowerCase() === root.host.toLowerCase() &&
      parsed.pathname.toLowerCase().endsWith(".html")
    );
  } catch {
    return false;
  }
}

type AnchorKind = "ROOMS" | "GROUPS" | "NONE";

function classifyAnchor(label: string, href: string, root: RoomSourceRoot): AnchorKind {
  if (!isCandidateUrl(href, root)) return "NONE";
  let path = "";
  try {
    path = new URL(href).pathname.toLowerCase();
  } catch {
    return "NONE";
  }
  if (path.includes("rooms") || path.includes("room_")) return "ROOMS";
  if (path.includes("groups_days_horizontal") || path.includes("years_days_horizontal")) return "GROUPS";
  const l = label.toLowerCase();
  if (l.includes("class room") || l.includes("classroom")) return "ROOMS";
  if (["class", "student", "group"].some(t => l.includes(t))) return "GROUPS";
  if (l.includes("room")) return "ROOMS";
  return "NONE";
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const body = await response.text();
  if (!body.trim()) throw new Error(`Empty body for ${url}`);
  return body;
}

function discoverRoot(root: RoomSourceRoot, html: string): RootCandidates {
  const $ = load(html);
  const roomUrls: string[] = [];
  const groupUrls: string[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const hrefAttr = $(el).attr("href") ?? "";
    let href = "";
    try {
      href = new URL(hrefAttr, root.indexUrl).toString();
    } catch {
      return;
    }
    if (!href || seen.has(href)) return;
    seen.add(href);
    const label = ($(el).text() ?? "").replace(/\u00a0/g, " ").trim();
    const kind = classifyAnchor(label, href, root);
    if (kind === "ROOMS") roomUrls.push(href);
    else if (kind === "GROUPS") groupUrls.push(href);
  });
  return { root, roomUrls, groupUrls };
}

async function discoverAll(): Promise<Map<string, RootCandidates>> {
  const results = await Promise.all(
    ROOM_SOURCE_ROOTS.map(async root => {
      try {
        const html = await fetchText(root.indexUrl);
        return [root.id, discoverRoot(root, html)] as const;
      } catch {
        return [root.id, { root, roomUrls: [] as string[], groupUrls: [] as string[] }] as const;
      }
    }),
  );
  return new Map(results);
}

function isCurrentSession(generatedAtMillis: number | null, nowMillis: number): boolean {
  if (generatedAtMillis == null) return true;
  const generated = new Date(generatedAtMillis);
  const now = new Date(nowMillis);
  if (generated.getTime() > now.getTime()) return true;
  const session = (d: Date) => {
    const m = d.getMonth() + 1;
    return m >= 6 && m <= 12 ? `${d.getFullYear()}-2` : `${d.getFullYear()}-1`;
  };
  return session(generated) === session(now);
}

const GENERATED_ON =
  /generated with FET\s+\S+\s+on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})[\u202f\u00a0 ]*([AaPp][Mm])?/i;
const TIME_IN_LABEL = /(\d{1,2})[.:](\d{2})(?:\s*([AaPp][Mm]))?/;
const DIALECT_B_ACTIVITY = /\(?([LPT])\)?\s*\.?\s*$/;
const EMPTY_CELL_TEXT = new Set(["---", "-x-", "-", "--", "x", "not available", "na", "n/a"]);

type GridCell = {
  busy: boolean;
  subject?: string | null;
  teacher?: string | null;
  studentsSet?: string | null;
  activity?: string | null;
  roomNames: string[];
};

function slotStartMinutes(label: string): number | null {
  const m = TIME_IN_LABEL.exec(label);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = (m[3] ?? "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  else if (!meridiem && hour <= 7) hour += 12;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseGeneratedAtMillis(html: string): number | null {
  const m = GENERATED_ON.exec(html);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const meridiem = (m[6] ?? "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

function dayIndexFor(label: string, column: number, columnCount: number): number | null {
  const token = (label.split(" ")[0] ?? "").toUpperCase();
  switch (token) {
    case "MONDAY": return 0;
    case "TUESDAY": case "TUES": case "TUE": return 1;
    case "WEDNESDAY": case "WED": return 2;
    case "THURSDAY": case "THURS": case "THU": return 3;
    case "FRIDAY": case "FRI": return 4;
    case "SATURDAY": case "SAT": return 5;
    case "SUNDAY": case "SUN": return 6;
  }
  if (token.length <= 2 && columnCount >= 5 && columnCount <= 6 && column < 6) return column;
  return null;
}

function tableName($: CheerioAPI, table: Cheerio<Element>): string | null {
  const captionName = table.find("caption span.name").first().text().trim();
  if (captionName) return captionName;
  const colspanHeader = table.find("thead th[colspan]").first().text().trim();
  return colspanHeader || null;
}

function resolveDays($: CheerioAPI, table: Cheerio<Element>): (number | null)[] {
  const labels = table.find("thead th.xAxis").map((_, el) => $(el).text().trim()).get();
  return labels.map((label, index) => dayIndexFor(label, index, labels.length));
}

function slotStartsOf($: CheerioAPI, table: Cheerio<Element>): number[] {
  const starts: number[] = [];
  table.find("tbody tr").each((_, row) => {
    const label = $(row).find("th.yAxis").first().text();
    if (!label) return;
    const minutes = slotStartMinutes(label);
    if (minutes == null || starts.includes(minutes)) return;
    starts.push(minutes);
  });
  return starts;
}

function parseCell($: CheerioAPI, td: Cheerio<Element>): GridCell | null {
  const text = td.text().trim();
  if (td.hasClass("empty") || !text || EMPTY_CELL_TEXT.has(text.toLowerCase())) {
    return { busy: false, roomNames: [] };
  }
  const subjects = td.find("span.subject").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const teachers = td.find("div.teacher").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const sets = td.find("div.studentsset").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const activityRaw = td.find("span.activitytag").first().text().trim().toUpperCase();
  const activity = activityRaw === "L" || activityRaw === "P" || activityRaw === "T" ? activityRaw : undefined;
  const roomNames = td.find("span[class^=r_]").map((_, el) => $(el).text().trim()).get().filter(Boolean);

  if (!subjects.length && !teachers.length && !sets.length && !roomNames.length) {
    const html = td.html() ?? "";
    const lines = html
      .split(/<br\s*\/?>/i)
      .map(fragment => load(`<div>${fragment}</div>`).text().trim())
      .filter(line => line && !EMPTY_CELL_TEXT.has(line.toLowerCase()));
    if (!lines.length) return null;
    let subject: string | null = null;
    let act: string | undefined;
    const subjectLine = lines[lines.length - 1]!;
    const activityMatch = DIALECT_B_ACTIVITY.exec(subjectLine);
    if (activityMatch) {
      act = activityMatch[1];
      const stripped = subjectLine.slice(0, activityMatch.index).trim();
      subject = stripped || subjectLine;
    } else {
      subject = subjectLine;
    }
    return {
      busy: true,
      subject,
      teacher: lines[lines.length - 2] ?? null,
      studentsSet: lines[lines.length - 3] ?? null,
      activity: act,
      roomNames: [],
    };
  }

  return {
    busy: true,
    subject: subjects.join(" · ") || null,
    teacher: teachers.join(" · ") || null,
    studentsSet: sets.join(" · ") || null,
    activity,
    roomNames,
  };
}

function parseTableGrid(
  $: CheerioAPI,
  table: Cheerio<Element>,
  days: (number | null)[],
  slotCount: number,
): (GridCell | null)[][] | null {
  const rows = table.find("tbody tr").filter((_, el) => $(el).find("th.yAxis").length > 0).toArray();
  if (!rows.length) return null;
  const sourceDayCount = days.length;
  const grid: (GridCell | null)[][] = Array.from({ length: sourceDayCount }, () =>
    Array.from({ length: slotCount }, () => null),
  );
  const spanLeft = new Array(sourceDayCount).fill(0);
  const spanCarry: (GridCell | null)[] = new Array(sourceDayCount).fill(null);
  const slotIndexOf = new Map<number, number>();
  slotStartsOf($, table).forEach((minutes, i) => slotIndexOf.set(minutes, i));
  let rowIndex = 0;
  for (const tr of rows) {
    const $tr = $(tr);
    const label = $tr.find("th.yAxis").first().text() || "";
    const minutes = slotStartMinutes(label);
    let slotIndex = minutes != null ? slotIndexOf.get(minutes) : undefined;
    if (slotIndex == null) {
      if (rowIndex < slotCount) slotIndex = rowIndex;
      else continue;
    }
    rowIndex += 1;
    let column = 0;
    const cells = $tr.children("td").toArray().map(el => $(el as Element));
    let cellIndex = 0;
    while (column < sourceDayCount) {
      if (spanLeft[column]! > 0) {
        grid[column]![slotIndex] = spanCarry[column] ?? { busy: true, roomNames: [] };
        spanLeft[column]! -= 1;
        column += 1;
        continue;
      }
      if (cellIndex >= cells.length) break;
      const td = cells[cellIndex++]!;
      const rowspan = Math.max(1, Number(td.attr("rowspan") ?? "1") || 1);
      const cell = parseCell($, td);
      grid[column]![slotIndex] = cell;
      if (rowspan > 1) {
        spanLeft[column] = rowspan - 1;
        spanCarry[column] = cell;
      }
      column += 1;
    }
    while (column < sourceDayCount && spanLeft[column]! > 0) {
      grid[column]![slotIndex] = spanCarry[column] ?? { busy: true, roomNames: [] };
      spanLeft[column]! -= 1;
      column += 1;
    }
  }
  return grid;
}

function gridCellToRoomCell(cell: GridCell | null | undefined): RoomCell | null {
  if (cell == null || !cell.busy) return { busy: false };
  return {
    busy: true,
    subject: cell.subject ?? null,
    teacher: cell.teacher ?? null,
    studentsSet: cell.studentsSet ?? null,
    activity: cell.activity ?? null,
  };
}

function parseDoc(html: string, rootId: string, url: string, fetchedAtMillis: number, kind: SourceKind): SourceRoomDoc {
  if (!html.trim()) throw new Error("empty room timetable html");
  const $ = load(html);
  const tables = $("table[id^=table_]")
    .toArray()
    .map(el => $(el as Element))
    .filter(table => tableName($, table) != null);
  if (!tables.length) throw new Error("no room tables discovered in document");
  const first = tables[0]!;
  const days = resolveDays($, first);
  if (!days.some(d => d != null && d >= 0 && d <= 5)) throw new Error("no weekday columns found");
  const slotStarts = slotStartsOf($, first);
  if (!slotStarts.length) throw new Error("no time slots found");
  const generatedAt = parseGeneratedAtMillis(html);
  const dayRowCount = 7;
  const byKey = new Map<string, SourceRoom>();
  for (const table of tables) {
    const grid = parseTableGrid($, table, days, slotStarts.length);
    if (!grid) continue;
    if (kind === "ROOMS") {
      const rawName = tableName($, table);
      if (!rawName) continue;
      const names = rawName.includes(",")
        ? rawName.split(",").map(s => s.trim()).filter(Boolean)
        : [rawName];
      for (const name of names) {
        const key = canonicalRoomName(name);
        if (!key || byKey.has(key)) continue;
        const canonical: (RoomCell | null)[][] = Array.from({ length: dayRowCount }, () =>
          Array.from({ length: slotStarts.length }, () => null),
        );
        for (let col = 0; col < days.length; col++) {
          const dayIdx = days[col];
          if (dayIdx == null || dayIdx < 0 || dayIdx >= dayRowCount) continue;
          const row = grid[col];
          if (!row) continue;
          for (let slot = 0; slot < row.length; slot++) {
            canonical[dayIdx]![slot] = gridCellToRoomCell(row[slot]);
          }
        }
        byKey.set(key, { key, name, occupancy: canonical });
      }
    } else {
      for (let colIdx = 0; colIdx < grid.length; colIdx++) {
        const dayIdx = days[colIdx];
        if (dayIdx == null || dayIdx < 0 || dayIdx > 6) continue;
        const col = grid[colIdx]!;
        for (let slotIdx = 0; slotIdx < col.length; slotIdx++) {
          const cell = col[slotIdx];
          if (!cell?.busy) continue;
          for (const rawRoom of cell.roomNames) {
            const key = canonicalRoomName(rawRoom);
            if (!key) continue;
            const existing = byKey.get(key);
            const rows: (RoomCell | null)[][] = existing
              ? existing.occupancy.map(r => [...r])
              : Array.from({ length: dayRowCount }, () => Array.from({ length: slotStarts.length }, () => null));
            const current = rows[dayIdx]![slotIdx];
            if (current == null || !current.busy) {
              rows[dayIdx]![slotIdx] = gridCellToRoomCell(cell);
              byKey.set(key, { key, name: existing?.name ?? rawRoom, occupancy: rows });
            }
          }
        }
      }
    }
  }
  if (!byKey.size) throw new Error("no room schedules parsed from document");
  return {
    rootId, kind, url, slotStarts,
    rooms: Array.from(byKey.values()),
    generatedAtMillis: generatedAt,
    fetchedAtMillis,
  };
}

async function fetchRootDoc(root: RoomSourceRoot, candidates: RootCandidates, nowMillis: number): Promise<SourceRoomDoc | null> {
  const fetchedAt = Date.now();
  const attempts = [...candidates.roomUrls.slice(0, MAX_CANDIDATES), ...candidates.groupUrls.slice(0, MAX_CANDIDATES)];
  for (const url of attempts) {
    const isGroups = !candidates.roomUrls.includes(url);
    try {
      const html = await fetchText(url);
      const parsed = isGroups
        ? parseDoc(html, root.id, url, fetchedAt, "GROUPS_CELLS")
        : parseDoc(html, root.id, url, fetchedAt, "ROOMS");
      if (!isCurrentSession(parsed.generatedAtMillis, nowMillis)) continue;
      return parsed;
    } catch {
      // next candidate
    }
  }
  return null;
}

function rootPriority(rootId: string): number {
  const idx = ROOT_ORDER.indexOf(rootId);
  return idx >= 0 ? idx : ROOT_ORDER.length;
}

function merge(docs: SourceRoomDoc[], incompleteRoots: string[]): GlobalRoomData {
  const orderedDocs = [...docs].sort((a, b) => rootPriority(a.rootId) - rootPriority(b.rootId));
  const slotUnion = Array.from(new Set(orderedDocs.flatMap(d => d.slotStarts))).sort((a, b) => a - b);
  const slotIndexOf = new Map(slotUnion.map((s, i) => [s, i]));
  type MergedRoomData = { names: { priority: number; name: string }[]; occupancy: (RoomCell | null)[][] };
  const rooms = new Map<string, MergedRoomData>();
  const rootsByKey = new Map<string, Set<string>>();
  for (const doc of orderedDocs) {
    for (const room of doc.rooms) {
      if (!rootsByKey.has(room.key)) rootsByKey.set(room.key, new Set());
      rootsByKey.get(room.key)!.add(doc.rootId);
    }
  }
  const scopedKey = new Map<string, string>();
  for (const [key, roots] of rootsByKey) {
    if (!isRoomLike(key) && !roots.has("appsc") && roots.size >= 2) {
      for (const root of roots) scopedKey.set(`${root}|${key}`, `${root}:${key}`);
    }
  }
  for (const doc of orderedDocs) {
    for (const room of doc.rooms) {
      const key = scopedKey.get(`${doc.rootId}|${room.key}`) ?? room.key;
      let entry = rooms.get(key);
      if (!entry) {
        entry = {
          names: [],
          occupancy: Array.from({ length: 7 }, () => Array.from({ length: slotUnion.length }, () => null)),
        };
        rooms.set(key, entry);
      }
      if (!entry.names.some(n => n.name === room.name)) {
        entry.names.push({ priority: rootPriority(doc.rootId), name: room.name });
      }
      for (let col = 0; col < room.occupancy.length && col <= 6; col++) {
        const cells = room.occupancy[col]!;
        for (let slot = 0; slot < cells.length; slot++) {
          const cell = cells[slot];
          if (cell == null) continue;
          const globalSlot = slotIndexOf.get(doc.slotStarts[slot] ?? -1);
          if (globalSlot == null) continue;
          const current = entry.occupancy[col]![globalSlot];
          if (current?.busy) continue;
          if (cell.busy) entry.occupancy[col]![globalSlot] = cell;
          else if (!current) entry.occupancy[col]![globalSlot] = cell;
        }
      }
    }
  }
  const scopedValues = new Set(scopedKey.values());
  const ROOM_LIKE_RE = /^([A-Z]{1,3})(\d{1,4})([A-Z]{0,2})$/;
  const mergedRooms: MergedRoom[] = Array.from(rooms.entries())
    .filter(([key]) => !isPlaceholder(key))
    .map(([key, data]) => {
      let name: string;
      if (scopedValues.has(key)) {
        const rootId = key.slice(0, key.indexOf(":"));
        const raw = displayName(data.names);
        name = `${raw} · ${rootId === "appsc" ? "College" : rootId.toUpperCase()}`;
      } else {
        name = displayName(data.names);
      }
      return { key, name, occupancy: data.occupancy.map(row => row.map(c => (c ? { ...c } : null))) };
    })
    .sort((a, b) => {
      const ka = a.name.split(" · ")[0]!.trim();
      const kb = b.name.split(" · ")[0]!.trim();
      const ma = ROOM_LIKE_RE.exec(ka);
      const mb = ROOM_LIKE_RE.exec(kb);
      if (ma && mb) {
        const prefix = ma[1]!.localeCompare(mb[1]!);
        if (prefix !== 0) return prefix;
        const num = Number(ma[2]) - Number(mb[2]);
        if (num !== 0) return num;
        return ma[3]!.localeCompare(mb[3]!);
      }
      if (ma) return -1;
      if (mb) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  const sources: RoomSourceSummary[] = orderedDocs.map(doc => ({
    rootId: doc.rootId,
    kind: doc.kind,
    url: doc.url,
    roomCount: doc.rooms.length,
    generatedAtMillis: doc.generatedAtMillis,
    fetchedAtMillis: doc.fetchedAtMillis,
  }));
  return {
    sources,
    incompleteRoots: Array.from(new Set(incompleteRoots)).sort(),
    days: [...VACANT_ROOMS_DAYS],
    slotStarts: slotUnion,
    rooms: mergedRooms,
    fetchedAtMillis: orderedDocs.reduce((max, d) => Math.max(max, d.fetchedAtMillis), 0),
  };
}

async function refresh(force: boolean): Promise<GlobalRoomData> {
  const now = Date.now();
  const previous = await getKnownCache();
  const cached = previous ?? { docs: [] as SourceRoomDoc[], incompleteRoots: [] as string[], fetchedAtMillis: 0 };
  let discovered: Map<string, RootCandidates> | null = null;
  try {
    discovered = await discoverAll();
  } catch {
    discovered = null;
  }
  const reused = new Map<string, SourceRoomDoc>();
  const rootsToFetch: { root: RoomSourceRoot; candidates: RootCandidates }[] = [];
  for (const root of ROOM_SOURCE_ROOTS) {
    const cachedDoc = cached.docs.find(d => d.rootId === root.id) ?? null;
    const candidates = discovered?.get(root.id) ?? null;
    const desiredUrl = candidates?.roomUrls[0] ?? candidates?.groupUrls[0] ?? null;
    const shouldReuse = cachedDoc != null && (candidates == null || (!force && desiredUrl === cachedDoc.url));
    if (shouldReuse && cachedDoc) {
      reused.set(cachedDoc.rootId, cachedDoc);
    } else {
      rootsToFetch.push({ root, candidates: candidates ?? { root, roomUrls: [], groupUrls: [] } });
    }
  }
  const fetchedEntries = await Promise.all(
    rootsToFetch.map(async ({ root, candidates }) => {
      try {
        const doc = await fetchRootDoc(root, candidates, now);
        return [root.id, doc] as const;
      } catch {
        return [root.id, null] as const;
      }
    }),
  );
  const fetched = new Map(fetchedEntries);
  const docs: SourceRoomDoc[] = [];
  const incomplete: string[] = [];
  for (const root of ROOM_SOURCE_ROOTS) {
    const fresh = fetched.get(root.id) ?? null;
    const cachedDoc = cached.docs.find(d => d.rootId === root.id) ?? null;
    const candidates = discovered?.get(root.id) ?? null;
    if (fresh) docs.push(fresh);
    else if (reused.has(root.id)) docs.push(reused.get(root.id)!);
    else if (
      cachedDoc &&
      candidates &&
      (candidates.roomUrls.includes(cachedDoc.url) || candidates.groupUrls.includes(cachedDoc.url))
    ) {
      docs.push(cachedDoc);
    } else {
      incomplete.push(root.id);
    }
  }
  if (!docs.length) {
    // Prefer any last-good durable/memory cache when every live root fails.
    if (cached.docs.length) {
      memoryCache = cached;
      return merge(cached.docs, cached.incompleteRoots);
    }
    throw new Error("No department room timetable could be loaded right now");
  }
  const next: CachedRoomData = { docs, incompleteRoots: incomplete, fetchedAtMillis: now };
  memoryCache = next;
  await persistCache(next);
  return merge(docs, incomplete);
}

export async function getVacantRooms(forceRefresh = false): Promise<GlobalRoomData> {
  const known = await getKnownCache();
  if (!forceRefresh && known?.docs.length) {
    const age = Date.now() - known.fetchedAtMillis;
    // Always prefer instant response from durable/memory cache; refresh in the background
    // so users are not stuck on multi-root HTML downloads and data does not go stale for hours.
    if (age >= SOFT_REFRESH_MS) {
      void refresh(age >= FRESH_WINDOW_MS)
        .catch(error => console.warn("[Vacant rooms] Background refresh failed:", error));
    }
    return merge(known.docs, known.incompleteRoots);
  }
  if (inFlight && !forceRefresh) return inFlight;
  inFlight = refresh(forceRefresh)
    .catch(async error => {
      const fallback = memoryCache ?? (await readPersistentCache());
      if (fallback?.docs.length) {
        memoryCache = fallback;
        return merge(fallback.docs, fallback.incompleteRoots);
      }
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const __test = {
  classifyAnchor,
  slotStartMinutes,
  parseGeneratedAtMillis,
  isCurrentSession,
  parseDoc,
  merge,
  setCache(cache: CachedRoomData | null) {
    memoryCache = cache;
  },
};
