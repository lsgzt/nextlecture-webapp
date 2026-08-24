import type { Lecture } from "@shared/timetable";
import type { StudentProfile } from "@shared/student-profile";
import type { AttendanceHistory, AttendanceRecord, AttendanceRecordInput, AttendanceSession, AttendanceStatus, AttendanceSummary } from "@shared/attendance";

export const ATTENDANCE_INSTALLATION_KEY = "nextlecture:attendance:installation:v1";
export const ATTENDANCE_SESSION_KEY = "nextlecture:attendance:session:v1";
export const ATTENDANCE_TARGET_KEY = "nextlecture:attendance:target:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type FetchLike = typeof fetch;

type StoredAttendanceSession = AttendanceSession & { profileFingerprint: string };

export class AttendanceApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AttendanceApiError";
  }
}

function normalize(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256LowercaseHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/** Uses an empty registration-number component because the current web profile only stores CRN. */
export async function createProfileFingerprint(profile: StudentProfile) {
  return sha256LowercaseHex(["", normalize(profile.crn), normalize(profile.branch), normalize(profile.subsection), normalize(profile.studentName)].join("|"));
}

export function getInstallationId(storage: StorageLike) {
  const existing = storage.getItem(ATTENDANCE_INSTALLATION_KEY);
  if (existing && existing.length >= 16) return existing;
  const created = crypto.randomUUID();
  storage.setItem(ATTENDANCE_INSTALLATION_KEY, created);
  return created;
}

export function clampAttendanceTarget(value: number) {
  if (!Number.isFinite(value)) return 75;
  return Math.min(100, Math.max(50, Math.round(value)));
}

export function readAttendanceTarget(storage: StorageLike) {
  const raw = storage.getItem(ATTENDANCE_TARGET_KEY);
  return raw === null ? 75 : clampAttendanceTarget(Number(raw));
}

export function saveAttendanceTarget(storage: StorageLike, target: number) {
  const clamped = clampAttendanceTarget(target);
  storage.setItem(ATTENDANCE_TARGET_KEY, String(clamped));
  return clamped;
}

export function formatLocalAttendanceDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function createLectureKey(attendanceDate: string, groupName: string, lecture: Pick<Lecture, "startTime" | "endTime" | "subject" | "teacher" | "venue">) {
  return sha256LowercaseHex([
    attendanceDate,
    normalize(groupName),
    timeToMinutes(lecture.startTime),
    timeToMinutes(lecture.endTime),
    normalize(lecture.subject),
    normalize(lecture.teacher),
    normalize(lecture.venue),
  ].join("|"));
}

export async function createAttendanceRecordInput(attendanceDate: string, groupName: string, lecture: Pick<Lecture, "startTime" | "endTime" | "subject" | "teacher" | "venue">, status: AttendanceStatus): Promise<AttendanceRecordInput> {
  return {
    attendanceDate,
    lectureKey: await createLectureKey(attendanceDate, groupName, lecture),
    status,
    subject: normalize(lecture.subject),
    teacher: normalize(lecture.teacher),
    venue: normalize(lecture.venue),
    startMinutes: timeToMinutes(lecture.startTime),
    endMinutes: timeToMinutes(lecture.endTime),
  };
}

export function calculateAttendanceSummary(records: AttendanceRecord[], target: number): AttendanceSummary {
  const normalizedTarget = clampAttendanceTarget(target);
  const present = records.filter(record => record.status === "present").length;
  const absent = records.filter(record => record.status === "absent").length;
  const markedTotal = present + absent;
  const percentage = markedTotal ? Math.round((present / markedTotal) * 1000) / 10 : null;
  const targetRatio = normalizedTarget / 100;
  const affordableMisses = targetRatio === 1 ? 0 : Math.max(0, Math.floor(present / targetRatio - markedTotal));
  const lecturesToAttend = markedTotal === 0 || percentage === null || percentage >= normalizedTarget || targetRatio === 1
    ? null
    : Math.max(0, Math.ceil((targetRatio * markedTotal - present) / (1 - targetRatio)));
  return { present, absent, markedTotal, percentage, target: normalizedTarget, affordableMisses, lecturesToAttend };
}

function readStoredSession(storage: StorageLike, profileFingerprint: string) {
  try {
    const raw = storage.getItem(ATTENDANCE_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<StoredAttendanceSession> : null;
    if (!parsed || parsed.profileFingerprint !== profileFingerprint || typeof parsed.accessToken !== "string" || typeof parsed.studentId !== "string" || typeof parsed.issuedAt !== "string") return null;
    return parsed as StoredAttendanceSession;
  } catch {
    return null;
  }
}

async function responseMessage(response: Response) {
  try {
    const body = await response.clone().json() as { message?: string; error?: string };
    return body.message || body.error || `Attendance sync failed (${response.status}).`;
  } catch {
    return `Attendance sync failed (${response.status}).`;
  }
}

export function createAttendanceClient({ storage, fetcher = fetch }: { storage: StorageLike; fetcher?: FetchLike }) {
  async function createSession(profile: StudentProfile, profileFingerprint: string) {
    const response = await fetcher("/api/attendance/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: getInstallationId(storage),
        profileFingerprint,
        branch: normalize(profile.branch),
        subsection: normalize(profile.subsection),
        timetableGroup: normalize(profile.subsection),
      }),
    });
    if (!response.ok) throw new AttendanceApiError(response.status, await responseMessage(response));
    const session = await response.json() as AttendanceSession;
    if (!session.accessToken || !session.studentId || !session.issuedAt) throw new AttendanceApiError(502, "Attendance session could not be created. Please try again.");
    storage.setItem(ATTENDANCE_SESSION_KEY, JSON.stringify({ ...session, profileFingerprint } satisfies StoredAttendanceSession));
    return session;
  }

  async function withSession<T>(profile: StudentProfile, operation: (token: string) => Promise<T>) {
    const profileFingerprint = await createProfileFingerprint(profile);
    let session = readStoredSession(storage, profileFingerprint) ?? await createSession(profile, profileFingerprint);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await operation(session.accessToken);
      } catch (error) {
        if (!(error instanceof AttendanceApiError) || error.status !== 401 || attempt === 1) throw error;
        storage.removeItem(ATTENDANCE_SESSION_KEY);
        session = await createSession(profile, profileFingerprint);
      }
    }
    throw new AttendanceApiError(401, "Attendance session expired. Please try again.");
  }

  async function authenticatedRequest<T>(profile: StudentProfile, path: string, init: RequestInit) {
    return withSession(profile, async accessToken => {
      let response: Response;
      try {
        response = await fetcher(`/api/attendance${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
      } catch {
        throw new AttendanceApiError(503, "Attendance could not be synced. Check your connection and try again.");
      }
      if (!response.ok) throw new AttendanceApiError(response.status, await responseMessage(response));
      if (response.status === 204) return undefined as T;
      const body = await response.text();
      return (body ? JSON.parse(body) : undefined) as T;
    });
  }

  return {
    async getHistory(profile: StudentProfile, from: string, to: string, target: number) {
      return authenticatedRequest<AttendanceHistory>(profile, `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&target=${clampAttendanceTarget(target)}`, { method: "GET" });
    },
    async saveRecord(profile: StudentProfile, record: AttendanceRecordInput) {
      return authenticatedRequest<AttendanceRecord>(profile, "/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
    },
    async clearRecord(profile: StudentProfile, attendanceDate: string, lectureKey: string) {
      return authenticatedRequest<{ ok?: boolean }>(profile, `/records?date=${encodeURIComponent(attendanceDate)}&lectureKey=${encodeURIComponent(lectureKey)}`, { method: "DELETE" });
    },
    clearStoredSession() { storage.removeItem(ATTENDANCE_SESSION_KEY); },
  };
}
