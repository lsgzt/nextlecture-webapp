import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { timetableCache } from "../drizzle/schema";
import { TEMPORARY_SECTION_BRANCHES, type TemporarySectionBranch } from "../shared/student-profile";
import { getDb } from "./db";

export type MarkAttendanceAttendee = {
  studentName: string;
  crn: string;
  markedAt: number;
};

export type MarkAttendanceSession = {
  id: string;
  subjectName: string;
  branch: TemporarySectionBranch;
  createdAt: number;
  attendees: MarkAttendanceAttendee[];
};

const CACHE_PREFIX = "mark-attendance-session-v1";
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const inMemorySessions = new Map<string, MarkAttendanceSession>();

function cacheKey(sessionId: string) {
  return `${CACHE_PREFIX}:${sessionId}`;
}

function isBranch(value: string): value is TemporarySectionBranch {
  return TEMPORARY_SECTION_BRANCHES.includes(value as TemporarySectionBranch);
}

function isValidSession(value: unknown): value is MarkAttendanceSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<MarkAttendanceSession>;
  return Boolean(
    typeof session.id === "string" &&
      typeof session.subjectName === "string" &&
      isBranch(session.branch ?? "") &&
      typeof session.createdAt === "number" &&
      Array.isArray(session.attendees),
  );
}

function isExpired(session: MarkAttendanceSession) {
  return Date.now() - session.createdAt > SESSION_TTL_MS;
}

async function readPersistentSession(sessionId: string): Promise<MarkAttendanceSession | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ payload: timetableCache.payload })
      .from(timetableCache)
      .where(eq(timetableCache.id, cacheKey(sessionId)))
      .limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidSession(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[Mark attendance] Persistent session could not be read:", error);
    return null;
  }
}

async function persistSession(session: MarkAttendanceSession) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(timetableCache)
      .values({
        id: cacheKey(session.id),
        sourceUrl: `mark-attendance://${session.id}`,
        payload: JSON.stringify(session),
        fetchedAt: new Date(session.createdAt),
      })
      .onDuplicateKeyUpdate({
        set: {
          sourceUrl: `mark-attendance://${session.id}`,
          payload: JSON.stringify(session),
          fetchedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[Mark attendance] Persistent session could not be saved:", error);
  }
}

async function getSession(sessionId: string): Promise<MarkAttendanceSession | null> {
  const fromMemory = inMemorySessions.get(sessionId);
  if (fromMemory) {
    if (isExpired(fromMemory)) {
      inMemorySessions.delete(sessionId);
      return null;
    }
    return fromMemory;
  }
  const fromDb = await readPersistentSession(sessionId);
  if (!fromDb || isExpired(fromDb)) return null;
  inMemorySessions.set(sessionId, fromDb);
  return fromDb;
}

export async function createMarkAttendanceSession(subjectName: string, branchInput: string) {
  const subject = subjectName.replace(/\s+/g, " ").trim();
  if (subject.length < 2) throw new Error("Subject name must be at least 2 characters.");
  const branch = branchInput.trim().toUpperCase();
  if (!isBranch(branch)) throw new Error(`Unsupported branch: ${branchInput}`);

  const session: MarkAttendanceSession = {
    id: nanoid(12),
    subjectName: subject,
    branch,
    createdAt: Date.now(),
    attendees: [],
  };
  inMemorySessions.set(session.id, session);
  await persistSession(session);
  return session;
}

export async function getMarkAttendanceSession(sessionId: string) {
  const session = await getSession(sessionId.trim());
  if (!session) throw new Error("This attendance link is invalid or has expired.");
  return {
    id: session.id,
    subjectName: session.subjectName,
    branch: session.branch,
    createdAt: session.createdAt,
    attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
    presentCount: session.attendees.length,
  };
}

export async function markAttendancePresent(sessionId: string, studentName: string, crn: string) {
  const session = await getSession(sessionId.trim());
  if (!session) throw new Error("This attendance link is invalid or has expired.");

  const name = studentName.replace(/\s+/g, " ").trim();
  const roll = crn.trim();
  if (name.length < 2) throw new Error("Student name is required.");
  if (!/^\d{6,16}$/.test(roll)) throw new Error("CRN must be 6–16 digits.");

  const existingIndex = session.attendees.findIndex(a => a.crn === roll);
  if (existingIndex >= 0) {
    return {
      id: session.id,
      subjectName: session.subjectName,
      branch: session.branch,
      createdAt: session.createdAt,
      attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
      presentCount: session.attendees.length,
      alreadyMarked: true as const,
    };
  }

  session.attendees.push({
    studentName: name,
    crn: roll,
    markedAt: Date.now(),
  });
  inMemorySessions.set(session.id, session);
  await persistSession(session);

  return {
    id: session.id,
    subjectName: session.subjectName,
    branch: session.branch,
    createdAt: session.createdAt,
    attendees: [...session.attendees].sort((a, b) => a.studentName.localeCompare(b.studentName)),
    presentCount: session.attendees.length,
    alreadyMarked: false as const,
  };
}
