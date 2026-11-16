import type { Request, Response } from "express";
import { getMarkAttendanceSession } from "./markAttendance";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(req: Request, path: string): string {
  const host = req.get("x-forwarded-host") || req.get("host") || "nextlecture.vercel.app";
  const proto = (req.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return `${proto}://${host}${path}`;
}

function buildPreviewMeta(opts: {
  pageUrl: string;
  imageUrl: string;
  title: string;
  description: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const pageUrl = escapeHtml(opts.pageUrl);
  const imageUrl = escapeHtml(opts.imageUrl);
  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:site_name" content="NextLecture" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1500" />
    <meta property="og:image:height" content="844" />
    <meta property="og:image:alt" content="${title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
  `;
}

/**
 * Always serve the real SPA for /mark-attendance (no secondary crawler page).
 * Inject session-specific Open Graph tags into index.html so WhatsApp / social
 * previews still show the subject and the dedicated mark-attendance image.
 */
export async function handleMarkAttendancePage(req: Request, res: Response) {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
  const session = sessionId ? await getMarkAttendanceSession(sessionId) : null;

  const subject = session?.subjectName?.trim() || "Mark your attendance";
  const branch = session?.branch ? ` · ${session.branch}` : "";
  const count = session?.presentCount ?? 0;
  const title = session ? `Mark present — ${subject}` : "Mark your attendance · NextLecture";
  const description = session
    ? count > 0
      ? `${count} student${count === 1 ? "" : "s"} marked present so far. Search your official name and mark present${branch}.`
      : `Search your official name and mark present for ${subject}${branch}. Shared via NextLecture.`
    : "Create a shareable present list for your class. Students search their official name and mark present — no app install needed.";

  const pagePath = sessionId ? `/mark-attendance/${encodeURIComponent(sessionId)}` : "/mark-attendance";
  const pageUrl = absoluteUrl(req, pagePath);
  const imageUrl = absoluteUrl(req, "/og-mark-attendance.png");

  const host = req.get("x-forwarded-host") || req.get("host") || "nextlecture.vercel.app";
  const proto = (req.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const indexResponse = await fetch(`${proto}://${host}/index.html`);
  if (!indexResponse.ok) {
    throw new Error(`Could not load SPA shell (${indexResponse.status})`);
  }
  let html = await indexResponse.text();

  const metaBlock = buildPreviewMeta({ pageUrl, imageUrl, title, description });

  // Strip the generic site-wide OG / Twitter tags from index.html, then inject
  // the session-specific set so previews match this mark-attendance link.
  html = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, match => `${match}\n${metaBlock}`);
  } else {
    html = metaBlock + html;
  }

  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "no-store")
    .send(html);
}

/**
 * Subject-aware SVG card (optional). Raster fallback lives at /og-mark-attendance.png.
 */
export function handleMarkAttendanceOgImage(req: Request, res: Response) {
  const subjectRaw = typeof req.query.subject === "string" ? req.query.subject : "Mark your attendance";
  const subject = subjectRaw.replace(/\s+/g, " ").trim().slice(0, 80) || "Mark your attendance";
  const branch = typeof req.query.branch === "string" ? req.query.branch.trim().slice(0, 12) : "";
  const count = Math.max(0, Number.parseInt(String(req.query.count ?? "0"), 10) || 0);

  const safe = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const subtitle =
    count > 0
      ? `${count} marked present${branch ? ` · ${branch}` : ""}`
      : branch
        ? `${branch} · Mark present`
        : "Search your name and mark present";

  const words = subject.split(" ");
  let line1 = subject;
  let line2 = "";
  if (subject.length > 28 && words.length > 1) {
    line1 = "";
    for (const word of words) {
      const trial = line1 ? `${line1} ${word}` : word;
      if (trial.length <= 28) line1 = trial;
      else {
        line2 = words.slice(words.indexOf(word)).join(" ");
        break;
      }
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="844" viewBox="0 0 1500 844">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="55%" stop-color="#115e59"/>
      <stop offset="100%" stop-color="#0c1917"/>
    </linearGradient>
  </defs>
  <rect width="1500" height="844" fill="url(#bg)"/>
  <circle cx="1280" cy="220" r="200" fill="#5eead4" fill-opacity="0.12"/>
  <circle cx="120" cy="720" r="160" fill="#2dd4bf" fill-opacity="0.10"/>
  <rect x="72" y="72" width="260" height="56" rx="16" fill="#0d9488"/>
  <text x="96" y="110" font-family="Manrope, system-ui, sans-serif" font-size="26" font-weight="700" fill="#f0fdfa" letter-spacing="0.08em">NEXTLECTURE</text>
  <text x="72" y="230" font-family="Georgia, 'Playfair Display', serif" font-size="42" font-weight="700" fill="#99f6e4">Mark your attendance</text>
  <text x="72" y="330" font-family="Georgia, 'Playfair Display', serif" font-size="64" font-weight="700" fill="#ffffff">${safe(line1)}</text>
  ${line2 ? `<text x="72" y="410" font-family="Georgia, 'Playfair Display', serif" font-size="64" font-weight="700" fill="#ccfbf1">${safe(line2.slice(0, 40))}</text>` : ""}
  <text x="72" y="${line2 ? 490 : 420}" font-family="Manrope, system-ui, sans-serif" font-size="32" font-weight="600" fill="#a7f3d0">${safe(subtitle)}</text>
  <circle cx="1280" cy="300" r="88" fill="#0d9488"/>
  <circle cx="1280" cy="300" r="72" fill="none" stroke="#ccfbf1" stroke-width="6"/>
  <path d="M1248 304 L1268 324 L1318 268" fill="none" stroke="#f0fdfa" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="0" y="720" width="1500" height="124" fill="#081c1a"/>
  <text x="72" y="790" font-family="Manrope, system-ui, sans-serif" font-size="28" font-weight="600" fill="#5eead4">nextlecture.vercel.app/mark-attendance</text>
  <text x="1100" y="790" font-family="Manrope, system-ui, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">GNDEC · Present list</text>
</svg>`;

  res
    .status(200)
    .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=300, s-maxage=600")
    .send(svg);
}
