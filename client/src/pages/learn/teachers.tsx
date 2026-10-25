import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { listTeachers, listVideos, type Course, type Teacher, type Video } from "@/lib/lms";
import { EmptyState, Monogram, Reveal, StaggerGrid, StaggerItem, VideoCard } from "./parts";
import { LearnShell } from "./shell";

function TeachersSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-[var(--l-line)] bg-[var(--l-surface)]">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-5 border-b border-[var(--l-line)] px-7 py-6 last:border-0">
          <div className="learn-shimmer h-4 w-6" />
          <div className="learn-shimmer h-12 w-12 !rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="learn-shimmer h-4 w-40 max-w-full" />
            <div className="learn-shimmer h-2.5 w-24" />
          </div>
          <div className="learn-shimmer hidden h-7 w-28 !rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);

  useEffect(() => {
    listTeachers()
      .then(setTeachers)
      .catch(() => {
        toast.error("Could not load the faculty directory");
        setTeachers([]);
      });
  }, []);

  return (
    <LearnShell
      eyebrow="Faculty directory"
      title="The people behind the lectures."
      description="Every course in this library is recorded by the faculty who teach it on campus. Open a name to see their shelf."
      headAside={
        teachers ? (
          <span className="font-mono text-[0.66rem] tracking-[0.18em] text-[var(--l-ink-3)] uppercase">
            {String(teachers.length).padStart(2, "0")} educators
          </span>
        ) : undefined
      }
    >
      {teachers === null ? (
        <TeachersSkeleton />
      ) : teachers.length === 0 ? (
        <EmptyState icon={Users} title="No teachers on the roster yet" hint="Once the admin adds faculty, their published lectures appear here." />
      ) : (
        <Reveal>
          <div className="overflow-hidden rounded-[1.1rem] border border-[var(--l-line)] bg-[var(--l-surface)]">
            {teachers.map((teacher, index) => (
              <Link
                key={teacher.id}
                href={`/learn/teachers/${teacher.id}`}
                className="group block border-b border-[var(--l-line)] last:border-0 focus-visible:outline-none"
              >
                <div className="flex items-center gap-4 px-5 py-5 transition-colors duration-200 group-hover:bg-[var(--l-tint-2)] focus-visible:bg-[var(--l-tint-2)] sm:gap-6 sm:px-7">
                  <span className="w-6 shrink-0 font-mono text-[0.66rem] tracking-[0.12em] text-[var(--l-ink-3)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Monogram name={teacher.name} className="h-12 w-12 text-[0.8rem]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[1.15rem] font-semibold leading-tight text-[var(--l-ink)]">
                      {teacher.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[0.8rem] text-[var(--l-ink-3)]">
                      {teacher.department ?? "Faculty"}
                    </p>
                  </div>
                  {teacher.subject && (
                    <span className="learn-chip hidden sm:inline-flex">{teacher.subject}</span>
                  )}
                  <span className="learn-chip sm:hidden">{(teacher.subject ?? teacher.department ?? "").slice(0, 14)}</span>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0 text-[var(--l-ink-3)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--l-green)]"
                  />
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </LearnShell>
  );
}

function TeacherDetail({ id }: { id: string }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listTeachers(), listVideos({ teacherId: id })])
      .then(([teachers, lessons]) => {
        if (!active) return;
        setTeacher(teachers.find((item) => item.id === id) ?? null);
        setVideos(lessons);
      })
      .catch(() => {
        toast.error("Could not load this teacher's lessons");
        setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const grouped = useMemo(() => {
    const map = new Map<string, { course: Course | undefined; videos: Video[] }>();
    (videos ?? []).forEach((video) => {
      const entry = map.get(video.course_id) ?? { course: video.course, videos: [] };
      entry.videos.push(video);
      map.set(video.course_id, entry);
    });
    return Array.from(map.values());
  }, [videos]);

  if (failed) {
    return (
      <LearnShell>
        <EmptyState title="This shelf could not be loaded" hint="Check your connection and try again in a moment." />
      </LearnShell>
    );
  }

  if (teacher === null && videos === null) {
    return (
      <LearnShell>
        <div className="learn-shimmer h-4 w-28" />
        <div className="mt-6 flex items-center gap-5">
          <div className="learn-shimmer h-16 w-16 !rounded-full" />
          <div className="space-y-2.5">
            <div className="learn-shimmer h-7 w-56 max-w-full" />
            <div className="learn-shimmer h-3 w-36" />
          </div>
        </div>
        <div className="mt-12">
          <TeachersSkeleton />
        </div>
      </LearnShell>
    );
  }

  if (!teacher) {
    return (
      <LearnShell>
        <Link href="/learn/teachers" className="learn-handlink text-[0.85rem] font-medium">
          ← All teachers
        </Link>
        <div className="mt-8">
          <EmptyState title="No such teacher on the roster" hint="The link may be outdated — the directory is one tap away." />
        </div>
      </LearnShell>
    );
  }

  const lessonTotal = videos?.length ?? 0;

  return (
    <LearnShell>
      <Reveal>
        <Link href="/learn/teachers" className="learn-handlink text-[0.85rem] font-medium">
          ← All teachers
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          <Monogram name={teacher.name} className="h-16 w-16 text-[1.05rem]" />
          <div className="min-w-0 flex-1">
            <p className="learn-eyebrow">{teacher.department ?? "Faculty"}</p>
            <h1 className="mt-1.5 font-display text-[1.9rem] leading-tight font-semibold tracking-[-0.015em] text-[var(--l-ink)]">
              {teacher.name}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {teacher.subject && <span className="learn-chip">{teacher.subject}</span>}
              <span className="learn-chip border-transparent bg-[var(--l-tint)] text-[var(--l-green)]">
                {String(lessonTotal).padStart(2, "0")} lessons
              </span>
              {teacher.email && (
                <span className="flex items-center gap-1.5 font-mono text-[0.68rem] text-[var(--l-ink-3)]">
                  <Mail size={12} />
                  {teacher.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {grouped.length === 0 ? (
        <div className="mt-12">
          <EmptyState title="No published lessons yet" hint="When this teacher publishes, lectures will appear here first." />
        </div>
      ) : (
        grouped.map((group, groupIndex) => (
          <section className="mt-12" key={group.course?.id ?? groupIndex}>
            <Reveal>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--l-line)] pb-3">
                <h2 className="font-display text-[1.4rem] font-semibold tracking-[-0.01em] text-[var(--l-ink)]">
                  {group.course?.title ?? "Lessons"}
                </h2>
                <span className="font-mono text-[0.66rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">
                  {String(group.videos.length).padStart(2, "0")} lessons
                </span>
              </div>
            </Reveal>
            <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.videos.map((video, index) => (
                <StaggerItem key={video.id}>
                  <VideoCard video={video} index={index + 1} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          </section>
        ))
      )}
    </LearnShell>
  );
}

export { TeacherDetail };
