import type { Request, Response } from "express";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(req: Request, path: string): string {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  const proto = (req.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http"))
    .split(",")[0]
    .trim();
  return `${proto}://${host}${path}`;
}

/**
 * Serve the homepage shell with deployment-host-aware canonical and OG URLs.
 * This keeps social previews correct when the same build is attached to a new
 * Vercel domain, without hardcoding a production hostname in the client shell.
 */
export async function handleHomepagePage(req: Request, res: Response): Promise<void> {
  const indexUrl = absoluteUrl(req, "/index.html");
  const siteUrl = absoluteUrl(req, "/");
  const imageUrl = absoluteUrl(req, "/og-preview.png");
  const indexResponse = await fetch(indexUrl);
  if (!indexResponse.ok) {
    throw new Error(`Could not load SPA shell (${indexResponse.status})`);
  }

  let html = await indexResponse.text();
  const safeSiteUrl = escapeHtml(siteUrl);
  const safeImageUrl = escapeHtml(imageUrl);
  const metaBlock = `
    <link rel="canonical" href="${safeSiteUrl}" />
    <meta property="og:url" content="${safeSiteUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:secure_url" content="${safeImageUrl}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
  `;

  // Remove the generic static values before inserting host-specific values.
  html = html
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:url"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:image(?::secure_url)?"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:image"[^>]*>/gi, "");

  html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${metaBlock}`);

  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=300, s-maxage=300")
    .setHeader("Vary", "Host")
    .send(html);
}
