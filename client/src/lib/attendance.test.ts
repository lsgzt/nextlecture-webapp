import { describe, expect, it, vi } from "vitest";
import { ATTENDANCE_INSTALLATION_KEY, ATTENDANCE_PROFILE_SCOPE_KEY, ATTENDANCE_SESSION_KEY, calculateAttendanceSummary, clampAttendanceTarget, createAttendanceClient, createLectureKey, createProfileFingerprint, getAttendanceProfileScope, readAttendanceTarget, saveAttendanceTarget } from "./attendance";

const profile = { studentName: "Student", crn: "2621101", registrationNumber: "202600011", fatherName: null, motherName: null, branch: "IT", section: "ITB", subsection: "ITB2", mentoringGroup: "ITBM2", mentorName: null, mentorMobileNumber: null, venue: null, source: "official" as const, sourceUrl: null, savedAt: 1 };

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("attendance identity and local target", () => {
  it("creates the Android-compatible fingerprint from registration number, CRN, branch, saved subsection, and name without mentoring group", async () => {
    const fingerprint = await createProfileFingerprint(profile);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).toBe(await createProfileFingerprint({ ...profile, mentoringGroup: "Changed" }));
    expect(fingerprint).not.toBe(await createProfileFingerprint({ ...profile, subsection: "ITB1" }));
    expect(fingerprint).not.toBe(await createProfileFingerprint({ ...profile, registrationNumber: "202600012" }));
  });

  it("uses CRN rather than registration number as the web profile-linking scope", () => {
    expect(getAttendanceProfileScope(profile)).toBe(getAttendanceProfileScope({ ...profile, registrationNumber: "different-directory-value" }));
    expect(getAttendanceProfileScope(profile)).not.toBe(getAttendanceProfileScope({ ...profile, crn: "2621199" }));
  });

  it("uses the Android-compatible date and timetable fields for lecture keys", async () => {
    const lecture = { startTime: "10:00", endTime: "11:00", subject: "Math", teacher: "Teacher", venue: "F112" };
    expect(await createLectureKey("2026-08-24", "ITB2", lecture)).toMatch(/^[a-f0-9]{64}$/);
    expect(await createLectureKey("2026-08-24", "ITB2", lecture)).not.toBe(await createLectureKey("2026-08-25", "ITB2", lecture));
  });

  it("defaults target to 75 only when absent and persists clamped choices", () => {
    const storage = memoryStorage();
    expect(readAttendanceTarget(storage)).toBe(75);
    expect(saveAttendanceTarget(storage, 102)).toBe(100);
    expect(readAttendanceTarget(storage)).toBe(100);
    expect(clampAttendanceTarget(20)).toBe(50);
  });

  it("calculates recovery guidance locally without another network read", () => {
    const summary = calculateAttendanceSummary([
      { attendance_date: "2026-08-20", lecture_key: "1", status: "present", subject: "", teacher: "", venue: "", start_minutes: 0, end_minutes: 0, created_at: "", updated_at: "" },
      { attendance_date: "2026-08-21", lecture_key: "2", status: "present", subject: "", teacher: "", venue: "", start_minutes: 0, end_minutes: 0, created_at: "", updated_at: "" },
      { attendance_date: "2026-08-22", lecture_key: "3", status: "absent", subject: "", teacher: "", venue: "", start_minutes: 0, end_minutes: 0, created_at: "", updated_at: "" },
    ], 75);
    expect(summary).toMatchObject({ present: 2, absent: 1, markedTotal: 3, percentage: 66.7, affordableMisses: 0, lecturesToAttend: 1 });
  });
});

describe("attendance API client", () => {
  it("stores an opaque session, writes a mark, and recreates the session once after a 401", async () => {
    const storage = memoryStorage({ "nextlecture:attendance:installation:v1": "installation-for-tests" });
    const responses = [
      new Response(JSON.stringify({ studentId: "owner-a", accessToken: "opaque-a", issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 }),
      new Response(JSON.stringify({ error: "expired" }), { status: 401 }),
      new Response(JSON.stringify({ studentId: "owner-a", accessToken: "opaque-b", issuedAt: "2026-08-24T00:01:00Z" }), { status: 200 }),
      new Response(JSON.stringify({ record: { attendance_date: "2026-08-24", lecture_key: "key", status: "present" } }), { status: 200 }),
    ];
    const fetcher = vi.fn(async () => responses.shift()!);
    const client = createAttendanceClient({ storage, fetcher });
    await client.saveRecord(profile, { attendanceDate: "2026-08-24", lectureKey: "key", status: "present", subject: "Math", teacher: "", venue: "", startMinutes: 600, endMinutes: 650 });
    expect(storage.getItem(ATTENDANCE_SESSION_KEY)).toContain("opaque-b");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("does not reuse a stored token when the profile fingerprint changes", async () => {
    const storage = memoryStorage({ "nextlecture:attendance:installation:v1": "installation-for-tests" });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ studentId: "owner-b", accessToken: "opaque-b", issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 }));
    const client = createAttendanceClient({ storage, fetcher });
    await client.getHistory({ ...profile, studentName: "Different Student" }, "2026-08-01", "2026-08-24", 75).catch(() => undefined);
    expect(fetcher.mock.calls[0][0]).toBe("/api/attendance/session");
  });

  it("sends two installations with the same profile fingerprint to the same recovered attendance owner", async () => {
    const sessionBodies: Array<{ installationId: string; profileFingerprint: string }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/attendance/session") {
        sessionBodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ studentId: "shared-owner", accessToken: `opaque-${sessionBodies.length}`, issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 });
      }
      return new Response(JSON.stringify({ from: "2026-08-01", to: "2026-08-24", records: [{ attendance_date: "2026-08-20", lecture_key: "shared-record", status: "present" }] }), { status: 200 });
    });
    const first = createAttendanceClient({ storage: memoryStorage({ "nextlecture:attendance:installation:v1": "installation-one" }), fetcher });
    const second = createAttendanceClient({ storage: memoryStorage({ "nextlecture:attendance:installation:v1": "installation-two" }), fetcher });
    const [firstHistory, secondHistory] = await Promise.all([first.getHistory(profile, "2026-08-01", "2026-08-24", 75), second.getHistory(profile, "2026-08-01", "2026-08-24", 75)]);
    expect(sessionBodies).toHaveLength(2);
    expect(sessionBodies[0].installationId).not.toBe(sessionBodies[1].installationId);
    expect(sessionBodies[0].profileFingerprint).toBe(sessionBodies[1].profileFingerprint);
    expect(firstHistory.records[0].lecture_key).toBe(secondHistory.records[0].lecture_key);
  });

  it("supports present, idempotent absent update, empty delete response, and a post-clear read", async () => {
    const storage = memoryStorage({ "nextlecture:attendance:installation:v1": "installation-for-tests" });
    const responses = [
      new Response(JSON.stringify({ studentId: "owner-a", accessToken: "opaque-a", issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 }),
      new Response(JSON.stringify({ record: { attendance_date: "2026-08-24", lecture_key: "key", status: "present" } }), { status: 200 }),
      new Response(JSON.stringify({ record: { attendance_date: "2026-08-24", lecture_key: "key", status: "absent" } }), { status: 200 }),
      new Response(null, { status: 204 }),
      new Response(JSON.stringify({ from: "2026-08-01", to: "2026-08-24", records: [] }), { status: 200 }),
    ];
    const fetcher = vi.fn(async () => responses.shift()!);
    const client = createAttendanceClient({ storage, fetcher });
    const record = { attendanceDate: "2026-08-24", lectureKey: "key", status: "present" as const, subject: "Math", teacher: "", venue: "", startMinutes: 600, endMinutes: 650 };
    await client.saveRecord(profile, record);
    await client.saveRecord(profile, { ...record, status: "absent" });
    await expect(client.clearRecord(profile, record.attendanceDate, record.lectureKey)).resolves.toBeUndefined();
    await expect(client.getHistory(profile, "2026-08-01", "2026-08-24", 75)).resolves.toMatchObject({ records: [] });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("normalizes Android record envelopes and rotates a previously mismatched local installation identity", async () => {
    const storage = memoryStorage({
      "nextlecture:attendance:installation:v1": "installation-for-tests",
      [ATTENDANCE_SESSION_KEY]: JSON.stringify({ studentId: "old-owner", accessToken: "old-token", issuedAt: "2026-08-24T00:00:00Z", profileFingerprint: "old-fingerprint" }),
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      studentId: "android-owner",
      accessToken: "fresh-token",
      issuedAt: "2026-08-24T00:00:00Z",
    }), { status: 200 }));
    const client = createAttendanceClient({ storage, fetcher });

    client.resetStoredIdentity();
    expect(storage.getItem("nextlecture:attendance:installation:v1")).toBeNull();
    expect(storage.getItem(ATTENDANCE_SESSION_KEY)).toBeNull();

    const recordClient = createAttendanceClient({ storage: memoryStorage({ "nextlecture:attendance:installation:v1": "fresh-installation-for-tests" }), fetcher: vi.fn(async (url: string) => {
      if (url === "/api/attendance/session") return new Response(JSON.stringify({ studentId: "android-owner", accessToken: "fresh-token", issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 });
      return new Response(JSON.stringify({ record: { attendance_date: "2026-08-24", lecture_key: "key", status: "present" } }), { status: 200 });
    }) });
    await expect(recordClient.saveRecord(profile, { attendanceDate: "2026-08-24", lectureKey: "key", status: "present", subject: "Math", teacher: "", venue: "", startMinutes: 600, endMinutes: 650 })).resolves.toMatchObject({ lecture_key: "key", status: "present" });
  });

  it("rotates the browser installation and never reuses records when switching between two saved profiles", async () => {
    const storage = memoryStorage();
    const friend = { ...profile, studentName: "Friend", crn: "2621102", registrationNumber: "202600012", subsection: "ITB1" };
    const sessionBodies: Array<{ installationId: string; profileFingerprint: string }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/attendance/session") {
        const body = JSON.parse(String(init?.body));
        sessionBodies.push(body);
        return new Response(JSON.stringify({ studentId: body.profileFingerprint.endsWith("a") ? "owner-a" : `owner-${sessionBodies.length}`, accessToken: `token-${sessionBodies.length}`, issuedAt: "2026-08-24T00:00:00Z" }), { status: 200 });
      }
      const authorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
      return new Response(JSON.stringify({ from: "2026-08-01", to: "2026-08-24", records: [{ attendance_date: "2026-08-20", lecture_key: authorization.includes("token-2") ? "friend-record" : "student-record", status: "present" }] }), { status: 200 });
    });
    const client = createAttendanceClient({ storage, fetcher });
    const first = await client.getHistory(profile, "2026-08-01", "2026-08-24", 75);
    const second = await client.getHistory(friend, "2026-08-01", "2026-08-24", 75);
    const third = await client.getHistory(profile, "2026-08-01", "2026-08-24", 75);

    expect(first.records[0].lecture_key).toBe("student-record");
    expect(second.records[0].lecture_key).toBe("friend-record");
    expect(third.records[0].lecture_key).toBe("student-record");
    expect(sessionBodies).toHaveLength(3);
    expect(new Set(sessionBodies.map(body => body.installationId)).size).toBe(3);
    expect(storage.getItem(ATTENDANCE_PROFILE_SCOPE_KEY)).toContain(profile.crn);
    expect(storage.getItem(ATTENDANCE_INSTALLATION_KEY)).toBeTruthy();
  });
});
