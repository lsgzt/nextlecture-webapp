import type { Request, Response } from "express";

const ALLOWED_ROUTES = new Set(["POST /session", "GET /", "GET /leaderboard", "POST /records", "DELETE /records"]);

type AttendanceProxyOptions = {
  apiBase?: string;
  fetcher?: typeof fetch;
};

export function getAttendanceApiBase() {
  return process.env.ATTENDANCE_API_BASE?.trim().replace(/\/$/, "") || null;
}

export function isAllowedAttendanceRoute(method: string, relativePath: string) {
  return ALLOWED_ROUTES.has(`${method.toUpperCase()} ${relativePath}`);
}

function hasOnlyQueryParameters(url: URL, allowed: string[]) {
  return Array.from(url.searchParams.keys()).every(key => allowed.includes(key));
}

function hasValidAttendanceQuery(method: string, relativePath: string, url: URL) {
  if (method === "GET" && relativePath === "/") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const target = Number(url.searchParams.get("target"));
    return hasOnlyQueryParameters(url, ["from", "to", "target"]) && Boolean(from?.match(/^\d{4}-\d{2}-\d{2}$/)) && Boolean(to?.match(/^\d{4}-\d{2}-\d{2}$/)) && Number.isInteger(target) && target >= 50 && target <= 100;
  }
  if (method === "DELETE" && relativePath === "/records") {
    const date = url.searchParams.get("date");
    const lectureKey = url.searchParams.get("lectureKey");
    return hasOnlyQueryParameters(url, ["date", "lectureKey"]) && Boolean(date?.match(/^\d{4}-\d{2}-\d{2}$/)) && Boolean(lectureKey?.match(/^[a-f0-9]{64}$/));
  }
  if (method === "GET" && relativePath === "/leaderboard") {
    const scope = url.searchParams.get("scope");
    const entries = Array.from(url.searchParams.entries());
    return entries.length === 1 && scope !== null && ["subsection", "section", "branch", "all"].includes(scope);
  }
  return url.search === "";
}

export function createAttendanceProxyHandler(options: AttendanceProxyOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  return async (req: Request, res: Response) => {
    const apiBase = options.apiBase ?? getAttendanceApiBase();
    if (!apiBase) {
      res.status(503).json({ message: "Attendance sync is not configured on this deployment yet. Please try again after the administrator finishes setup." });
      return;
    }
    const url = new URL(req.originalUrl, "http://nextlecture.local");
    const relativePath = url.pathname.replace(/^\/api\/attendance/, "") || "/";
    if (!isAllowedAttendanceRoute(req.method, relativePath)) {
      res.status(404).json({ message: "Attendance route not found." });
      return;
    }
    if (!hasValidAttendanceQuery(req.method, relativePath, url)) {
      res.status(400).json({ message: "Attendance request parameters are invalid." });
      return;
    }
    const headers: Record<string, string> = { Accept: "application/json" };
    if (req.method === "POST") headers["Content-Type"] = "application/json";
    const authorization = req.get("authorization");
    if (authorization?.startsWith("Bearer ")) headers.Authorization = authorization;
    try {
      const upstream = await fetcher(`${apiBase}/api/attendance${relativePath}${url.search}`, {
        method: req.method,
        headers,
        body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
      });
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      const body = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status).setHeader("Content-Type", contentType).setHeader("Cache-Control", "no-store").send(body);
    } catch {
      res.status(503).json({ message: "Attendance could not be synced. Check your connection and try again." });
    }
  };
}
