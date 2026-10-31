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

const PAGE_TITLE = "Lovepreet Singh (LSGZ) – Creator & Developer of NextLecture";
const PAGE_DESCRIPTION =
  "Meet Lovepreet Singh (LSGZ), independent student developer at GNDEC and the original creator and maintainer of NextLecture — a platform that simplifies timetables and campus academic tools for GNDEC students.";

/**
 * Serve the SPA shell for /about-developer with page-specific title, description,
 * Open Graph / Twitter tags, canonical URL, and Schema.org JSON-LD so search
 * engines can associate Lovepreet Singh (LSGZ) with NextLecture.
 */
export async function handleAboutDeveloperPage(req: Request, res: Response): Promise<void> {
  const pageUrl = absoluteUrl(req, "/about-developer");
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
    "@graph": [
      {
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
        about: { "@id": `${pageUrl}#person` },
        mainEntity: { "@id": `${pageUrl}#person` },
        inLanguage: "en",
      },
      {
        "@type": "Person",
        "@id": `${pageUrl}#person`,
        name: "Lovepreet Singh",
        alternateName: "LSGZ",
        url: "https://lsgz.vercel.app",
        jobTitle: "Independent Student Developer",
        affiliation: {
          "@type": "CollegeOrUniversity",
          name: "Guru Nanak Dev Engineering College (GNDEC)",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ludhiana",
            addressRegion: "Punjab",
            addressCountry: "IN",
          },
        },
        sameAs: [
          "https://github.com/lsgzt",
          "https://www.linkedin.com/in/lovepreet-singh-3b358287/",
          "https://t.me/lsgzt",
          "https://lsgz.vercel.app",
        ],
        knowsAbout: ["NextLecture", "web development", "GNDEC timetables"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}#software`,
        name: "NextLecture",
        url: "https://nextlecture.vercel.app",
        applicationCategory: "EducationApplication",
        operatingSystem: "Web",
        description:
          "NextLecture helps GNDEC students access timetables, vacant rooms, campus notices, holidays, and related academic tools in one place.",
        author: { "@id": `${pageUrl}#person` },
        creator: { "@id": `${pageUrl}#person` },
        publisher: { "@id": `${pageUrl}#person` },
      },
    ],
  };

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${safePageUrl}" />
    <meta property="og:site_name" content="NextLecture" />
    <meta property="og:type" content="profile" />
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

  // Remove generic site-wide title / description / OG / Twitter so this page's set is authoritative.
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
