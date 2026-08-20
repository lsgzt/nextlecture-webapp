export const DEFAULT_GEMINI_MODEL_ID = "gemini-2.5-flash";

export type SyllabusChatRole = "user" | "assistant";

export type SyllabusChatMessage = {
  id: string;
  role: SyllabusChatRole;
  content: string;
  createdAt: number;
};

export type SyllabusConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SyllabusChatMessage[];
};

export type GeminiSyllabusSettings = {
  apiKey: string;
  modelId: string;
};

export type SyllabusDocumentPayload = {
  base64: string;
  mimeType: "application/pdf";
  sourceUrl: string;
  fetchedAt: number;
  byteLength: number;
};
