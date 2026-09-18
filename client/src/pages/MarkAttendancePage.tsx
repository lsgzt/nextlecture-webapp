import { CheckCircle2, ClipboardCopy, Link2, LoaderCircle, Search, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { TEMPORARY_SECTION_BRANCHES, type TemporarySectionBranch } from "@shared/student-profile";
import { trpc } from "@/lib/trpc";
import { ThemeToggle } from "@/components/ThemeToggle";

function CreateSessionPanel() {
  const [subjectName, setSubjectName] = useState("");
  const [branch, setBranch] = useState<TemporarySectionBranch>("IT");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createMutation = trpc.markAttendance.createSession.useMutation({
    onSuccess: data => {
      const url = `${window.location.origin}/mark-attendance/${data.id}`;
      setShareUrl(url);
      setCopied(false);
    },
  });

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    createMutation.mutate({ subjectName: subjectName.trim(), branch });
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-teal-200 bg-card shadow-sm dark:border-teal-950/80">
      <div className="border-b border-teal-100 bg-teal-50/65 px-5 py-5 dark:border-teal-950/70 dark:bg-teal-950/20 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow">QUICK ATTENDANCE</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.05em]">Create a mark-present link</h1>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Add the subject, pick the branch, then share the link in WhatsApp. Students search their official name and mark present. This is separate from the regular attendance tracker.
            </p>
          </div>
        </div>
      </div>
      <form onSubmit={handleCreate} className="grid gap-4 p-5 sm:p-7">
        <label className="block text-sm font-semibold">
          Subject name
          <input
            value={subjectName}
            onChange={e => setSubjectName(e.target.value)}
            placeholder="e.g. Chemistry, Math II"
            required
            minLength={2}
            maxLength={80}
            className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
          />
        </label>
        <label className="block text-sm font-semibold">
          Branch (for name lookup)
          <select
            value={branch}
            onChange={e => setBranch(e.target.value as TemporarySectionBranch)}
            className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
          >
            {TEMPORARY_SECTION_BRANCHES.map(b => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending || subjectName.trim().length < 2}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 active:scale-[0.97]"
        >
          {createMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create shareable link
        </button>
        {createMutation.isError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
            {createMutation.error.message}
          </p>
        )}
        {shareUrl && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 dark:border-teal-900/60 dark:bg-teal-950/25">
            <p className="text-xs font-bold tracking-[0.12em] text-teal-800 dark:text-teal-200">SHARE THIS LINK</p>
            <p className="mt-2 break-all text-sm font-medium text-teal-950 dark:text-teal-50">{shareUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={shareUrl}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100"
              >
                Open session
              </a>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

function SessionPanel({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("");
  const [selectedCrn, setSelectedCrn] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  const sessionQuery = trpc.markAttendance.getSession.useQuery(
    { sessionId },
    { refetchInterval: 8_000, retry: 1 },
  );

  const branch = sessionQuery.data?.branch ?? "IT";

  const preparationQuery = trpc.temporarySections.prepare.useQuery(
    { branch },
    { enabled: Boolean(sessionQuery.data), retry: 0, staleTime: 6 * 60 * 60 * 1000 },
  );

  const matchesQuery = trpc.temporarySections.search.useQuery(
    { branch, query: name.trim() || "__" },
    {
      enabled: Boolean(sessionQuery.data) && preparationQuery.isSuccess && name.trim().length >= 2,
      retry: 0,
      staleTime: 6 * 60 * 60 * 1000,
    },
  );

  const markMutation = trpc.markAttendance.markPresent.useMutation({
    onSuccess: () => {
      setMarked(true);
      void sessionQuery.refetch();
    },
  });

  const selectedMatch = useMemo(() => {
    if (!selectedCrn || !matchesQuery.data) return null;
    return matchesQuery.data.matches.find(m => m.crn === selectedCrn) ?? null;
  }, [selectedCrn, matchesQuery.data]);

  useEffect(() => {
    setSelectedCrn(null);
  }, [name]);

  function submitMark(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMatch) return;
    markMutation.mutate({
      sessionId,
      studentName: selectedMatch.studentName,
      crn: selectedMatch.crn,
    });
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />
        Loading attendance session…
      </div>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/25">
        <p className="font-display text-xl font-semibold">Link not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {sessionQuery.error?.message ?? "This attendance link is invalid or has expired."}
        </p>
        <Link href="/mark-attendance" className="mt-4 inline-block text-sm font-bold text-teal-700 underline underline-offset-4">
          Create a new session
        </Link>
      </section>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <section className="overflow-hidden rounded-3xl border border-teal-200 bg-card shadow-sm dark:border-teal-950/80">
        <div className="border-b border-teal-100 bg-teal-50/65 px-5 py-5 dark:border-teal-950/70 dark:bg-teal-950/20 sm:px-7">
          <p className="eyebrow">MARK PRESENT · {session.branch}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.05em]">{session.subjectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search your name from the official list, then mark present. {session.presentCount} student
            {session.presentCount === 1 ? "" : "s"} marked so far.
          </p>
        </div>

        <div className="p-5 sm:p-7">
          {marked ? (
            <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-100">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">You&apos;re marked present.</p>
                <p className="mt-1 text-teal-800/80 dark:text-teal-100/80">
                  Your name and CRN are on the list below. You can close this page.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submitMark} className="grid gap-4">
              {preparationQuery.isLoading && (
                <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-100">
                  <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <span>Preparing the official {session.branch} student list…</span>
                </div>
              )}
              <label className="block text-sm font-semibold">
                Your name
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={name}
                    disabled={preparationQuery.isLoading || preparationQuery.isError}
                    onChange={e => setName(e.target.value)}
                    placeholder={preparationQuery.isLoading ? "Preparing the official list…" : "Start typing your name"}
                    autoComplete="name"
                    className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </label>
              {name.trim().length > 0 && name.trim().length < 2 && (
                <p className="text-xs text-muted-foreground">Enter at least two letters to search.</p>
              )}
              {matchesQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />
                  Searching…
                </div>
              )}
              {matchesQuery.data && (
                <div className="rounded-xl border border-border p-2">
                  <p className="px-2 pb-2 pt-1 text-xs font-bold tracking-[0.12em] text-muted-foreground">OFFICIAL MATCHES</p>
                  {matchesQuery.data.matches.length ? (
                    <div className="max-h-64 overflow-y-auto">
                      <div className="grid gap-1">
                        {matchesQuery.data.matches.map(match => (
                          <button
                            key={match.crn}
                            type="button"
                            onClick={() => setSelectedCrn(match.crn)}
                            className={`flex min-h-13 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                              selectedCrn === match.crn
                                ? "bg-teal-100 ring-2 ring-teal-600 dark:bg-teal-950/50"
                                : "hover:bg-teal-50 dark:hover:bg-teal-950/30"
                            }`}
                          >
                            <span>
                              <span className="block font-semibold">{match.studentName}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {match.subsection} · {match.mentoringGroup ?? "Mentoring group not listed"}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-bold text-teal-700 dark:text-teal-300">CRN {match.crn}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="px-2 py-5 text-sm text-muted-foreground">
                      No official {session.branch} matches for “{name.trim()}”. Check the spelling.
                    </p>
                  )}
                </div>
              )}
              {preparationQuery.isError && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                  Official list is temporarily unavailable. Try again in a moment.
                </p>
              )}
              <button
                type="submit"
                disabled={!selectedMatch || markMutation.isPending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 active:scale-[0.97]"
              >
                {markMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Mark me present
              </button>
              {markMutation.isError && (
                <p className="text-sm text-amber-800 dark:text-amber-200">{markMutation.error.message}</p>
              )}
            </form>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-700" />
            <h2 className="font-display text-lg font-semibold tracking-[-0.04em]">Present list</h2>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
            {session.presentCount}
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {session.attendees.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-7">No one has marked present yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {session.attendees.map((a, index) => (
                <li key={a.crn} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-7">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      <span className="mr-2 text-xs font-bold text-muted-foreground">{index + 1}.</span>
                      {a.studentName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-teal-700 dark:text-teal-300">CRN {a.crn}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MarkAttendancePage() {
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="container flex h-16 items-center justify-between border-b border-border/40">
        <Link href="/" className="font-display text-[1.05rem] font-semibold tracking-[-0.04em]">
          NextLecture
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!sessionId && (
            <Link href="/app" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Open app
            </Link>
          )}
        </div>
      </header>
      <main className="container py-8 sm:py-12">{sessionId ? <SessionPanel sessionId={sessionId} /> : <CreateSessionPanel />}</main>
    </div>
  );
}
