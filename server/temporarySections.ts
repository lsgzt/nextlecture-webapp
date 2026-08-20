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
const CACHE_PREFIX = "official-gnedc-permanent-section-2026-v1";
const PDF_RANGE_CHUNK_BYTES = 128 * 1024;
const PDF_RANGE_CONCURRENCY = 8;
const PDF_RANGE_TIMEOUT_MS = 25_000;
const PDF_RANGE_RETRIES = 2;
const MAX_OFFICIAL_PDF_BYTES = 4 * 1024 * 1024;
const inMemoryCache = new Map<TemporarySectionBranch, TemporarySectionCacheEnvelope>();
const inFlightRefresh = new Map<TemporarySectionBranch, Promise<TemporarySectionCacheEnvelope>>();
const PERMANENT_SECTION_COLUMN_STARTS = [0, 45, 82, 185, 295, 395, 435, 475, 525, 565, 675, 720];

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
 * Parses column-delimited text reconstructed from the source's revised 2026 permanent-section tables.
 * The document serial number is deliberately discarded: CRN is the official roll number.
 */
export function parseTemporarySectionText(text: string, expectedBranch: TemporarySectionBranch, sourceUrl: string) {
  const students: StudentProfile[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const columns = rawLine.split("\t").map(normalizeText);
    if (columns.length < 12) continue;
    const [, crn, studentName, fatherName, motherName, branch, section, subsection, mentoringGroup, mentorName, mentorMobileNumber, venue] = columns;
    if (!/^\d{6,16}$/.test(crn) || !studentName || !branch || !section || !subsection) continue;

    const recordBranch = branch.toUpperCase();
    if (recordBranch !== expectedBranch) continue;

    students.push({
      studentName,
      crn,
      fatherName: fatherName || null,
      motherName: motherName || null,
      branch: recordBranch,
      section: section.toUpperCase(),
      subsection: subsection.toUpperCase(),
      mentoringGroup: mentoringGroup || null,
      mentorName: mentorName || null,
      mentorMobileNumber: mentorMobileNumber || null,
      venue: venue || null,
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

  const previousCache = await getKnownCache(branch);
  const fresh = previousCache && Date.now() - previousCache.fetchedAt < TEMPORARY_SECTION_CACHE_TTL_MS;
  if (!forceRefresh && fresh) return { cache: previousCache, freshness: "fresh", updateError: null };

  try {
    return { cache: await refreshCache(branch), freshness: "fresh", updateError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official temporary-section update failed.";
    console.warn(`[Temporary sections] Official source refresh failed: ${message}`);
    if (previousCache) return { cache: previousCache, freshness: "stale", updateError: message };
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
