import { createApp } from "../server/app";

/**
 * Vercel catch-all API function. It preserves routes such as `/api/trpc/*`
 * while Vercel serves the compiled Vite application from `dist/public`.
 */
const app = createApp();

export default app;
