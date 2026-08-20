import axios from "axios";
import { SYLLABUS_CACHE_TTL_MS, SYLLABUS_SOURCE_URL } from "@shared/config";
import type { SyllabusDocumentPayload } from "@shared/syllabus-chat";

type CachedSyllabus = { bytes: Buffer; fetchedAt: number };

let cache: CachedSyllabus | null = null;
let inFlight: Promise<CachedSyllabus> | null = null;
const MAX_SYLLABUS_BYTES = 8 * 1024 * 1024;
const PDF_RANGE_CHUNK_BYTES = 128 * 1024;
const PDF_RANGE_CONCURRENCY = 8;

async function fetchSyllabusRange(start: number, end: number) {
  const response = await axios.get<ArrayBuffer>(SYLLABUS_SOURCE_URL, {
    responseType: "arraybuffer",
    timeout: 25_000,
    maxContentLength: PDF_RANGE_CHUNK_BYTES + 1024,
    maxBodyLength: PDF_RANGE_CHUNK_BYTES + 1024,
    headers: {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      Range: `bytes=${start}-${end}`,
      "User-Agent": "NextLecture/1.0 (GNDEC syllabus companion)",
    },
  });
  return { bytes: Buffer.from(response.data), headers: response.headers, status: response.status };
}

function readTotalBytes(contentRange: unknown) {
  const match = String(contentRange ?? "").match(/bytes\s+\d+-\d+\/(\d+)/i);
  const total = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

async function fetchOfficialSyllabusBytes() {
  const first = await fetchSyllabusRange(0, PDF_RANGE_CHUNK_BYTES - 1);
  const totalBytes = readTotalBytes(first.headers["content-range"]);
  if (first.status !== 206 || !totalBytes) return first.bytes;
  if (totalBytes > MAX_SYLLABUS_BYTES) throw new Error("The official syllabus PDF is larger than the supported safety limit.");

  const chunks: Buffer[] = [first.bytes];
  const ranges = Array.from({ length: Math.ceil(totalBytes / PDF_RANGE_CHUNK_BYTES) - 1 }, (_, index) => {
    const start = (index + 1) * PDF_RANGE_CHUNK_BYTES;
    return { start, end: Math.min(totalBytes - 1, start + PDF_RANGE_CHUNK_BYTES - 1) };
  });
  for (let offset = 0; offset < ranges.length; offset += PDF_RANGE_CONCURRENCY) {
    const group = await Promise.all(ranges.slice(offset, offset + PDF_RANGE_CONCURRENCY).map(range => fetchSyllabusRange(range.start, range.end)));
    chunks.push(...group.map(result => result.bytes));
  }
  return Buffer.concat(chunks).subarray(0, totalBytes);
}

export async function getOfficialSyllabusPdfBuffer(force = false): Promise<CachedSyllabus> {
  if (!force && cache && Date.now() - cache.fetchedAt < SYLLABUS_CACHE_TTL_MS) return cache;
  if (!force && inFlight) return inFlight;

  const load = async () => {
    const bytes = await fetchOfficialSyllabusBytes();
    if (!bytes.length || bytes.length > MAX_SYLLABUS_BYTES || !bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      throw new Error("The official syllabus source did not return a valid PDF document.");
    }
    cache = { bytes, fetchedAt: Date.now() };
    return cache;
  };

  inFlight = load().finally(() => { inFlight = null; });
  return inFlight;
}

export async function getOfficialSyllabusDocument(force = false): Promise<SyllabusDocumentPayload> {
  const syllabus = await getOfficialSyllabusPdfBuffer(force);
  return {
    base64: syllabus.bytes.toString("base64"),
    mimeType: "application/pdf",
    sourceUrl: SYLLABUS_SOURCE_URL,
    fetchedAt: syllabus.fetchedAt,
    byteLength: syllabus.bytes.length,
  };
}

export function clearOfficialSyllabusCacheForTests() {
  cache = null;
  inFlight = null;
}
