import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createClient } from "@supabase/supabase-js";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { getOfficialSyllabusPdfBuffer } from "./syllabus";
import { createServerFallbackGeminiResponse, getConfiguredGeminiApiKey } from "./syllabusGemini";
import { createAttendanceProxyHandler } from "./attendanceProxy";
import { getAndroidStudentDirectory } from "./androidProfileRecovery";
import { registerFcmToken, runNotificationCheck, sendCustomNotification } from "./notifications";
import { refreshExternalCaches } from "./cacheRefresh";

/**
 * Creates the shared HTTP application for local hosting and serverless adapters.
 * Local development adds Vite afterwards; Vercel imports this finished API handler
 * from the `api/` directory and serves the pre-built client separately.
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/attendance", createAttendanceProxyHandler());
  app.post("/api/notifications/register", async (req, res) => {
    try {
      await registerFcmToken({
        token: typeof req.body?.token === "string" ? req.body.token : "",
        platform: typeof req.body?.platform === "string" ? req.body.platform : undefined,
        appVersion: typeof req.body?.appVersion === "string" ? req.body.appVersion : undefined,
      });
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not register notification token" });
    }
  });
  app.all("/api/notifications/cron", async (req, res) => {
    const expected = process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    if (expected && supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      res.json(await runNotificationCheck());
    } catch (error) {
      console.error("[Notifications] check failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Notification check failed" });
    }
  });

  app.all("/api/cache/cron", async (req, res) => {
    const expected = process.env.CACHE_CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    // Allow Vercel Cron (no secret configured) only when no secret is set; otherwise require match.
    if (expected && supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      const result = await refreshExternalCaches();
      res.status(result.ok ? 200 : 207).json(result);
    } catch (error) {
      console.error("[Cache cron] failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Cache refresh failed" });
    }
  });

  app.post("/api/notifications/send", async (req, res) => {
    const expected = process.env.NOTIFICATION_CRON_SECRET;
    const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") || req.header("x-cron-secret");
    if (!expected || supplied !== expected) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      res.json(await sendCustomNotification(req.body ?? {}));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not send notification" });
    }
  });
  app.get("/api/syllabus.pdf", async (_req, res) => {
    try {
      const syllabus = await getOfficialSyllabusPdfBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", syllabus.bytes.length);
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.setHeader("X-NextLecture-Syllabus-Fetched-At", String(syllabus.fetchedAt));
      res.send(syllabus.bytes);
    } catch (error) {
      console.error("[Syllabus] Official PDF retrieval failed:", error instanceof Error ? error.message : error);
      res.status(502).json({ message: "The official syllabus PDF is unavailable right now. Please try again shortly." });
    }
  });
  app.post("/api/syllabus/stream", async (req, res) => {
    if (!getConfiguredGeminiApiKey()) {
      res.status(503).json({ message: "Syllabus AI server fallback is not configured. Add GEMINI_API_KEY in Vercel environment settings or add a device-local Gemini key in AI settings." });
      return;
    }
    try {
      const upstream = await createServerFallbackGeminiResponse(req.body);
      if (!upstream.ok || !upstream.body) {
        res.status(upstream.status || 502).json({ message: "Gemini could not start the Syllabus AI response. Please try again shortly." });
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (value) res.write(Buffer.from(value));
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } catch (error) {
      console.error("[Syllabus] Gemini fallback failed:", error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(502).json({ message: "Syllabus AI could not complete the response. Check GEMINI_API_KEY or add a device-local key in AI settings." });
      else res.end();
    }
  });
  app.post("/api/lms/youtube-metadata", async (req, res) => {
    try {
      const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const isYouTube = host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
      if (!isYouTube) {
        res.status(400).json({ message: "Please use a valid YouTube URL." });
        return;
      }
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
      if (!response.ok) {
        res.status(400).json({ message: "YouTube could not find that video." });
        return;
      }
      const metadata = await response.json() as { title?: string; author_name?: string };
      if (!metadata.title) {
        res.status(400).json({ message: "That YouTube video does not have a readable title." });
        return;
      }
      res.json({ title: metadata.title, author: metadata.author_name ?? null });
    } catch {
      res.status(400).json({ message: "Please enter a valid YouTube video URL." });
    }
  });
  app.post("/api/lms/dev-login", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        res.status(400).json({ message: "Please provide a valid email address." });
        return;
      }

      // Server-only credentials: the service-role key must never reach the browser.
      const serviceKey = process.env.LMS_SUPABASE_SERVICE_KEY;
      const supabaseUrl = process.env.LMS_SUPABASE_URL || process.env.VITE_LMS_SUPABASE_URL;
      if (!serviceKey || !supabaseUrl) {
        res.status(503).json({
          message: "Dev sign-in is not configured on the server. Add LMS_SUPABASE_SERVICE_KEY to the environment.",
        });
        return;
      }

      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Only roster emails may be provisioned — same gate the client applies.
      const [students, teachers] = await Promise.all([
        admin.from("lms_students").select("email").eq("email", email).maybeSingle(),
        admin.from("lms_teachers").select("email").eq("email", email).maybeSingle(),
      ]);
      const role = students.data ? "student" : teachers.data ? "teacher" : null;
      if (!role) {
        res.status(403).json({ message: "Only first-year students and approved teachers can access this portal." });
        return;
      }

      // Shared password for the temporary no-email dev login. See client/src/lib/lms.ts.
      const devPassword = "nextlecture-dev-2026";

      // email_confirm: true means Supabase never sends a verification email.
      const created = await admin.auth.admin.createUser({
        email,
        password: devPassword,
        email_confirm: true,
      });
      if (created.error) {
        const message = created.error.message ?? "";
        if (!/already (been )?registered|already exists/i.test(message)) {
          console.error("[LMS dev-login] createUser failed:", message);
          res.status(502).json({ message: "Supabase could not prepare your account. Try again shortly." });
          return;
        }

        // The account already exists (e.g. from the old magic-link flow) —
        // locate it and set the dev password + confirmed flag instead.
        let page = 1;
        let userId: string | null = null;
        while (userId === null) {
          const list = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (list.error) {
            console.error("[LMS dev-login] listUsers failed:", list.error.message);
            break;
          }
          const match = list.data?.users?.find((user) => (user.email ?? "").toLowerCase() === email);
          if (match) {
            userId = match.id;
            break;
          }
          const nextPage = list.data?.nextPage ?? null;
          if (nextPage === null) break;
          page = nextPage;
        }
        if (userId === null) {
          res.status(502).json({ message: "Could not find your account in Supabase. Try again shortly." });
          return;
        }
        const updated = await admin.auth.admin.updateUserById(userId, { password: devPassword, email_confirm: true });
        if (updated.error) {
          console.error("[LMS dev-login] updateUserById failed:", updated.error.message);
          res.status(502).json({ message: "Supabase could not update your account. Try again shortly." });
          return;
        }
      }

      res.json({ ok: true, role });
    } catch (error) {
      console.error("[LMS dev-login] failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Dev sign-in failed. Try again shortly." });
    }
  });
  // Official first-year section list (the same public directory the Android app
  // ships with). Only the single requested CRN's record is returned — students
  // use it to see their registration number, subsection, mentor and venue.
  app.get("/api/lms/directory", async (req, res) => {
    try {
      const crn = typeof req.query?.crn === "string" ? req.query.crn.trim() : "";
      if (!crn || !/^[0-9A-Za-z-]{3,20}$/.test(crn)) {
        res.status(400).json({ message: "Please provide a valid CRN." });
        return;
      }
      const records = await getAndroidStudentDirectory();
      const normalize = (value: string | undefined) => (value ?? "").trim().toUpperCase();
      const record = records.find((item) => normalize(item.crn) === crn.toUpperCase()) ?? null;
      if (!record) {
        res.status(404).json({ message: "No official record found for that CRN." });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=21600");
      res.json(record);
    } catch (error) {
      console.error("[LMS directory] lookup failed:", error instanceof Error ? error.message : error);
      res.status(502).json({ message: "The official section list is unavailable right now." });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
