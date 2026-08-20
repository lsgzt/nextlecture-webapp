import { describe, expect, it, vi } from "vitest";
import { buildSyllabusSystemInstruction } from "@shared/syllabus-prompt";
import { extractGeminiStreamText, normalizeGeminiModelId, streamGeminiSyllabusAnswer } from "./gemini-syllabus";

describe("Gemini syllabus request helpers", () => {
  it("normalizes custom model IDs and creates a branch-aware grounded instruction", () => {
    expect(normalizeGeminiModelId(" models/gemini-2.5-flash ")).toBe("gemini-2.5-flash");
    expect(buildSyllabusSystemInstruction({ branch: "IT" } as never)).toContain("IT");
    expect(buildSyllabusSystemInstruction({ branch: "IT" } as never)).toMatch(/sole source of truth/i);
  });

  it("extracts streamed text chunks and surfaces Gemini event errors", () => {
    expect(extractGeminiStreamText({ candidates: [{ content: { parts: [{ text: "Unit 1" }, { text: ": topics" }] } }] })).toBe("Unit 1: topics");
    expect(() => extractGeminiStreamText({ error: { message: "Invalid key" } })).toThrow("Invalid key");
  });

  it("streams Gemini SSE text chunks while keeping the PDF and branch context in the request", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"## Mathematics-I\\n"}]}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Unit 1"}]}}]}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const deltas: string[] = [];

    await streamGeminiSyllabusAnswer({
      settings: { apiKey: "test-key", modelId: "models/custom-model" },
      profile: { branch: "IT" } as never,
      document: { base64: "JVBERg==", mimeType: "application/pdf", sourceUrl: "https://official.example/syllabus.pdf", fetchedAt: 1, byteLength: 4 },
      history: [],
      question: "What is Mathematics-I?",
      onDelta: delta => deltas.push(delta),
    });

    expect(deltas).toEqual(["## Mathematics-I\n", "Unit 1"]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("models/custom-model:streamGenerateContent");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("official.example/syllabus.pdf");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ "x-goog-api-key": "test-key" });
  });
});
