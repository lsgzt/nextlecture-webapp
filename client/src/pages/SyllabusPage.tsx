import { AIChatBox, type Message as ChatMessage } from "@/components/AIChatBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { readGeminiSyllabusSettings, readSyllabusConversations, saveGeminiSyllabusSettings, saveSyllabusConversations, createSyllabusConversation, createSyllabusMessage } from "@/lib/syllabus-chat-storage";
import { streamGeminiSyllabusAnswer } from "@/lib/gemini-syllabus";
import { loadOfficialSyllabusDocument } from "@/lib/syllabus-document";
import { readStoredStudentProfile } from "@/lib/student-profile-storage";
import { BRAND_LOGO_URL, SYLLABUS_SOURCE_URL } from "@shared/config";
import { DEFAULT_GEMINI_MODEL_ID, type GeminiSyllabusSettings, type SyllabusChatMessage, type SyllabusConversation } from "@shared/syllabus-chat";
import { ArrowLeft, BookOpenText, Bot, ChevronRight, CirclePlus, KeyRound, LoaderCircle, MessageSquareText, PanelLeft, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const examples = [
  "What is my syllabus of Mathematics-I in first semester?",
  "List every unit and topic in Physics.",
  "What are the marks, credits, and teaching hours for Basic Electrical and Electronics Engineering?",
];

function shortTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  return normalized.length > 52 ? `${normalized.slice(0, 49)}…` : normalized || "New syllabus chat";
}

function conversationToChatMessages(messages: SyllabusChatMessage[]): ChatMessage[] {
  return messages.map(message => ({ role: message.role, content: message.content }));
}

function prepareConversation(conversations: SyllabusConversation[], activeId: string | null) {
  return conversations.find(conversation => conversation.id === activeId) ?? conversations[0] ?? null;
}

export default function SyllabusPage() {
  const [settings, setSettings] = useState<GeminiSyllabusSettings | null>(() => readGeminiSyllabusSettings(localStorage));
  const [draftSettings, setDraftSettings] = useState<GeminiSyllabusSettings>(() => readGeminiSyllabusSettings(localStorage) ?? { apiKey: "", modelId: DEFAULT_GEMINI_MODEL_ID });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversations, setConversations] = useState<SyllabusConversation[]>(() => readSyllabusConversations(localStorage));
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => readSyllabusConversations(localStorage)[0]?.id ?? null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const syllabusDocumentRef = useRef<Awaited<ReturnType<typeof loadOfficialSyllabusDocument>> | null>(null);
  const profile = useMemo(() => readStoredStudentProfile(localStorage), []);
  const activeConversation = prepareConversation(conversations, activeConversationId);
  const [isPreparingDocument, setIsPreparingDocument] = useState(false);

  useEffect(() => {
    saveSyllabusConversations(localStorage, conversations);
  }, [conversations]);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      saveGeminiSyllabusSettings(localStorage, draftSettings);
      const next = { apiKey: draftSettings.apiKey.trim(), modelId: draftSettings.modelId.trim() || DEFAULT_GEMINI_MODEL_ID };
      setSettings(next);
      setDraftSettings(next);
      setSettingsOpen(false);
      setError(null);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Could not save your Gemini settings.");
    }
  }

  function startNewChat() {
    if (isStreaming) return;
    const conversation = createSyllabusConversation();
    setConversations(current => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setError(null);
  }

  async function sendQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming) return;
    if (!settings?.apiKey) {
      setDraftSettings(settings ?? { apiKey: "", modelId: DEFAULT_GEMINI_MODEL_ID });
      setSettingsOpen(true);
      return;
    }
    setError(null);
    let document = syllabusDocumentRef.current;
    if (!document) {
      setIsPreparingDocument(true);
      try {
        document = await loadOfficialSyllabusDocument();
        syllabusDocumentRef.current = document;
      } catch (documentError) {
        setError(documentError instanceof Error ? documentError.message : "The official syllabus PDF could not be prepared. Please try again.");
        return;
      } finally {
        setIsPreparingDocument(false);
      }
    }

    const base = activeConversation ?? createSyllabusConversation();
    const userMessage = createSyllabusMessage("user", trimmedQuestion);
    const assistantMessage = createSyllabusMessage("assistant");
    const pending: SyllabusConversation = {
      ...base,
      title: base.messages.length ? base.title : shortTitle(trimmedQuestion),
      updatedAt: Date.now(),
      messages: [...base.messages, userMessage, assistantMessage],
    };
    setConversations(current => [pending, ...current.filter(item => item.id !== pending.id)]);
    setActiveConversationId(pending.id);
    setIsStreaming(true);
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await streamGeminiSyllabusAnswer({
        settings,
        profile,
        document,
        history: base.messages,
        question: trimmedQuestion,
        signal: controller.signal,
        onDelta: delta => {
          if (!delta) return;
          setConversations(current => current.map(conversation => conversation.id !== pending.id ? conversation : {
            ...conversation,
            updatedAt: Date.now(),
            messages: conversation.messages.map(message => message.id === assistantMessage.id ? { ...message, content: `${message.content}${delta}` } : message),
          }));
        },
      });
    } catch (streamError) {
      if (controller.signal.aborted) return;
      const message = streamError instanceof Error ? streamError.message.replace(/^Gemini request failed:\s*/i, "") : "Gemini could not answer right now.";
      setError(message);
      setConversations(current => current.map(conversation => conversation.id !== pending.id ? conversation : {
        ...conversation,
        messages: conversation.messages.map(item => item.id === assistantMessage.id && !item.content ? { ...item, content: "I couldn’t complete that answer. Check your Gemini API key, model ID, and connection, then try again." } : item),
      }));
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setIsStreaming(false);
    }
  }

  const chatMessages = conversationToChatMessages(activeConversation?.messages ?? []);
  return <div className="min-h-screen bg-[#f6f8f7] text-foreground dark:bg-[#101917]">
    <header className="app-topbar"><div className="container flex h-17 items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Link href="/app" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300" aria-label="Back to timetable"><ArrowLeft className="h-4 w-4" /></Link><img src={BRAND_LOGO_URL} alt="NextLecture timetable logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" /><div className="min-w-0"><p className="truncate font-display text-lg font-semibold tracking-[-0.04em]">Syllabus AI</p><p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">OFFICIAL GNDEC SOURCE</p></div></div><div className="flex shrink-0 items-center gap-2"><ThemeToggle /><Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-2 bg-card"><KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">AI settings</span></Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Gemini settings</DialogTitle><DialogDescription>Your key stays in this browser’s local storage and is sent directly to Google Gemini. NextLecture never stores or receives it.</DialogDescription></DialogHeader><form onSubmit={saveSettings} className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">Gemini API key<input required type="password" autoComplete="off" value={draftSettings.apiKey} onChange={event => setDraftSettings(current => ({ ...current, apiKey: event.target.value }))} placeholder="AIza…" className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /></label><label className="grid gap-2 text-sm font-semibold">Model ID<input value={draftSettings.modelId} onChange={event => setDraftSettings(current => ({ ...current, modelId: event.target.value }))} placeholder={DEFAULT_GEMINI_MODEL_ID} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /><span className="text-xs font-normal leading-5 text-muted-foreground">You can use a custom Gemini model ID. The default is {DEFAULT_GEMINI_MODEL_ID}.</span></label><Button type="submit" className="bg-teal-700 hover:bg-teal-800">Save on this device</Button></form></DialogContent></Dialog></div></div></header>
    <main className="container max-w-7xl py-6 sm:py-9"><div className="mb-6 grid gap-5 rounded-[1.6rem] border border-teal-200 bg-gradient-to-br from-teal-50 via-card to-card p-5 shadow-sm dark:border-teal-950/80 dark:from-teal-950/30 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> SOURCE-GROUNDED STUDY HELP</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Ask AI about your syllabus</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Ask about Semester 1–2 subjects, units, marks, outcomes, or practicals. Each answer is generated from the official GNDEC syllabus PDF attached to your Gemini request.</p></div><div className="rounded-2xl border border-teal-200 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-teal-900/60 dark:bg-teal-950/35"><p className="font-semibold text-teal-900 dark:text-teal-100">{profile ? `${profile.branch} profile connected` : "No student profile found"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{profile ? "Your saved branch is included in each AI request." : "Set your profile in the timetable first for branch-aware answers."}</p></div></div>
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]"><aside className="rounded-3xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-border px-2 pb-3"><div className="flex items-center gap-2"><PanelLeft className="h-4 w-4 text-teal-700 dark:text-teal-300" /><p className="text-sm font-bold">Your chats</p></div><Button type="button" size="sm" onClick={startNewChat} disabled={isStreaming} className="h-8 gap-1.5 bg-teal-700 px-2.5 text-xs hover:bg-teal-800"><CirclePlus className="h-3.5 w-3.5" /> New</Button></div><div className="mt-2 max-h-48 space-y-1 overflow-y-auto lg:max-h-[34rem]">{conversations.length ? conversations.map(conversation => <button key={conversation.id} type="button" onClick={() => { if (!isStreaming) { setActiveConversationId(conversation.id); setError(null); } }} className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${conversation.id === activeConversation?.id ? "bg-teal-50 text-teal-950 dark:bg-teal-950/45 dark:text-teal-100" : "hover:bg-muted/70"}`}><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" /><span className="line-clamp-2 text-sm font-medium">{conversation.title}</span></button>) : <p className="px-3 py-7 text-center text-sm leading-6 text-muted-foreground">Your saved syllabus chats will appear here.</p>}</div></aside>
        <section className="min-w-0"><div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"><AIChatBox messages={chatMessages} onSendMessage={sendQuestion} isLoading={isStreaming || isPreparingDocument} height="min(66vh, 670px)" placeholder={settings?.apiKey ? "Ask about a subject, unit, marks, or practical…" : "Add your Gemini API key in AI settings to begin"} emptyStateMessage={settings?.apiKey ? "Ask anything about the official Semester 1–2 syllabus." : "Add your Gemini API key to begin a private, source-grounded syllabus chat."} className="border-0 shadow-none" /><div className="border-t border-border bg-background/45 px-4 py-3 sm:px-5"><p className="text-xs font-bold tracking-[0.12em] text-muted-foreground">TRY AN EXAMPLE</p><div className="mt-2 flex flex-wrap gap-2">{examples.map(example => <button key={example} type="button" disabled={isStreaming || isPreparingDocument} onClick={() => sendQuestion(example)} className="rounded-full border border-teal-200 bg-teal-50/70 px-3 py-1.5 text-left text-xs font-semibold text-teal-800 transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/35 dark:text-teal-200">{example}</button>)}</div></div></div>{error && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}<div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-300" />Your API key and chat history stay on this device.</span><a href={SYLLABUS_SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white"><BookOpenText className="h-3.5 w-3.5" />View official syllabus PDF <ChevronRight className="h-3.5 w-3.5" /></a></div></section></div>
    </main>
  </div>;
}
