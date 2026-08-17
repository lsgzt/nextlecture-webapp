# Vercel Profile Deployment Notes

The public deployment at `https://nextlecture.vercel.app` successfully returned the regular timetable-group tRPC response after the top-level PDF parser import was deferred. This confirms that the general serverless API startup path recovered.

The production `temporarySections.prepare` endpoint continued to return its safe `BAD_GATEWAY` fallback. Its response was immediate (about one second in direct testing), indicating an optional runtime dependency or initialization failure rather than the 20–53 second official PDF transfer observed in local cold-cache validation. The web UI remains safe because it exposes manual profile entry when preparation fails.

The first configuration repair established that Vercel requires `functions["api/index.js"].includeFiles` to be a **single string**, not an array. A compound brace-expansion pattern was then rejected by the Vercel build with `ENOENT`; the next repair uses the exact workspace-exposed `node_modules/pdf-parse/**` path. `pdf-parse` keeps its direct `pdfjs-dist` and `@napi-rs/canvas` dependency links beside its package directory under pnpm, allowing its dependency graph to resolve from the included package path while retaining the 60-second function duration. Source: <https://vercel.com/docs/functions/configuring-functions/duration> and <https://vercel.com/docs/project-configuration/vercel-json>.
