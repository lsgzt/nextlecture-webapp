import { AlertCircle, ExternalLink, FileSearch, LoaderCircle, PencilLine, Save, Search, UserCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { StudentProfile } from "@shared/student-profile";
import { trpc } from "@/lib/trpc";
import { createManualStudentProfile, type ManualStudentProfileFields } from "@/lib/student-profile-storage";

const emptyManualProfile: ManualStudentProfileFields = {
  studentName: "",
  crn: "",
  registrationNumber: "",
  fatherName: "",
  motherName: "",
  section: "",
  subsection: "",
  mentoringGroup: "",
  mentorName: "",
  mentorMobileNumber: "",
  venue: "",
};

export function StudentProfileSetup({ branch, onSaved, onDismiss }: { branch: string; onSaved: (profile: StudentProfile) => void; onDismiss: () => void }) {
  const [name, setName] = useState("");
  const [crn, setCrn] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<ManualStudentProfileFields>(emptyManualProfile);
  const preparationQuery = trpc.temporarySections.prepare.useQuery(
    { branch },
    { enabled: !manualMode, retry: 0, staleTime: 6 * 60 * 60 * 1000 },
  );
  const matchesQuery = trpc.temporarySections.search.useQuery(
    { branch, query: name.trim() || "__" },
    { enabled: !manualMode && preparationQuery.isSuccess && name.trim().length >= 2, retry: 0, staleTime: 6 * 60 * 60 * 1000 },
  );
  const profileQuery = trpc.temporarySections.profile.useQuery(
    { branch, crn: crn ?? "000000" },
    { enabled: Boolean(crn), retry: 0 },
  );

  useEffect(() => {
    const student = profileQuery.data?.student;
    if (student) onSaved({ ...student, savedAt: Date.now() });
  }, [onSaved, profileQuery.data]);

  function saveManualProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaved(createManualStudentProfile(branch, manual));
  }

  const sourceUnavailable = preparationQuery.isError || matchesQuery.isError || profileQuery.isError;

  return (
    <section className="overflow-hidden rounded-3xl border border-teal-200 bg-card shadow-sm dark:border-teal-950/80">
      <div className="border-b border-teal-100 bg-teal-50/65 px-5 py-5 dark:border-teal-950/70 dark:bg-teal-950/20 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white"><UserCheck className="h-5 w-5" /></span>
            <div>
              <p className="eyebrow">FIRST-TIME PROFILE</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.05em]">Find your {branch} section</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Search the official GNDEC 2026 student list by name. Your selected profile is saved only on this device.</p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground" aria-label="Close student profile setup"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="p-5 sm:p-7">
        {!manualMode ? (
          <>
            {preparationQuery.isLoading && <div className="mb-4 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-100"><LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /><span><strong>Preparing the official {branch} list.</strong><br />The first download can take a short while; it is then cached for other students.</span></div>}
            <label className="block text-sm font-semibold">Your name
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={name} disabled={preparationQuery.isLoading || preparationQuery.isError} onChange={event => { setName(event.target.value); setCrn(null); }} placeholder={preparationQuery.isLoading ? "Preparing the official list…" : "Start typing your name"} autoComplete="name" className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:cursor-not-allowed disabled:opacity-60" />
              </div>
            </label>
            {name.trim().length > 0 && name.trim().length < 2 && <p className="mt-2 text-xs text-muted-foreground">Enter at least two letters to search the official list.</p>}
            {matchesQuery.isLoading && <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />Searching the official {branch} document…</div>}
            {matchesQuery.data && <div className="mt-4 rounded-xl border border-border p-2">
              <p className="px-2 pb-2 pt-1 text-xs font-bold tracking-[0.12em] text-muted-foreground">OFFICIAL MATCHES</p>
              {matchesQuery.data.matches.length ? <div className="max-h-64 overflow-y-auto"><div className="grid gap-1">
                {matchesQuery.data.matches.map(match => <button key={match.crn} type="button" disabled={Boolean(crn)} onClick={() => setCrn(match.crn)} className="flex min-h-13 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-teal-50 disabled:opacity-60 dark:hover:bg-teal-950/30">
                  <span><span className="block font-semibold">{match.studentName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{match.subsection} · {match.mentoringGroup ?? "Mentoring group not listed"}</span></span>
                  <span className="shrink-0 text-sm font-bold text-teal-700 dark:text-teal-300">CRN {match.crn}</span>
                </button>)}
              </div></div> : <p className="px-2 py-5 text-sm text-muted-foreground">No official {branch} student matches “{name.trim()}”. Check the spelling or enter the information manually.</p>}
            </div>}
            {crn && <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-100"><LoaderCircle className="h-4 w-4 animate-spin" />Saving the selected official profile…</div>}
            {sourceUnavailable && <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>The official PDF is unavailable right now. You can still save your information manually.</span></div>}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <button type="button" onClick={() => setManualMode(true)} className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white"><PencilLine className="h-4 w-4" />Enter profile manually</button>
              <a href="https://appsc.gndec.ac.in/time_tables" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><FileSearch className="h-4 w-4" />View official source<ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </>
        ) : (
          <form onSubmit={saveManualProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><p className="eyebrow">MANUAL PROFILE</p><h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.04em]">Enter your student details</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Use this when the official document cannot be loaded or your name is not listed. You can update it later.</p></div>
            {([['studentName', 'Full name', 'Your name'], ['crn', 'Class Roll Number (CRN)', 'For example 2621001'], ['registrationNumber', 'Registration number', 'Optional — needed to link Android attendance'], ['fatherName', 'Father name', 'Optional'], ['motherName', 'Mother name', 'Optional'], ['section', 'Section', `For example ${branch}A`], ['subsection', 'Subsection', `For example ${branch}A1`], ['mentoringGroup', 'Mentoring group', 'Optional'], ['mentorName', 'Mentor name', 'Optional'], ['mentorMobileNumber', 'Mentor mobile number', 'Optional'], ['venue', 'Venue', 'Optional']] as const).map(([field, label, placeholder]) => <label key={field} className="block text-sm font-semibold">{label}<input value={manual[field]} onChange={event => setManual(current => ({ ...current, [field]: event.target.value }))} required={field === "studentName" || field === "crn"} placeholder={placeholder} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /></label>)}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.97]"><Save className="h-4 w-4" />Save profile on this device</button><button type="button" onClick={() => setManualMode(false)} className="text-sm font-bold text-teal-700 underline underline-offset-4 dark:text-teal-300">Search official list instead</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
