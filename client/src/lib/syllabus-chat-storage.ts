import { DEFAULT_GEMINI_MODEL_ID, type GeminiSyllabusSettings, type SyllabusChatMessage, type SyllabusConversation } from "@shared/syllabus-chat";

const SETTINGS_KEY = "nextlecture:syllabus-ai-settings";
const CONVERSATIONS_KEY = "nextlecture:syllabus-ai-conversations";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function isMessage(value: unknown): value is SyllabusChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<SyllabusChatMessage>;
  return typeof message.id === "string" && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && typeof message.createdAt === "number";
}

function isConversation(value: unknown): value is SyllabusConversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<SyllabusConversation>;
  return typeof conversation.id === "string" && typeof conversation.title === "string" && typeof conversation.createdAt === "number" && typeof conversation.updatedAt === "number" && Array.isArray(conversation.messages) && conversation.messages.every(isMessage);
}

export function readGeminiSyllabusSettings(storage: StorageLike): GeminiSyllabusSettings | null {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const settings = JSON.parse(raw) as Partial<GeminiSyllabusSettings>;
    if (!settings || typeof settings.apiKey !== "string" || !settings.apiKey.trim()) return null;
    return { apiKey: settings.apiKey.trim(), modelId: settings.modelId?.trim() || DEFAULT_GEMINI_MODEL_ID };
  } catch {
    return null;
  }
}

export function saveGeminiSyllabusSettings(storage: StorageLike, settings: GeminiSyllabusSettings) {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error("A Gemini API key is required.");
  storage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey, modelId: settings.modelId.trim() || DEFAULT_GEMINI_MODEL_ID }));
}

export function readSyllabusConversations(storage: StorageLike): SyllabusConversation[] {
  try {
    const raw = storage.getItem(CONVERSATIONS_KEY);
    const conversations = raw ? JSON.parse(raw) : [];
    return Array.isArray(conversations) ? conversations.filter(isConversation).sort((left, right) => right.updatedAt - left.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveSyllabusConversations(storage: StorageLike, conversations: SyllabusConversation[]) {
  storage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations.slice(0, 30)));
}

export function createSyllabusConversation(now = Date.now()): SyllabusConversation {
  return { id: createId("syllabus-chat"), title: "New syllabus chat", createdAt: now, updatedAt: now, messages: [] };
}

export function createSyllabusMessage(role: SyllabusChatMessage["role"], content = "", now = Date.now()): SyllabusChatMessage {
  return { id: createId(role), role, content, createdAt: now };
}
