import type { StudentProfile } from "@shared/student-profile";
import type { GeminiSyllabusSettings, SyllabusChatMessage, SyllabusDocumentPayload } from "@shared/syllabus-chat";

type GeminiStreamEvent = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

export function normalizeGeminiModelId(modelId: string) {
  return modelId.trim().replace(/^models\//i, "") || "gemini-2.5-flash";
}

export function buildSyllabusSystemInstruction(profile: StudentProfile | null) {
  const branch = profile?.branch ?? "not available";
  return `You are NextLecture Syllabus AI. You answer questions only from the attached official GNDEC B.Tech Semester 1–2 syllabus PDF. The student branch saved on this device is ${branch}.

Non-negotiable rules:
1. Treat the attached PDF as the sole source of truth. Do not use outside knowledge, assumptions, recollection, or invented course content.
2. Identify the exact semester, subject, course code, and branch applicability from the PDF before answering. If the request is ambiguous, state the matching possibilities from the document and ask for the missing course title, course code, or semester.
3. For a syllabus request, include every listed unit in its original order. Preserve all named topics, subtopics, practical components, outcomes, hours, marks, prerequisites, and assessment details when they are present in the PDF. Never summarize away a unit or topic.
4. Clearly distinguish facts in the document from anything the document does not state. If the answer is not in the PDF, say “Not stated in the official syllabus PDF.”
5. Use clean Markdown: headings, bold labels, ordered unit lists, and tables only when they improve clarity. Do not use unsupported citations or URLs.
6. End substantive answers with a concise source note naming the course code/title and PDF page number(s) whenever you can identify them.
7. Follow-up questions must remain grounded in the same attached PDF and the preceding conversation. Do not claim that a topic is included unless it appears in the document.`;
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
