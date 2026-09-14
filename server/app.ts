import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { getOfficialSyllabusPdfBuffer } from "./syllabus";
import { createServerFallbackGeminiResponse, getConfiguredGeminiApiKey } from "./syllabusGemini";
import { createAttendanceProxyHandler } from "./attendanceProxy";
import { registerFcmToken, runNotificationCheck, sendCustomNotification } from "./notifications";

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
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
