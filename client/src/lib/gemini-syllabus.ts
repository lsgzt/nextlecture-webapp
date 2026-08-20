import type { StudentProfile } from "@shared/student-profile";
import type { GeminiSyllabusSettings, SyllabusChatMessage, SyllabusDocumentPayload } from "@shared/syllabus-chat";
import { buildSyllabusSystemInstruction } from "@shared/syllabus-prompt";

type GeminiStreamEvent = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

export function normalizeGeminiModelId(modelId: string) {
  return modelId.trim().replace(/^models\//i, "") || "gemini-3.6-flash";
}

export function extractGeminiStreamText(event: GeminiStreamEvent) {
  if (event.error?.message) throw new Error(event.error.message);
  return event.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
}

function extractGeminiApiError(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message || body;
  } catch {
    return body;
  }
}

async function consumeGeminiSseResponse(response: Response, onDelta: (text: string) => void) {
  if (!response.ok) throw new Error(`Gemini request failed: ${extractGeminiApiError(await response.text())}`);
  if (!response.body) throw new Error("Gemini did not return a streaming response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
        if (!data || data === "[DONE]") continue;
        onDelta(extractGeminiStreamText(JSON.parse(data) as GeminiStreamEvent));
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamGeminiSyllabusAnswer({
  settings,
  profile,
  document,
  history,
  question,
  onDelta,
  signal,
}: {
  settings: GeminiSyllabusSettings;
  profile: StudentProfile | null;
  document: SyllabusDocumentPayload;
  history: SyllabusChatMessage[];
  question: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}) {
  const modelId = normalizeGeminiModelId(settings.modelId);
  const contents = [
    ...history.filter(message => message.content.trim()).map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: document.mimeType, data: document.base64 } },
        { text: `Official source: ${document.sourceUrl}\nStudent branch: ${profile?.branch ?? "not available"}\n\nQuestion: ${question}` },
      ],
    },
  ];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSyllabusSystemInstruction(profile) }] },
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });

  return consumeGeminiSseResponse(response, onDelta);
}

export async function streamServerFallbackSyllabusAnswer({
  modelId,
  profile,
  history,
  question,
  onDelta,
  signal,
}: {
  modelId: string;
  profile: StudentProfile | null;
  history: SyllabusChatMessage[];
  question: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}) {
  const response = await fetch("/api/syllabus/stream", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, profile, history, question }),
  });
  return consumeGeminiSseResponse(response, onDelta);
}
