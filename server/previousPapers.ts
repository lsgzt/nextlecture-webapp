import { PREVIOUS_PAPER_SESSIONS, toGoogleDrivePaperLinks, type PreviousPaper, type PreviousPaperSession } from "@shared/previous-papers";
import axios from "axios";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PAPER_FILE_ID = /^[A-Za-z0-9_-]{20,100}$/;
const cache = new Map<string, { fetchedAt: number; papers: PreviousPaper[] }>();

function decodeHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

export function parseGoogleDrivePapers(html: string): PreviousPaper[] {
  const papers: PreviousPaper[] = [];
  const seen = new Set<string>();
  for (const match of Array.from(html.matchAll(/\bdata-id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi))) {
    const id = match[1];
    const text = decodeHtml(match[2]);
    const name = (text.match(/(?:^|\s)(?:PDF\s+)?(.+?\.pdf)(?=\s+(?:Shared|Partagé|Download|Télécharger)(?:\s|$)|$)/i)?.[1] ?? "").trim();
    if (!PAPER_FILE_ID.test(id) || !/\.pdf$/i.test(name) || seen.has(id)) continue;
    seen.add(id);
    papers.push({ id, name, ...toGoogleDrivePaperLinks(id) });
  }
  return papers.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
}

export function getPreviousPaperSessions() {
  return PREVIOUS_PAPER_SESSIONS;
}

export async function getPreviousPapers(sessionId: string) {
  const session = PREVIOUS_PAPER_SESSIONS.find(item => item.id === sessionId);
  if (!session) throw new Error("That paper archive session is not available.");
  const cached = cache.get(session.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return { session, papers: cached.papers, fetchedAt: cached.fetchedAt, freshness: "fresh" as const };

  const response = await axios.get<string>(`https://drive.google.com/drive/folders/${session.id}`, {
    headers: { Accept: "text/html", "User-Agent": "NextLecture/1.0 (previous papers catalog)" },
    responseType: "text",
    timeout: 25_000,
    maxContentLength: 2 * 1024 * 1024,
  });
  const papers = parseGoogleDrivePapers(response.data);
  const fetchedAt = Date.now();
  cache.set(session.id, { fetchedAt, papers });
  return { session, papers, fetchedAt, freshness: "fresh" as const };
}

export type { PreviousPaperSession };
