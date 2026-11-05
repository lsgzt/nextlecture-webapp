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
  const host = req.get("x-forwarded-host") || req.get("host") || "nextlecture.vercel.app";
  const proto = (req.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return `${proto}://${host}${path}`;
}

const PAGE_TITLE = "Terms & Conditions — NextLecture";
const PAGE_DESCRIPTION =
  "Terms & Conditions for the NextLecture website, Progressive Web App, and Android application used by GNDEC students.";

/**
 * Serve the SPA shell for /terms with page-specific title, description,
 * Open Graph / Twitter tags, and canonical URL.
 */
export async function handleTermsPage(req: Request, res: Response): Promise<void> {
  const pageUrl = absoluteUrl(req, "/terms");
  const imageUrl = absoluteUrl(req, "/og-preview.png");
  const siteUrl = absoluteUrl(req, "/");

  const host = req.get("x-forwarded-host") || req.get("host") || "nextlecture.vercel.app";
  const proto = (req.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const indexResponse = await fetch(`${proto}://${host}/index.html`);
  if (!indexResponse.ok) {
    throw new Error(`Could not load SPA shell (${indexResponse.status})`);
  }
  let html = await indexResponse.text();

  const title = escapeHtml(PAGE_TITLE);
  const description = escapeHtml(PAGE_DESCRIPTION);
  const safePageUrl = escapeHtml(pageUrl);
  const safeImageUrl = escapeHtml(imageUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      name: "NextLecture",
      url: siteUrl,
    },
    inLanguage: "en",
  };

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${safePageUrl}" />
    <meta property="og:site_name" content="NextLecture" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${safePageUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:secure_url" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1500" />
    <meta property="og:image:height" content="844" />
    <meta property="og:image:alt" content="${title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  html = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${metaBlock}`);
  } else {
    html = metaBlock + html;
  }

  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=300, s-maxage=3600")
    .send(html);
}
