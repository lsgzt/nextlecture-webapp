import { createApp } from "../server/app";

/**
 * Vercel’s documented Express entry point. `vercel.json` rewrites API traffic
 * to this single function while retaining the original request path so Express
 * can match `/api/trpc/*`, `/api/oauth/callback`, and `/manus-storage/*`.
 */
const app = createApp();

export default app;
