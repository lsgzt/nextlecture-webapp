import { describe, expect, it, vi } from "vitest";
import { loadOfficialSyllabusDocument } from "./syllabus-document";

describe("official syllabus browser loader", () => {
  it("converts the same-origin PDF stream to Gemini-ready base64", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(Uint8Array.from([37, 80, 68, 70]), { status: 200, headers: { "X-NextLecture-Syllabus-Fetched-At": "42" } })));
    await expect(loadOfficialSyllabusDocument()).resolves.toMatchObject({ base64: "JVBERg==", byteLength: 4, fetchedAt: 42, mimeType: "application/pdf" });
  });
});
