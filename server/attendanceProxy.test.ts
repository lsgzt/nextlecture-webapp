import { describe, expect, it } from "vitest";
import { createAttendanceProxyHandler, isAllowedAttendanceRoute } from "./attendanceProxy";

describe("attendance proxy route allowlist", () => {
  it("forwards only documented session, history, leaderboard, upsert, and delete operations", () => {
    expect(isAllowedAttendanceRoute("POST", "/session")).toBe(true);
    expect(isAllowedAttendanceRoute("GET", "/")).toBe(true);
    expect(isAllowedAttendanceRoute("GET", "/leaderboard")).toBe(true);
    expect(isAllowedAttendanceRoute("POST", "/records")).toBe(true);
    expect(isAllowedAttendanceRoute("DELETE", "/records")).toBe(true);
    expect(isAllowedAttendanceRoute("GET", "/admin")).toBe(false);
  });

  it("rejects undocumented query parameters before they can reach the upstream API", async () => {
    const handler = createAttendanceProxyHandler({ apiBase: "https://attendance.example", fetcher: async () => new Response("unexpected", { status: 500 }) });
    let statusCode = 200;
    const response = {
      status(code: number) { statusCode = code; return response; },
      json() { return response; },
    };
    await handler({ method: "GET", originalUrl: "/api/attendance?from=2026-08-01&to=2026-08-24&target=75&extra=1", get: () => undefined } as never, response as never);
    expect(statusCode).toBe(400);
  });

  it("forwards only a valid fixed leaderboard scope and rejects free-form values", async () => {
    let forwardedUrl = "";
    const handler = createAttendanceProxyHandler({
      apiBase: "https://attendance.example",
      fetcher: async url => {
        forwardedUrl = String(url);
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      },
    });
    let statusCode = 200;
    const response = {
      status(code: number) { statusCode = code; return response; },
      setHeader() { return response; },
      send() { return response; },
      json() { return response; },
    };
    await handler({ method: "GET", originalUrl: "/api/attendance/leaderboard?scope=branch", get: () => "Bearer opaque-session" } as never, response as never);
    expect(statusCode).toBe(200);
    expect(forwardedUrl).toBe("https://attendance.example/api/attendance/leaderboard?scope=branch");
    await handler({ method: "GET", originalUrl: "/api/attendance/leaderboard?scope=subsection&value=other", get: () => undefined } as never, response as never);
    expect(statusCode).toBe(400);
  });

  it("forwards a documented DELETE and preserves an empty successful response", async () => {
    let forwardedUrl = "";
    const handler = createAttendanceProxyHandler({
      apiBase: "https://attendance.example",
      fetcher: async url => {
        forwardedUrl = String(url);
        return new Response(null, { status: 204 });
      },
    });
    let statusCode = 200;
    let sentLength = -1;
    const response = {
      status(code: number) { statusCode = code; return response; },
      setHeader() { return response; },
      send(body: Buffer) { sentLength = body.length; return response; },
      json() { return response; },
    };
    const lectureKey = "a".repeat(64);
    await handler({ method: "DELETE", originalUrl: `/api/attendance/records?date=2026-08-24&lectureKey=${lectureKey}`, get: () => "Bearer opaque-session" } as never, response as never);
    expect(forwardedUrl).toContain(`/api/attendance/records?date=2026-08-24&lectureKey=${lectureKey}`);
    expect(statusCode).toBe(204);
    expect(sentLength).toBe(0);
  });
});
