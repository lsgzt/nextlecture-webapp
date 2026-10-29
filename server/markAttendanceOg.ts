import type { Request, Response } from "express";
import { getMarkAttendanceSession } from "./markAttendance";

const BOT_UA =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|pinterest|googlebot|bingbot|yandex|duckduckbot|baiduspider|embedly|quora link preview|showyoubot|outbrain|vkshare|w3c_validator|redditbot|applebot|skypeuripreview/i;

export function isSocialPreviewBot(userAgent: string | undefined): boolean {
  return Boolean(userAgent && BOT_UA.test(userAgent));
}

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

/** HTML shell for WhatsApp / Facebook / X link previews on mark-attendance links. */
export function renderMarkAttendanceOgHtml(opts: {
  pageUrl: string;
  imageUrl: string;
  title: string;
  description: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const pageUrl = escapeHtml(opts.pageUrl);
  const imageUrl = escapeHtml(opts.imageUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
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
</head>
<body>
  <p>${title}</p>
  <p>${description}</p>
  <p><a href="${pageUrl}">Open in NextLecture</a></p>
</body>
</html>`;
}

export async function handleMarkAttendancePreview(req: Request, res: Response) {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim() : "";
  const session = sessionId ? await getMarkAttendanceSession(sessionId) : null;

  const subject = session?.subjectName?.trim() || "Mark your attendance";
  const branch = session?.branch ? ` · ${session.branch}` : "";
  const count = session?.presentCount ?? 0;
  const title = session
    ? `Mark present — ${subject}`
    : "Mark your attendance · NextLecture";
  const description = session
    ? count > 0
      ? `${count} student${count === 1 ? "" : "s"} marked present so far. Search your official name and mark present${branch}.`
      : `Search your official name and mark present for ${subject}${branch}. Shared via NextLecture.`
    : "Create a shareable present list for your class. Students search their official name and mark present — no app install needed.";

  const pagePath = sessionId ? `/mark-attendance/${encodeURIComponent(sessionId)}` : "/mark-attendance";
  const pageUrl = absoluteUrl(req, pagePath);
  // Raster OG card (WhatsApp/Facebook need PNG). Subject is also baked into
  // og:title / description. The SVG endpoint below remains available for clients
  // that request a subject-specific illustration.
  // WhatsApp/Facebook need a raster image. Use the branded PNG for the card art
  // and put the live subject into og:title / description (shown large in previews).
  // Subject-specific SVG art is available at /api/og/mark-attendance.png?subject=…
  const imageUrl = absoluteUrl(req, "/og-mark-attendance.png");

  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=60, s-maxage=120")
    .send(
      renderMarkAttendanceOgHtml({
        pageUrl,
        imageUrl,
        title,
        description,
      }),
    );
}

/**
 * Runtime OG image (SVG). Social crawlers that accept SVG will show the subject;
 * others still get a useful title/description from the HTML shell. A static PNG
 * fallback is also published at /og-mark-attendance.png.
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

  // Split long subjects onto two lines for the SVG.
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
