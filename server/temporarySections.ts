import { load } from "cheerio";
import axios from "axios";
import { eq } from "drizzle-orm";
import { getDocumentProxy } from "unpdf";
import { timetableCache } from "../drizzle/schema";
import {
  TEMPORARY_SECTION_CACHE_TTL_MS,
  TEMPORARY_SECTION_SOURCE_PAGE_URL,
} from "../shared/config";
import {
  TEMPORARY_SECTION_BRANCHES,
  type StudentProfile,
  type TemporarySectionBranch,
  type TemporarySectionCacheEnvelope,
  type TemporarySectionPayload,
} from "../shared/student-profile";
import { getDb } from "./db";

type TemporarySectionFetchResult = {
  cache: TemporarySectionCacheEnvelope;
  freshness: "fresh" | "stale";
  updateError: string | null;
};

const REQUEST_TIMEOUT_MS = 25_000;
/** Bumped when official PDF column layout changed (Class Coordinator added, column reorder Sep 2026). */
const CACHE_PREFIX = "official-gnedc-permanent-section-2026-v3";
const PDF_RANGE_CHUNK_BYTES = 128 * 1024;
const PDF_RANGE_CONCURRENCY = 8;
const PDF_RANGE_TIMEOUT_MS = 25_000;
const PDF_RANGE_RETRIES = 2;
const MAX_OFFICIAL_PDF_BYTES = 4 * 1024 * 1024;
const inMemoryCache = new Map<TemporarySectionBranch, TemporarySectionCacheEnvelope>();
const inFlightRefresh = new Map<TemporarySectionBranch, Promise<TemporarySectionCacheEnvelope>>();

/**
 * Column x-starts for the September 2026 permanent-section PDFs (12 physical slots;
 * CRN+Branch and Mobile+Venue are often merged in a single text item and split later):
 * Sr.No. | Registration No. | CRN + Branch | Student Name | Mother Name | Father Name |
 * Section | Subsection | Mentoring Group | Mentor Name | Mobile + Venue | Class Coordinator
 */
const PERMANENT_SECTION_COLUMN_STARTS = [0, 20, 60, 110, 210, 290, 385, 410, 440, 485, 575, 690];

/** Canonical official PDF URLs for September 2026 permanent sections (preferred over page discovery). */
const BRANCH_DOCUMENT_URLS: Record<TemporarySectionBranch, string> = {
  CE: "https://appsc.gndec.ac.in/sites/default/files/2026-09/CE%20Permanent%20Section%2015_09_2026.pdf",
  CS: "https://appsc.gndec.ac.in/sites/default/files/2026-09/CS%20Permanent%20Section%2015_09_2026.pdf",
  EC: "https://appsc.gndec.ac.in/sites/default/files/2026-09/EC%20Permanent%20Section%2015_09_2026.pdf",
  EE: "https://appsc.gndec.ac.in/sites/default/files/2026-09/EE%20Permanent%20Section%2015_09_2026.pdf",
  IT: "https://appsc.gndec.ac.in/sites/default/files/2026-09/IT%20Permanent%20Section%2015_09_2026.pdf",
  ME: "https://appsc.gndec.ac.in/sites/default/files/2026-09/ME%20Permanent%20Section%2015_09_2026_0.pdf",
  RAI: "https://appsc.gndec.ac.in/sites/default/files/2026-09/RAI%20Permanent%20Section%2015_09_2026.pdf",
};

type PdfTextItem = { str?: string; transform?: number[] };
type PdfTextContent = { items: PdfTextItem[] };

function cacheKey(branch: TemporarySectionBranch) {
  return `${CACHE_PREFIX}:${branch}`;
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSearch(value: string) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9 ]/g, "");
}

function isBranch(value: string): value is TemporarySectionBranch {
  return TEMPORARY_SECTION_BRANCHES.includes(value as TemporarySectionBranch);
}

function isValidEnvelope(value: unknown): value is TemporarySectionCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<TemporarySectionCacheEnvelope>;
  return Boolean(
    cache.data &&
      isBranch(cache.data.branch ?? "") &&
      Array.isArray(cache.data.students) &&
      typeof cache.fetchedAt === "number" &&
      typeof cache.sourceUrl === "string",
  );
}

/**
 * Split a cell that often merges CRN + Branch (e.g. "2621001 IT" or "2621001IT").
 * Returns [crn, branch] or [null, null] when the pattern does not match.
 */
function splitCrnAndBranch(value: string): [string | null, string | null] {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{6,10})\s*([A-Z]{2,4})$/i);
  if (!match) return [null, null];
  return [match[1], match[2].toUpperCase()];
}

/**
 * Split a cell that often merges Mentor mobile + Venue (e.g. "9814828414 S213" or "9814828414S213").
 */
function splitMobileAndVenue(value: string): [string | null, string | null] {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{10})\s*([A-Z0-9\-]+)$/i);
  if (match) return [match[1], match[2]];
  if (/^\d{10}$/.test(normalized)) return [normalized, null];
  if (/^[A-Z0-9\-]+$/i.test(normalized) && !/^\d+$/.test(normalized)) return [null, normalized];
  return [normalized || null, null];
}

/**
 * Parses column-delimited text reconstructed from the September 2026 permanent-section tables.
 * Layout: Sr.No., Registration No., CRN+Branch, Student Name, Mother Name, Father Name,
 * Section, Subsection, Mentoring Group, Mentor Name, Mobile+Venue, Class Coordinator.
 * Serial number is discarded; CRN is the roll number. Registration and Class Coordinator are captured.
 */
export function parseTemporarySectionText(text: string, expectedBranch: TemporarySectionBranch, sourceUrl: string) {
  const students: StudentProfile[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const columns = rawLine.split("\t").map(normalizeText);
    // Need at least the core fields; class coordinator is optional trailing column.
    if (columns.length < 11) continue;

    const [
      ,
      registrationNumber,
      crnBranchCell,
      studentName,
      motherName,
      fatherName,
      section,
      subsection,
      mentoringGroup,
      mentorName,
      mobileVenueCell,
      classCoordinator,
    ] = columns;

    const [crn, branchFromCell] = splitCrnAndBranch(crnBranchCell);
    // Fallback: some extractions put CRN and Branch in separate cells (legacy layout residual).
    let crnFinal = crn;
    let branchFinal = branchFromCell;
    if (!crnFinal && /^\d{6,16}$/.test(crnBranchCell)) {
      crnFinal = crnBranchCell;
      // Branch might sit in a following empty slot in older layouts; not expected here.
    }
    if (!crnFinal || !studentName || !section || !subsection) continue;
    // Reject rows where registration leaked into the name field.
    if (/^\d{6,16}\s/.test(studentName) || /^\d{6,16}$/.test(studentName)) continue;

    const recordBranch = (branchFinal ?? expectedBranch).toUpperCase();
    if (recordBranch !== expectedBranch) continue;

    const [mentorMobileNumber, venue] = splitMobileAndVenue(mobileVenueCell ?? "");

    students.push({
      studentName,
      crn: crnFinal,
      registrationNumber: /^\d{6,16}$/.test(registrationNumber) ? registrationNumber : null,
      fatherName: fatherName || null,
      motherName: motherName || null,
      branch: recordBranch,
      section: section.toUpperCase(),
      subsection: subsection.toUpperCase(),
      mentoringGroup: mentoringGroup || null,
      mentorName: mentorName || null,
      mentorMobileNumber: mentorMobileNumber || null,
      venue: venue || null,
      classCoordinator: classCoordinator || null,
      source: "official",
      sourceUrl,
      savedAt: Date.now(),
    });
  }

  if (!students.length) {
    throw new Error(`The official ${expectedBranch} permanent-section document did not contain readable student rows.`);
  }

  const seen = new Set<string>();
  return students
    .filter(student => {
      const key = student.crn;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.crn.localeCompare(right.crn, undefined, { numeric: true }));
}

export function findBranchDocumentUrl(html: string, branch: TemporarySectionBranch) {
  const $ = load(html);
  const target = `${branch} BRANCH`;
  const href = $("a")
    .toArray()
    .map(node => {
      const href = $(node).attr("href");
      return { href, decodedHref: href ? decodeURIComponent(href) : "", label: normalizeText($(node).text()).toUpperCase() };
    })
    .find(link => link.href && /\.pdf(?:$|\?)/i.test(link.href) && link.label.includes(target) && /PERMANENT\s+SECTION/i.test(link.decodedHref))?.href;

  if (!href) throw new Error(`The official website does not currently list a ${branch} permanent-section PDF.`);
  return new URL(href, TEMPORARY_SECTION_SOURCE_PAGE_URL).toString();
}

async function discoverBranchDocument(branch: TemporarySectionBranch) {
  // Prefer the known current official URLs so filename suffixes (_0 / _1) stay correct.
  const known = BRANCH_DOCUMENT_URLS[branch];
  if (known) return known;

  const response = await fetch(TEMPORARY_SECTION_SOURCE_PAGE_URL, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NextLecture/1.0 (GNDEC profile companion)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The official permanent-section page responded with ${response.status}.`);
  return findBranchDocumentUrl(await response.text(), branch);
}

function getTotalPdfBytes(contentRange: string | null) {
  const total = contentRange?.match(/\/(\d+)$/)?.[1];
  const size = total ? Number(total) : NaN;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_OFFICIAL_PDF_BYTES) {
    throw new Error("The official temporary-section PDF size could not be safely determined.");
  }
  return size;
}

async function fetchPdfRange(sourceUrl: string, start: number, end: number) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= PDF_RANGE_RETRIES; attempt += 1) {
    try {
      const response = await axios.get<ArrayBuffer>(sourceUrl, {
        headers: {
          Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
          Range: `bytes=${start}-${end}`,
          "User-Agent": "NextLecture/1.0 (GNDEC profile companion)",
        },
        responseType: "arraybuffer",
        timeout: PDF_RANGE_TIMEOUT_MS,
        maxContentLength: PDF_RANGE_CHUNK_BYTES + 256,
        maxBodyLength: PDF_RANGE_CHUNK_BYTES + 256,
      });
      if (response.status !== 206) throw new Error(`The official PDF did not honour a bounded range request (${response.status}).`);
      const bytes = new Uint8Array(response.data);
      const expected = end - start + 1;
      if (bytes.byteLength !== expected) throw new Error("The official PDF returned an incomplete range response.");
      return { bytes, contentRange: response.headers["content-range"] ?? null };
    } catch (error) {
      lastError = error;
      if (attempt < PDF_RANGE_RETRIES) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The official PDF range request failed.");
}

/**
 * The official host is slow for single full-file PDF responses but supports
 * HTTP byte ranges. We make a small, bounded number of parallel range requests
 * once per branch cache window, then reconstruct the original PDF locally.
 */
async function fetchOfficialPdfBytes(sourceUrl: string) {
  const first = await fetchPdfRange(sourceUrl, 0, PDF_RANGE_CHUNK_BYTES - 1);
  const totalBytes = getTotalPdfBytes(first.contentRange);
  const ranges = Array.from({ length: Math.ceil(totalBytes / PDF_RANGE_CHUNK_BYTES) }, (_, index) => {
    const start = index * PDF_RANGE_CHUNK_BYTES;
    return { index, start, end: Math.min(totalBytes - 1, start + PDF_RANGE_CHUNK_BYTES - 1) };
  });
  const chunks: Uint8Array[] = Array.from({ length: ranges.length });
  chunks[0] = first.bytes;
  let nextRange = 1;

  await Promise.all(Array.from({ length: Math.min(PDF_RANGE_CONCURRENCY, Math.max(0, ranges.length - 1)) }, async () => {
    while (nextRange < ranges.length) {
      const rangeIndex = nextRange;
      nextRange += 1;
      const range = ranges[rangeIndex];
      chunks[rangeIndex] = (await fetchPdfRange(sourceUrl, range.start, range.end)).bytes;
    }
  }));

  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
}

async function extractOfficialPdfText(sourceUrl: string) {
  const document = await getDocumentProxy(new Uint8Array(await fetchOfficialPdfBytes(sourceUrl)));
  try {
    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = (await page.getTextContent()) as unknown as PdfTextContent;
      const rows = new Map<number, PdfTextItem[]>();

      for (const item of content.items) {
        const value = normalizeText(item.str ?? "");
        const transform = item.transform;
        if (!value || !transform) continue;
        const rowKey = Math.round(transform[5] ?? 0);
        rows.set(rowKey, [...(rows.get(rowKey) ?? []), item]);
      }

      for (const [, row] of Array.from(rows.entries()).sort(([left], [right]) => right - left)) {
        const columns = Array.from({ length: PERMANENT_SECTION_COLUMN_STARTS.length }, () => "");
        for (const item of row.sort((left, right) => (left.transform?.[4] ?? 0) - (right.transform?.[4] ?? 0))) {
          const value = normalizeText(item.str ?? "");
          const x = item.transform?.[4] ?? 0;
          let columnIndex = PERMANENT_SECTION_COLUMN_STARTS.findIndex((start, index) => {
            const nextStart = PERMANENT_SECTION_COLUMN_STARTS[index + 1] ?? Number.POSITIVE_INFINITY;
            return x >= start && x < nextStart;
          });
          if (columnIndex < 0) columnIndex = columns.length - 1;
          columns[columnIndex] = normalizeText(`${columns[columnIndex]} ${value}`);
        }
        lines.push(columns.join("\t"));
      }
    }
    return lines.join("\n");
  } finally {
    await (document as { destroy?: () => Promise<void> | void }).destroy?.();
  }
}

async function readPersistentCache(branch: TemporarySectionBranch) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ payload: timetableCache.payload })
      .from(timetableCache)
      .where(eq(timetableCache.id, cacheKey(branch)))
      .limit(1);
    const parsed = rows[0] ? JSON.parse(rows[0].payload) : null;
    return isValidEnvelope(parsed) && parsed.data.branch === branch ? parsed : null;
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be read:", error);
    return null;
  }
}

async function persistCache(cache: TemporarySectionCacheEnvelope) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(timetableCache)
      .values({
        id: cacheKey(cache.data.branch),
        sourceUrl: cache.sourceUrl,
        payload: JSON.stringify(cache),
        fetchedAt: new Date(cache.fetchedAt),
      })
      .onDuplicateKeyUpdate({
        set: { sourceUrl: cache.sourceUrl, payload: JSON.stringify(cache), fetchedAt: new Date(cache.fetchedAt) },
      });
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be saved:", error);
  }
}

async function getKnownCache(branch: TemporarySectionBranch) {
  const existing = inMemoryCache.get(branch);
  if (existing) return existing;
  const persistent = await readPersistentCache(branch);
  if (persistent) inMemoryCache.set(branch, persistent);
  return persistent;
}

/** Drop in-memory + persistent cache for a branch (and legacy v2 keys) so the next fetch is clean. */
async function clearStoredCache(branch: TemporarySectionBranch) {
  inMemoryCache.delete(branch);
  const db = await getDb();
  if (!db) return;
  const keys = [
    cacheKey(branch),
    // Legacy prefixes so force-refresh fully invalidates older layouts.
    `official-gnedc-permanent-section-2026-v2:${branch}`,
    `official-gnedc-permanent-section-2026-v1:${branch}`,
  ];
  try {
    for (const id of keys) {
      await db.delete(timetableCache).where(eq(timetableCache.id, id));
    }
  } catch (error) {
    console.warn("[Temporary sections] Persistent cache could not be cleared:", error);
  }
}

async function refreshCache(branch: TemporarySectionBranch) {
  const existing = inFlightRefresh.get(branch);
  if (existing) return existing;

  const request = (async () => {
    const sourceUrl = await discoverBranchDocument(branch);
    const students = parseTemporarySectionText(await extractOfficialPdfText(sourceUrl), branch, sourceUrl);
    const cache: TemporarySectionCacheEnvelope = {
      data: { branch, students },
      fetchedAt: Date.now(),
      sourceUrl,
    };
    inMemoryCache.set(branch, cache);
    await persistCache(cache);
    return cache;
  })().finally(() => inFlightRefresh.delete(branch));

  inFlightRefresh.set(branch, request);
  return request;
}

export async function getOfficialTemporarySections(branchInput: string, forceRefresh = false): Promise<TemporarySectionFetchResult> {
  const branch = normalizeText(branchInput).toUpperCase();
  if (!isBranch(branch)) throw new Error(`Temporary-section lookup is not available for ${branchInput || "this branch"}.`);

  if (forceRefresh) {
    await clearStoredCache(branch);
  }

  const previousCache = forceRefresh ? null : await getKnownCache(branch);
  const fresh = previousCache && Date.now() - previousCache.fetchedAt < TEMPORARY_SECTION_CACHE_TTL_MS;
  if (!forceRefresh && fresh) return { cache: previousCache, freshness: "fresh", updateError: null };

  try {
    return { cache: await refreshCache(branch), freshness: "fresh", updateError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official temporary-section update failed.";
    console.warn(`[Temporary sections] Official source refresh failed: ${message}`);
    // After a forced clear, do not fall back to a cache we just deleted.
    const fallback = forceRefresh ? null : previousCache;
    if (fallback) return { cache: fallback, freshness: "stale", updateError: message };
    throw new Error(`Could not load the official temporary-section details: ${message}`);
  }
}

/** Warm or retrieve a branch document before name search begins. */
export async function prepareTemporarySectionBranch(branch: string) {
  const result = await getOfficialTemporarySections(branch);
  return {
    branch: result.cache.data.branch,
    studentCount: result.cache.data.students.length,
    fetchedAt: result.cache.fetchedAt,
    sourceUrl: result.cache.sourceUrl,
    freshness: result.freshness,
    updateError: result.updateError,
  };
}

export async function searchTemporarySectionStudents(branch: string, query: string) {
  const result = await getOfficialTemporarySections(branch);
  const needle = normalizeSearch(query);
  const matches = result.cache.data.students
    .filter(student => normalizeSearch(student.studentName).includes(needle))
    .slice(0, 20)
    .map(({ studentName, crn, branch: studentBranch, section, subsection, mentoringGroup }) => ({
      studentName,
      crn,
      branch: studentBranch,
      section,
      subsection,
      mentoringGroup,
    }));
  return { matches, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}

export async function getTemporarySectionStudent(branch: string, crn: string) {
  const result = await getOfficialTemporarySections(branch);
  const student = result.cache.data.students.find(item => item.crn === crn) ?? null;
  return { student, fetchedAt: result.cache.fetchedAt, freshness: result.freshness, updateError: result.updateError };
}
