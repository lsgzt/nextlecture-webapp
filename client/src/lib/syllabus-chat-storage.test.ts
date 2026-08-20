import { describe, expect, it } from "vitest";
import { createSyllabusConversation, readGeminiSyllabusSettings, readSyllabusConversations, saveGeminiSyllabusSettings, saveSyllabusConversations } from "./syllabus-chat-storage";

function createStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("syllabus AI local storage", () => {
  it("persists a user-provided Gemini key and custom model only in the supplied device storage", () => {
    const storage = createStorage();
    saveGeminiSyllabusSettings(storage, { apiKey: "  test-key  ", modelId: " models/custom-syllabus-model " });
    expect(readGeminiSyllabusSettings(storage)).toEqual({ apiKey: "test-key", modelId: "models/custom-syllabus-model" });
  });

  it("preserves a model preference when the user intentionally relies on the server fallback key", () => {
    const storage = createStorage();
    saveGeminiSyllabusSettings(storage, { apiKey: "", modelId: "gemini-3.6-flash" });
    expect(readGeminiSyllabusSettings(storage)).toEqual({ apiKey: "", modelId: "gemini-3.6-flash" });
  });

  it("preserves recent local syllabus conversations and ignores malformed records", () => {
    const storage = createStorage();
    const conversation = createSyllabusConversation(1);
    saveSyllabusConversations(storage, [{ ...conversation, title: "Math I", updatedAt: 2 }]);
    expect(readSyllabusConversations(storage)).toMatchObject([{ title: "Math I", messages: [] }]);
  });
});
