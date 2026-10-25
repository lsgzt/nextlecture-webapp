import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, BadgeCheck, LogOut } from "lucide-react";
import {
  getOfficialRecord,
  getProgress,
  listCourses,
  listVideos,
  lmsDemo,
  lmsSupabase,
  type OfficialRecord,
  type ProgressRow,
  type Student,
} from "@/lib/lms";
import { Monogram, Reveal, SectionHead } from "./parts";
import { LearnShell, useLmsIdentity } from "./shell";

/** One hairline row of a definition list — label left, value right. */
function RecordRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-dashed border-[var(--l-line)] py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[0.78rem] text-[var(--l-ink-3)]">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[0.88rem] font-medium text-[var(--l-ink)] ${mono ? "font-mono tracking-[0.02em]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

/** Small labeled block used inside the roster card. */
function RecordCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2 sm:col-span-3" : ""}`}>
      <p className="font-mono text-[0.6rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">{label}</p>
      <p className="mt-1.5 break-words text-[0.9rem] font-medium text-[var(--l-ink)]" title={value}>
        {value}
      </p>
    </div>
  );
}

function ShimmerRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 py-1">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-6">
          <div className="learn-shimmer h-2.5 w-24" />
          <div className="learn-shimmer h-3 w-40 max-w-[55%]" />
        </div>
      ))}
    </div>
  );
}

function ProfileBody({ student }: { student: Student }) {
  const [record, setRecord] = useState<OfficialRecord | null | undefined>(undefined);
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [courses, setCourses] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [progressData, videoData, courseData] = await Promise.all([
        getProgress(student.email).catch(() => [] as ProgressRow[]),
        listVideos().catch(() => []),
        listCourses().catch(() => []),
      ]);
      if (!active) return;
      setProgress(progressData);
      setTotal(videoData.length);
      setCourses(courseData.length);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [student.email]);

  useEffect(() => {
    let active = true;
    getOfficialRecord(student.crn)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch(() => {
        if (active) setRecord(null);
      });
    return () => {
      active = false;
    };
  }, [student.crn]);

  const done = (progress ?? []).filter((row) => row.completed).length;
  const loadingStats = progress === null || total === null || courses === null;

  async function logout() {
    if (!lmsDemo && lmsSupabase) await lmsSupabase.auth.signOut().catch(() => undefined);
    window.location.assign("/learn/login");
  }

  return (
    <>
      {/* ——— identity + CRN + stats ——— */}
      <Reveal>
        <div className="grid gap-5 lg:grid-cols-[1.62fr_1fr]">
          <article className="learn-card relative flex flex-col gap-6 p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <Monogram name={student.name} className="h-14 w-14 text-[1.05rem] sm:h-16 sm:w-16 sm:text-[1.15rem]" />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[1.5rem] leading-tight font-semibold tracking-[-0.015em] text-[var(--l-ink)] sm:text-[1.8rem]">
                    {student.name}
                  </h2>
                  <p className="mt-1 truncate text-[0.84rem] text-[var(--l-ink-2)]">
                    {student.branch} · Section {student.section}
                  </p>
                </div>
              </div>
              <span
                className="learn-chip hidden shrink-0 items-center gap-1.5 sm:inline-flex"
                title="This email is on the first-year roster the portal checks at sign-in."
              >
                <BadgeCheck size={12} strokeWidth={2} />
                On the roster
              </span>
            </div>

            <div className="rounded-[0.85rem] border border-dashed border-[var(--l-line)] bg-[var(--l-surface)]/70 p-5">
              <p className="learn-eyebrow">The record you sign in with</p>
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
                <RecordCell label="Full name" value={student.name} />
                <RecordCell label="CRN" value={student.crn} />
                <RecordCell label="Branch" value={student.branch} />
                <RecordCell label="Section" value={student.section} />
                <RecordCell label="Access" value="Student · first year" />
                <RecordCell label="College email" value={student.email} wide />
              </div>
            </div>

            <p className="text-[0.8rem] leading-relaxed text-[var(--l-ink-3)]">
              This is the entry the portal matched when you signed in — it lives on the first-year student list your
              branch maintains. If anything here looks wrong, tell your class coordinator so the roster gets fixed at
              the source.
            </p>
          </article>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <div className="learn-card flex flex-col justify-between bg-[var(--l-tint)] p-6">
              <p className="learn-eyebrow">Class roll number</p>
              <div className="mt-4">
                <span className="font-mono text-[2.6rem] leading-none font-semibold tracking-[0.04em] text-[var(--l-ink)]">
                  {student.crn}
                </span>
                <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--l-ink-2)]">
                  The number your teachers know you by — carry it to every sessional and practical.
                </p>
              </div>
            </div>

            <div className="learn-card flex flex-col p-6">
              <p className="learn-eyebrow">Learning at a glance</p>
              {loadingStats ? (
                <div className="mt-5 space-y-3">
                  <div className="learn-shimmer h-8 w-24" />
                  <div className="learn-shimmer h-1.5 w-full" />
                  <div className="learn-shimmer h-2.5 w-40" />
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-display text-[2.4rem] leading-none font-semibold text-[var(--l-ink)]">
                      {String(done).padStart(2, "0")}
                    </span>
                    <span className="pb-1 text-[0.78rem] text-[var(--l-ink-3)]">/ {total} lessons</span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--l-tint)]">
                    <div
                      className="h-full rounded-full bg-[var(--l-green)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-4 text-[0.8rem] text-[var(--l-ink-2)]">
                    {courses} course{courses === 1 ? "" : "s"} in the library
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ——— official section list ——— */}
      <section className="mt-14">
        <SectionHead
          eyebrow="From the official section list"
          title="Your published entry"
          aside={
            <Link href="/learn/courses" className="learn-handlink text-[0.85rem] font-medium">
              Back to courses
              <ArrowUpRight size={13} className="ml-0.5 inline" />
            </Link>
          }
        />
        <Reveal>
          <div className="learn-card p-6 sm:p-7">
            {record === undefined ? (
              <ShimmerRows count={6} />
            ) : record === null ? (
              <div className="flex flex-col items-start gap-2.5 py-4">
                <p className="text-[0.88rem] font-medium text-[var(--l-ink)]">No published entry for your CRN yet.</p>
                <p className="max-w-lg text-[0.82rem] leading-relaxed text-[var(--l-ink-3)]">
                  The official section list is published separately by the college — your CRN isn't on the current
                  revision. The roster details above still apply, and everything on the portal works as usual.
                </p>
              </div>
            ) : (
              <dl className="grid gap-x-10 md:grid-cols-2">
                <div>
                  <RecordRow label="Registration number" value={record.registrationNumber} mono />
                  <RecordRow label="Subsection" value={record.subsection} />
                  <RecordRow label="Mentoring group" value={record.group} />
                  <RecordRow label="Father's name" value={record.fatherName} />
                  <RecordRow label="Mother's name" value={record.motherName} />
                </div>
                <div className="md:border-l md:border-dashed md:border-[var(--l-line)] md:pl-10">
                  <RecordRow label="Mentor" value={record.mentorName} />
                  <RecordRow label="Mentor mobile" value={record.mentorMobile} mono />
                  <RecordRow label="Venue" value={record.venue} />
                </div>
              </dl>
            )}
            {record && (
              <p className="mt-5 border-t border-dashed border-[var(--l-line)] pt-4 text-[0.76rem] leading-relaxed text-[var(--l-ink-3)]">
                As published in the September 2026 permanent-section list — the same data the NextLecture app uses. It
                only ever appears on your own profile.
              </p>
            )}
          </div>
        </Reveal>
      </section>

      {/* ——— session ——— */}
      <section className="mt-10">
        <Reveal>
          <div className="learn-card flex flex-col items-start justify-between gap-4 bg-[var(--l-tint-2)] p-6 sm:flex-row sm:items-center">
            <div>
              <p className="learn-eyebrow">Signed in as</p>
              <p className="mt-2 text-[0.9rem] font-medium text-[var(--l-ink)]">{student.email}</p>
              <p className="mt-1 text-[0.78rem] text-[var(--l-ink-3)]">
                {lmsDemo ? "Browsing the sample dataset" : "Roster email · student access"}
              </p>
            </div>
            <button onClick={logout} className="learn-btn learn-btn-ghost h-10 text-[0.82rem]">
              <LogOut size={15} strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </Reveal>
      </section>
    </>
  );
}

export function Profile() {
  const identity = useLmsIdentity("student");
  const student = identity?.student ?? null;

  return (
    <LearnShell
      role="student"
      eyebrow="Your record · first year"
      title="The file on you."
      description="Pulled from the first-year roster you sign in with — plus your entry on the official section list."
    >
      {student ? (
        <ProfileBody key={student.email} student={student} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.62fr_1fr]">
          <div className="learn-card p-6 sm:p-7">
            <div className="learn-shimmer h-10 w-48" />
            <div className="mt-5 grid grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <div className="learn-shimmer h-2 w-14" />
                  <div className="learn-shimmer mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <div className="learn-card p-6">
              <div className="learn-shimmer h-2 w-20" />
              <div className="learn-shimmer mt-4 h-10 w-32" />
            </div>
            <div className="learn-card p-6">
              <div className="learn-shimmer h-2 w-24" />
              <div className="learn-shimmer mt-4 h-10 w-28" />
            </div>
          </div>
        </div>
      )}
    </LearnShell>
  );
}
