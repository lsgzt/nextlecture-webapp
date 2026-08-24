import { ANDROID_STUDENT_DIRECTORY_URL } from "../shared/config";

type AndroidDirectoryRecord = {
  crn?: string;
  registrationNumber?: string;
  candidateName?: string;
  branch?: string;
  subsection?: string;
};

type ProfileLookupInput = {
  crn: string;
  branch: string;
  studentName: string;
  subsection: string;
};

type FetchLike = typeof fetch;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedDirectory: { records: AndroidDirectoryRecord[]; fetchedAt: number } | null = null;

function normalize(value: string | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ").replace(/[^A-Z0-9 ]/g, "");
}

function normalizeRecord(value: unknown): AndroidDirectoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as AndroidDirectoryRecord;
  if (typeof record.crn !== "string" || typeof record.registrationNumber !== "string" || typeof record.candidateName !== "string" || typeof record.branch !== "string" || typeof record.subsection !== "string") return null;
  return record;
}

export async function getAndroidStudentDirectory(fetcher: FetchLike = fetch) {
  if (cachedDirectory && Date.now() - cachedDirectory.fetchedAt < CACHE_TTL_MS) return cachedDirectory.records;
  const response = await fetcher(ANDROID_STUDENT_DIRECTORY_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The Android student directory is unavailable.");
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("The Android student directory had an invalid format.");
  const records = payload.map(normalizeRecord).filter((record): record is AndroidDirectoryRecord => Boolean(record));
  if (!records.length) throw new Error("The Android student directory did not contain usable profiles.");
  cachedDirectory = { records, fetchedAt: Date.now() };
  return records;
}

export async function recoverAndroidRegistrationNumber(input: ProfileLookupInput, fetcher: FetchLike = fetch) {
  const records = await getAndroidStudentDirectory(fetcher);
  const match = records.find(record =>
    normalize(record.crn) === normalize(input.crn)
    && normalize(record.branch) === normalize(input.branch)
    && normalize(record.subsection) === normalize(input.subsection)
    && normalize(record.candidateName) === normalize(input.studentName),
  );
  return { registrationNumber: match?.registrationNumber?.trim() || null };
}

export function resetAndroidStudentDirectoryForTests() {
  cachedDirectory = null;
}
