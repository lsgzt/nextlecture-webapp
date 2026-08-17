# Vercel Profile Deployment Notes

The public deployment at `https://nextlecture.vercel.app` successfully returned the regular timetable-group tRPC response after the top-level PDF parser import was deferred. This confirms that the general serverless API startup path recovered.

The production `temporarySections.prepare` endpoint continued to return its safe `BAD_GATEWAY` fallback. Its response was immediate (about one second in direct testing), indicating an optional runtime dependency or initialization failure rather than the 20–53 second official PDF transfer observed in local cold-cache validation. The web UI remains safe because it exposes manual profile entry when preparation fails.

The first configuration repair established that Vercel requires `functions["api/index.js"].includeFiles` to be a **single string**, not an array. Both the compound-pattern and narrow-package variants subsequently produced invalid function packages because they preserved pnpm symlinks. The implementation therefore removes `includeFiles` entirely and replaces `pdf-parse` with `unpdf`, which ships a serverless PDF.js build for text extraction and does not require the native canvas runtime for this feature. The generated API bundle retains Vercel's regular static package tracing, while the function duration remains 60 seconds. Source: <https://github.com/unjs/unpdf>, <https://unjs.io/packages/unpdf>, <https://vercel.com/docs/functions/configuring-functions/duration>, and <https://vercel.com/docs/project-configuration/vercel-json>.

## Resolution verification

The production deployment for commit `8ffb46d` reached `READY` as deployment `dpl_3UzyJQaJz4UoPLoRQkWtjnhEgKE8`. Direct production verification then confirmed both required public API paths:

| Endpoint | Verified outcome |
| --- | --- |
| `temporarySections.prepare` for `IT` | Returned the official IT document URL and `studentCount: 188`, with a fresh cache result. |
| `timetable.groups` | Returned the current official group list, including `ITB2` and all supported timetable groups. |
