import { SYLLABUS_SOURCE_URL } from "@shared/config";
import type { SyllabusDocumentPayload } from "@shared/syllabus-chat";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    for (let index = offset; index < end; index += 1) binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export async function loadOfficialSyllabusDocument(signal?: AbortSignal): Promise<SyllabusDocumentPayload> {
  const response = await fetch("/api/syllabus.pdf", { signal });
  if (!response.ok) throw new Error(`The official syllabus PDF could not be loaded (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) throw new Error("The official syllabus PDF was empty.");
  const fetchedAt = Number(response.headers.get("X-NextLecture-Syllabus-Fetched-At")) || Date.now();
  return { base64: arrayBufferToBase64(buffer), mimeType: "application/pdf", sourceUrl: SYLLABUS_SOURCE_URL, fetchedAt, byteLength: buffer.byteLength };
}
