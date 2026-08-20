import { afterEach, describe, expect, it, vi } from "vitest";

describe("Syllabus AI server Gemini fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads the optional Vercel GEMINI_API_KEY only on the server", async () => {
    vi.stubEnv("GEMINI_API_KEY", "  server-fallback-key  ");
    const { getConfiguredGeminiApiKey, normalizeServerGeminiModelId } = await import("./syllabusGemini");
    expect(getConfiguredGeminiApiKey()).toBe("server-fallback-key");
    expect(normalizeServerGeminiModelId(" models/custom-syllabus ")).toBe("custom-syllabus");
  });

  it("uses gemini-3.6-flash when no model ID is supplied", async () => {
    const { normalizeServerGeminiModelId } = await import("./syllabusGemini");
    expect(normalizeServerGeminiModelId(undefined)).toBe("gemini-3.6-flash");
  });
});
