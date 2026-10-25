import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Coffee } from "lucide-react";
import { toast } from "sonner";
import {
  getProgress,
  getSession,
  getStudent,
  listCourses,
  listVideos,
  lmsDemo,
  demoStudent,
  type Course,
  type ProgressRow,
  type Student,
  type Video,
} from "@/lib/lms";
import { CourseCard, EmptyState, GridSkeleton, Monogram, Reveal, SectionHead, StaggerGrid, StaggerItem, VideoCard } from "./parts";
import { LearnShell } from "./shell";

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateStamp() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
}

export function Dashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = lmsDemo ? null : await getSession().catch(() => null);
      const email = session?.user.email ?? demoStudent.email;
      const [studentData, courseData, videoData, progressData] = await Promise.all([
        getStudent(email).catch(() => null),
        listCourses(),
        listVideos(),
        getProgress(email).catch(() => [] as ProgressRow[]),
      ]);
      if (!active) return;
      setStudent(studentData);
      setCourses(courseData);
      setVideos(videoData);
      setProgress(progressData);
    })().catch(() => toast.error("Could not load your desk"));
    return () => {
      active = false;
    };
  }, []);

  const completed = useMemo(
    () => new Set((progress ?? []).filter((row) => row.completed).map((row) => row.video_id)),
    [progress],
  );

  const resume = useMemo(() => {
    if (!videos) return null;
    const watchMap = new Map((progress ?? []).map((row) => [row.video_id, row]));
    const started = videos
      .filter((video) => watchMap.has(video.id) && !watchMap.get(video.id)!.completed)
      .sort((a, b) => new Date(watchMap.get(b.id)!.last_watched_at).getTime() - new Date(watchMap.get(a.id)!.last_watched_at).getTime());
    return started[0] ?? null;
  }, [videos, progress]);

  const total = videos?.length ?? 0;
  const done = completed.size;
  const loading = videos === null || courses === null || progress === null;

  const firstName = (student?.name ?? "there").split(" ")[0];

  return (
    <LearnShell
      eyebrow="Semester 01 · your desk"
      title={`${greetingForNow()}, ${firstName}.`}
      headAside={
        <span className="hidden font-mono text-[0.66rem] tracking-[0.18em] text-[var(--l-ink-3)] sm:block">
          {formatDateStamp()}
        </span>
      }
    >
      {loading ? (
        <GridSkeleton count={6} />
      ) : total === 0 ? (
        <EmptyState
          icon={Coffee}
          title="Your teachers are still setting up the library"
          hint="Recorded lectures land here as soon as they are published. In the meantime, go meet the faculty."
        />
      ) : (
        <>
          {/* ——— hero row: continue + progress ——— */}
          <Reveal>
            <div className="grid gap-5 lg:grid-cols-[1.62fr_1fr]">
              {resume ? (
                <Link href={`/learn/watch/${resume.id}`} className="group block h-full rounded-[1.1rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--l-green)]">
                  <article className="learn-card learn-card-interactive flex h-full flex-col overflow-hidden sm:flex-row">
                    <div className="learn-thumb relative aspect-video sm:aspect-auto sm:w-[52%]">
                      <img
                        src={`https://i.ytimg.com/vi/${resume.youtube_id}/hqdefault.jpg`}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                        className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      />
                      <div className="learn-thumb-veil" />
                      <span className="learn-chip absolute left-3 top-3 border-white/25 bg-black/35 !text-[0.58rem] text-white/90 backdrop-blur-sm">
                        Continue · {String(resume.position ?? 1).padStart(2, "0")}
                      </span>
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="learn-playchip">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="ml-0.5"><path d="M8 5.5v13l11-6.5z" /></svg>
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <p className="learn-eyebrow">{resume.course?.title ?? "Lesson"}</p>
                      <h3 className="mt-2 line-clamp-2 font-display text-[1.35rem] leading-snug font-semibold text-[var(--l-ink)]">
                        {resume.title}
                      </h3>
                      <p className="mt-2.5 flex items-center gap-2 text-[0.8rem] text-[var(--l-ink-3)]">
                        {resume.teacher && <Monogram name={resume.teacher.name} className="h-6 w-6 text-[0.55rem]" />}
                        {resume.teacher?.name}
                      </p>
                      <div className="mt-auto pt-6">
                        <span className="learn-btn learn-btn-ghost h-10 text-[0.82rem]">
                          Resume lesson
                          <ArrowRight size={15} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ) : (
                <Link href="/learn/courses" className="group block h-full rounded-[1.1rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--l-green)]">
                  <article className="learn-card learn-card-interactive flex h-full flex-col justify-between bg-[var(--l-tint)] p-6 sm:p-7">
                    <div>
                      <p className="learn-eyebrow">Where to begin</p>
                      <h3 className="mt-2 font-display text-[1.35rem] leading-snug font-semibold text-[var(--l-ink)]">
                        Nothing in progress — start the first lecture of the semester.
                      </h3>
                      <p className="mt-3 max-w-sm text-[0.85rem] leading-relaxed text-[var(--l-ink-2)]">
                        {courses.length} courses are waiting in the catalogue. Pick the one whose class you missed most.
                      </p>
                    </div>
                    <div className="mt-6">
                      <span className="learn-btn learn-btn-primary h-10 text-[0.82rem]">
                        Browse the catalogue
                        <ArrowRight size={15} />
                      </span>
                    </div>
                  </article>
                </Link>
              )}

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <div className="learn-card flex flex-col p-6">
                  <p className="learn-eyebrow">Your progress</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-display text-[2.9rem] leading-none font-semibold text-[var(--l-ink)]">
                      {String(done).padStart(2, "0")}
                    </span>
                    <span className="pb-1.5 text-[0.8rem] text-[var(--l-ink-3)]">/ {total} lessons</span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--l-tint)]">
                    <div
                      className="h-full rounded-full bg-[var(--l-green)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-4 text-[0.82rem] leading-relaxed text-[var(--l-ink-2)]">
                    {total - done > 0 ? `${total - done} to go — steady does it.` : "Library complete. Go take a walk."}
                  </p>
                </div>

                <Link href="/learn/teachers" className="learn-card learn-card-interactive group flex items-center justify-between gap-4 bg-[var(--l-tint-2)] p-6">
                  <div>
                    <p className="learn-eyebrow">Faculty</p>
                    <p className="mt-2 font-display text-[1.15rem] font-semibold text-[var(--l-ink)]">Meet your teachers</p>
                    <p className="mt-1 text-[0.8rem] text-[var(--l-ink-2)]">The people recording these lectures</p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] text-[var(--l-green)] transition-transform duration-300 group-hover:-rotate-45">
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* ——— fresh lessons ——— */}
          <section className="mt-14">
            <SectionHead
              eyebrow="Fresh lessons"
              title="Latest in the library"
              aside={
                <Link href="/learn/courses" className="learn-handlink text-[0.85rem] font-medium">
                  All courses
                </Link>
              }
            />
            <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videos!.slice(0, 6).map((video, index) => (
                <StaggerItem key={video.id}>
                  <VideoCard video={video} index={index + 1} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          </section>

          {/* ——— catalogue preview ——— */}
          <section className="mt-14">
            <SectionHead
              eyebrow="From the catalogue"
              title="Worth your evening"
              aside={
                <Link href="/learn/teachers" className="learn-handlink text-[0.85rem] font-medium">
                  Browse teachers
                </Link>
              }
            />
            <StaggerGrid className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {courses!.slice(0, 3).map((course, index) => (
                <StaggerItem key={course.id}>
                  <CourseCard course={course} index={index + 1} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          </section>
        </>
      )}
    </LearnShell>
  );
}
