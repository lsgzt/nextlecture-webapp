import type { StudentProfile } from "@shared/student-profile";
import { DEFAULT_GEMINI_MODEL_ID, type SyllabusChatMessage } from "@shared/syllabus-chat";
import { buildSyllabusSystemInstruction } from "@shared/syllabus-prompt";
import { getOfficialSyllabusDocument } from "./syllabus";

export type SyllabusFallbackRequest = {
  modelId?: unknown;
  profile?: StudentProfile | null;
  history?: unknown;
  question?: unknown;
};

export function getConfiguredGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function normalizeServerGeminiModelId(modelId: unknown) {
  return typeof modelId === "string" && modelId.trim() ? modelId.trim().replace(/^models\//i, "") : DEFAULT_GEMINI_MODEL_ID;
}

function normalizeHistory(value: unknown): SyllabusChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const message = item as Partial<SyllabusChatMessage>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    const content = message.content.trim().slice(0, 12_000);
    return content ? [{ id: message.id ?? "server-history", role: message.role, content, createdAt: message.createdAt ?? 0 }] : [];
  });
}

export async function createServerFallbackGeminiResponse(request: SyllabusFallbackRequest, signal?: AbortSignal) {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on this deployment.");
  const question = typeof request.question === "string" ? request.question.trim().slice(0, 12_000) : "";
  if (!question) throw new Error("A syllabus question is required.");

  const profile = request.profile ?? null;
  const history = normalizeHistory(request.history);
  const document = await getOfficialSyllabusDocument();
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeServerGeminiModelId(request.modelId))}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSyllabusSystemInstruction(profile) }] },
      contents: [
        ...history.map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
        { role: "user", parts: [{ inlineData: { mimeType: document.mimeType, data: document.base64 } }, { text: `Official source: ${document.sourceUrl}\nStudent branch: ${profile?.branch ?? "not available"}\n\nQuestion: ${question}` }] },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });
}
