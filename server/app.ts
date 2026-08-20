import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { getOfficialSyllabusPdfBuffer } from "./syllabus";

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
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}
