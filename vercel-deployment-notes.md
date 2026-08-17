# Vercel Deployment Diagnosis

The initial production deployment served `dist/index.js` directly at the site root with `content-type: application/javascript`, because the build output contained both the Vite static client under `dist/public` and the bundled Express server at `dist/index.js`. The root route therefore resolved to the server bundle rather than the web application.

The first deployment fix introduced a Vercel-specific static build target (`vite build`), configured `dist/public` as the output directory, and separated the shared Express app from local startup via `server/app.ts`. The subsequent Vercel deployment served `text/html` at the root as intended.

The project had Vercel SSO protection enabled for non-custom domains. That protection was disabled with user approval so public `vercel.app` visitors can reach the application.

The SPA rewrite originally captured `/api` paths. It was changed to the documented negative-lookahead pattern `/((?!api/).*)`. Vercel then produced a Node function, but the current API path returned 404. The newest build log shows Vercel's function TypeScript build reporting Express-related type errors in imported server files, including `Response.clearCookie`, `Express.get`, and request/response helper properties. The next fix must make the serverless handler compile cleanly for Vercel's function builder, rather than relying solely on the local TypeScript build.

References:

- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/rewrites
