import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, LibraryBig, Search } from "lucide-react";
import { toast } from "sonner";
import { listCourses, type Course } from "@/lib/lms";
import { CourseCard, EmptyState, GridSkeleton, Monogram, Reveal, StaggerGrid, StaggerItem, VideoCard } from "./parts";
import { LearnShell } from "./shell";

function CourseSearchBar({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <Reveal className="mb-7">
      <div className="relative">
        <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--l-ink-3)]" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search courses, teachers, subjects…"
          className="learn-input h-[3.25rem] pl-11"
          aria-label="Search courses"
        />
      </div>
    </Reveal>
  );
}

function CourseDrilldown({ course }: { course: Course }) {
  const [, navigate] = useLocation();
  const lessons = course.videos ?? [];
  return (
    <>
      <Reveal>
        <button type="button" onClick={() => navigate("/learn/courses")} className="learn-handlink text-[0.85rem] font-medium">
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeft size={14} />
            The catalogue
          </span>
        </button>
      </Reveal>

      <Reveal delay={0.05} className="mt-6">
        <article className="learn-card overflow-hidden">
          {lessons[0] && (
            <div className="learn-thumb relative h-40 sm:h-48">
              <img
                src={`https://i.ytimg.com/vi/${lessons[0].youtube_id}/maxresdefault.jpg`}
                onError={(event) => {
                  event.currentTarget.src = `https://i.ytimg.com/vi/${lessons[0].youtube_id}/hqdefault.jpg`;
                }}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(9,34,28,0.85), rgba(9,34,28,0.25) 60%, rgba(9,34,28,0.15))" }} />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-6">
                <div>
                  <span className="learn-chip border-white/25 bg-white/10 !text-[0.58rem] text-white/90 backdrop-blur-sm">
                    Course · {String(lessons.length).padStart(2, "0")} lessons
                  </span>
                  <h2 className="mt-2.5 font-display text-[1.7rem] leading-tight font-semibold text-[#F2F0E4]">
                    {course.title}
                  </h2>
                </div>
                {course.teacher && (
                  <span className="flex items-center gap-2.5 rounded-full bg-white/12 px-2.5 py-1.5 backdrop-blur-sm">
                    <Monogram name={course.teacher.name} className="h-7 w-7 text-[0.6rem]" />
                    <span className="pr-1.5 text-[0.8rem] font-medium text-white/90">{course.teacher.name}</span>
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="p-6">
            <p className="max-w-2xl text-[0.9rem] leading-relaxed text-[var(--l-ink-2)]">
              {course.description || "A focused course from your learning team."}
            </p>
            <hr className="learn-rule my-5" />
            <p className="font-mono text-[0.66rem] tracking-[0.18em] text-[var(--l-ink-3)] uppercase">
              Start at lesson 01 and work down — order matters in this one.
            </p>
          </div>
        </article>
      </Reveal>

      <section className="mt-10">
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((video, index) => (
            <StaggerItem key={video.id}>
              <VideoCard video={video} index={index + 1} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </>
  );
}

export function Courses() {
  const search = useSearch();
  const focusCourseId = useMemo(() => new URLSearchParams(search).get("course"), [search]);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(() => {
        toast.error("Could not load the catalogue");
        setCourses([]);
      });
  }, []);

  if (courses === null) {
    return (
      <LearnShell eyebrow="The catalogue" title="Every recorded course, in one place.">
        <CourseSearchBar value={query} onChange={setQuery} />
        <GridSkeleton count={6} />
      </LearnShell>
    );
  }

  if (focusCourseId) {
    const focus = courses.find((course) => course.id === focusCourseId) ?? null;
    if (focus) {
      return (
        <LearnShell>
          <CourseDrilldown course={focus} />
        </LearnShell>
      );
    }
    return (
      <LearnShell>
        <Link href="/learn/courses" className="learn-handlink text-[0.85rem] font-medium">
          ← The catalogue
        </Link>
        <div className="mt-8">
          <EmptyState title="That course has been moved or unpublished" hint="Browse the catalogue for what's live right now." />
        </div>
      </LearnShell>
    );
  }

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? courses.filter((course) => {
        const haystack = [course.title, course.description ?? "", course.teacher?.name ?? "", course.teacher?.department ?? "", course.teacher?.subject ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
    : courses;

  return (
    <LearnShell
      eyebrow="The catalogue"
      title="Every recorded course, in one place."
      description="First-year lectures, arranged by the faculty who teach them. Open a course to see its full run of lessons."
      headAside={
        <span className="font-mono text-[0.66rem] tracking-[0.18em] text-[var(--l-ink-3)] uppercase">
          {String(courses.length).padStart(2, "0")} courses
        </span>
      }
    >
      <CourseSearchBar value={query} onChange={setQuery} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={LibraryBig}
          title={normalized ? `Nothing matches "${query.trim()}"` : "No courses have been published yet"}
          hint={normalized ? "Try a subject, a teacher's name, or the department." : "As soon as faculty publish, their courses land here."}
        />
      ) : (
        <StaggerGrid className="grid gap-5 md:grid-cols-2">
          {filtered.map((course, index) => (
            <StaggerItem key={course.id}>
              <CourseCard course={course} index={index + 1} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </LearnShell>
  );
}
