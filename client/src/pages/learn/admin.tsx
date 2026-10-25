import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, ChevronDown, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCourse,
  deleteVideo,
  demoTeacher,
  getSession,
  getTeacher,
  listCourses,
  lmsDemo,
  lmsSupabase,
  type Course,
  type Teacher,
  type Video,
} from "@/lib/lms";
import { cn } from "@/lib/utils";
import { EmptyState, Monogram, Reveal } from "./parts";
import { LearnShell } from "./shell";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="learn-eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ eyebrow, value, hint }: { eyebrow: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="learn-card p-6">
      <p className="learn-eyebrow">{eyebrow}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[2.4rem] leading-none font-semibold text-[var(--l-ink)]">{value}</span>
        {hint && <span className="text-[0.78rem] text-[var(--l-ink-3)]">{hint}</span>}
      </div>
    </div>
  );
}

export function Admin() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [courseId, setCourseId] = useState("");
  const [newCourse, setNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "course" | "video"; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = lmsDemo ? null : await getSession().catch(() => null);
      const email = session?.user.email ?? demoTeacher.email;
      const profile = await getTeacher(email);
      if (!active) return;
      setTeacher(profile);
      const all = await listCourses();
      if (!active) return;
      setCourses(all.filter((course) => course.teacher_id === profile?.id));
    })().catch(() => toast.error("Could not load the studio"));
    return () => {
      active = false;
    };
  }, []);

  const totalLessons = useMemo(
    () => (courses ?? []).reduce((sum, course) => sum + (course.videos?.length ?? 0), 0),
    [courses],
  );

  async function fetchTitle() {
    if (!youtubeUrl.trim() || fetchingTitle) return;
    setFetchingTitle(true);
    try {
      const response = await fetch("/api/lms/youtube-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setTitle(data.title);
      toast.success("YouTube title found");
    } catch (error: any) {
      toast.error(error.message ?? "Could not read that YouTube URL");
    } finally {
      setFetchingTitle(false);
    }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!teacher || busy) return;
    setBusy(true);
    try {
      const parsed = new URL(youtubeUrl);
      const youtubeId = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
      if (!youtubeId || !title.trim() || (!newCourse && !courseId)) {
        throw new Error("Add a YouTube URL, a title, and a course.");
      }

      if (lmsDemo) {
        // Sample mode — simulate the insert locally so the flow stays explorable.
        const nowId = `demo-${Date.now()}`;
        let updated = courses ?? [];
        if (newCourse) {
          const fresh: Course = {
            id: nowId,
            teacher_id: teacher.id,
            title: newCourseTitle,
            description,
            published: true,
            teacher,
            videos: [],
          };
          updated = [fresh, ...updated];
        } else {
          updated = updated.map((course) =>
            course.id === courseId
              ? {
                  ...course,
                  videos: [
                    ...(course.videos ?? []),
                    {
                      id: nowId,
                      teacher_id: teacher.id,
                      course_id: course.id,
                      youtube_url: youtubeUrl,
                      youtube_id: youtubeId,
                      title,
                      published: true,
                      position: (course.videos?.length ?? 0) + 1,
                      course,
                      teacher,
                    } as Video,
                  ],
                }
              : course,
          );
        }
        setCourses(updated);
        toast.success("Lesson published (sample mode)");
        setTitle("");
        setYoutubeUrl("");
        setDescription("");
        setNewCourse(false);
        setNewCourseTitle("");
        setCourseId("");
        return;
      }

      if (!lmsSupabase) throw new Error("LMS is not configured.");
      let targetCourse = courseId;
      if (newCourse) {
        const { data, error } = await lmsSupabase
          .from("lms_courses")
          .insert({ teacher_id: teacher.id, title: newCourseTitle, description })
          .select("id")
          .single();
        if (error) throw error;
        targetCourse = data.id;
      }
      const { error } = await lmsSupabase.from("lms_videos").insert({
        teacher_id: teacher.id,
        course_id: targetCourse,
        youtube_url: youtubeUrl,
        youtube_id: youtubeId,
        title,
        published: true,
      });
      if (error) throw error;
      toast.success("Lesson published");
      setTitle("");
      setYoutubeUrl("");
      setDescription("");
      setNewCourse(false);
      setNewCourseTitle("");
      setCourseId("");
      const all = await listCourses();
      setCourses(all.filter((course) => course.teacher_id === teacher.id));
    } catch (error: any) {
      toast.error(error.message ?? "Could not publish lesson");
    } finally {
      setBusy(false);
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (teacher?.name ?? "").replace(/^(Dr\.|Prof\.)\s+/, "").split(" ")[0] || "there";

  async function refreshLibrary() {
    if (!teacher) return;
    const all = await listCourses();
    setCourses(all.filter((course) => course.teacher_id === teacher.id));
  }

  async function removeCourse(courseId: string) {
    if (!teacher || deleting) return;
    setDeleting(true);
    try {
      await deleteCourse(courseId);
      await refreshLibrary();
      toast.success("Course deleted");
    } catch (error: any) {
      toast.error(error.message ?? "Could not delete the course");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  async function removeVideo(videoId: string) {
    if (!teacher || deleting) return;
    setDeleting(true);
    try {
      await deleteVideo(videoId);
      await refreshLibrary();
      toast.success("Lesson deleted");
    } catch (error: any) {
      toast.error(error.message ?? "Could not delete the lesson");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <LearnShell
      role="teacher"
      eyebrow="Teacher studio"
      title={`${greeting}, ${firstName}.`}
      description="Everything you publish here is live for the first-years within moments."
      headAside={
        teacher && (
          <span className="hidden items-center gap-2.5 rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] py-1 pl-1 pr-3.5 sm:flex">
            <Monogram name={teacher.name} className="h-7 w-7 text-[0.6rem]" />
            <span className="text-[0.8rem] font-medium">{teacher.name}</span>
          </span>
        )
      }
    >
      {courses === null ? (
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="learn-card p-6">
              <div className="learn-shimmer h-2.5 w-24" />
              <div className="learn-shimmer mt-4 h-10 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard eyebrow="Courses published" value={String(courses.length).padStart(2, "0")} />
              <StatCard eyebrow="Lessons live" value={String(totalLessons).padStart(2, "0")} hint="across all courses" />
              <Link href="/learn/courses" className="learn-card learn-card-interactive group flex items-center justify-between p-6">
                <div>
                  <p className="learn-eyebrow">Public side</p>
                  <p className="mt-2 font-display text-[1.2rem] font-semibold text-[var(--l-ink)]">See what students see</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] text-[var(--l-green)] transition-transform duration-300 group-hover:-rotate-45">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* ——— your library ——— */}
            <section className="min-w-0">
              <Reveal>
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="learn-eyebrow">Your library</p>
                    <h2 className="mt-2 font-display text-[1.4rem] font-semibold tracking-[-0.01em] text-[var(--l-ink)]">
                      Published courses
                    </h2>
                  </div>
                  <span className="font-mono text-[0.66rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">
                    {String(courses.length).padStart(2, "0")}
                  </span>
                </div>
              </Reveal>
              <div className="space-y-4">
                {courses.map((course, index) => {
                  const lessonCount = course.videos?.length ?? 0;
                  const open = openCourse === course.id;
                  const confirmingCourse = confirmDelete?.type === "course" && confirmDelete.id === course.id;
                  return (
                  <Reveal key={course.id} delay={0.05 * index}>
                    <article className="learn-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--l-ink-3)] uppercase">
                            {String(index + 1).padStart(2, "0")} · course
                          </p>
                          <h3 className="mt-1.5 font-display text-[1.15rem] font-semibold leading-snug text-[var(--l-ink)]">
                            {course.title}
                          </h3>
                          <p className="mt-1 text-[0.8rem] text-[var(--l-ink-3)]">
                            {lessonCount} published {lessonCount === 1 ? "lesson" : "lessons"}
                          </p>
                          {course.videos && lessonCount > 0 && (
                            <p className="mt-2.5 line-clamp-1 text-[0.78rem] text-[var(--l-ink-2)]">
                              <span className="text-[var(--l-ink-3)]">Latest · </span>
                              {course.videos[course.videos.length - 1].title}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={`/learn/courses?course=${course.id}`}
                            title="Open in catalogue"
                            aria-label={`Open ${course.title} in the catalogue`}
                            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] text-[var(--l-ink-2)] transition-colors hover:border-[var(--l-green)] hover:text-[var(--l-green)]"
                          >
                            <ArrowUpRight size={15} />
                          </Link>
                          {!confirmingCourse && (
                            <button
                              type="button"
                              title="Delete course"
                              aria-label={`Delete ${course.title}`}
                              onClick={() => {
                                setConfirmDelete({ type: "course", id: course.id });
                                setOpenCourse(course.id);
                              }}
                              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] text-[var(--l-ink-2)] transition-colors hover:border-[var(--l-amber)] hover:bg-[var(--l-amber-tint)] hover:text-[var(--l-amber)]"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {confirmingCourse && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--l-amber)]/40 bg-[var(--l-amber-tint)] px-4 py-3">
                          <p className="min-w-0 text-[0.8rem] font-medium leading-snug text-[#7A4A16]">
                            Delete “{course.title}” and its {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}? Students lose access immediately — this can’t be undone.
                          </p>
                          <span className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => removeCourse(course.id)}
                              disabled={deleting}
                              className="h-9 rounded-full bg-[var(--l-amber)] px-4 text-[0.75rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                              {deleting ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="learn-btn learn-btn-ghost h-9 px-4 text-[0.75rem]"
                            >
                              Keep it
                            </button>
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenCourse(open ? null : course.id)}
                        aria-expanded={open}
                        className="learn-handlink mt-3.5 flex items-center gap-1.5 text-[0.74rem] font-medium"
                      >
                        {open ? "Hide lessons" : "Manage lessons"}
                        <ChevronDown size={13} className={cn("transition-transform duration-200", open && "rotate-180")} />
                      </button>
                      {open && (
                        <ul className="mt-3 border-t border-[var(--l-line)] pt-1">
                          {course.videos?.map((video) => {
                            const confirmingVideo = confirmDelete?.type === "video" && confirmDelete.id === video.id;
                            return (
                              <li key={video.id} className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--l-line)] py-2.5 last:border-b-0">
                                <Link href={`/learn/watch/${video.id}`} className="group flex min-w-0 items-baseline gap-2.5">
                                  <span className="font-mono text-[0.62rem] text-[var(--l-ink-3)]">
                                    {String(video.position ?? 1).padStart(2, "0")}
                                  </span>
                                  <span className="truncate text-[0.82rem] font-medium text-[var(--l-ink)] transition-colors group-hover:text-[var(--l-green)]">
                                    {video.title}
                                  </span>
                                </Link>
                                {confirmingVideo ? (
                                  <span className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => removeVideo(video.id)}
                                      disabled={deleting}
                                      className="h-7 rounded-full bg-[var(--l-amber)] px-3 text-[0.68rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                    >
                                      {deleting ? "…" : "Delete"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDelete(null)}
                                      className="h-7 rounded-full border border-[var(--l-line)] px-3 text-[0.68rem] font-medium text-[var(--l-ink-2)]"
                                    >
                                      Keep
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    title="Delete lesson"
                                    aria-label={`Delete ${video.title}`}
                                    onClick={() => setConfirmDelete({ type: "video", id: video.id })}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--l-ink-3)] transition-colors hover:bg-[var(--l-amber-tint)] hover:text-[var(--l-amber)]"
                                  >
                                    <Trash2 size={13.5} />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                          {lessonCount === 0 && (
                            <li className="py-3 text-[0.78rem] leading-relaxed text-[var(--l-ink-3)]">
                              No lessons in this course yet — publish the first one from the form on the right.
                            </li>
                          )}
                        </ul>
                      )}
                    </article>
                  </Reveal>
                  );
                })}
                {courses.length === 0 && (
                  <EmptyState
                    icon={Sparkles}
                    title="No courses yet"
                    hint="Publish your first lesson — a course is created automatically when you choose a new title on the right."
                  />
                )}
              </div>
            </section>

            {/* ——— publish form ——— */}
            <Reveal delay={0.1}>
              <aside className="learn-card h-fit p-6 lg:sticky lg:top-24">
                <p className="learn-eyebrow">New lesson</p>
                <h2 className="mt-2 font-display text-[1.3rem] font-semibold text-[var(--l-ink)]">Publish a lesson</h2>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[var(--l-ink-3)]">
                  Paste an unlisted YouTube link — the title is fetched for you.
                </p>

                <form onSubmit={publish} className="mt-6 space-y-4">
                  <Field label="YouTube URL">
                    <input
                      value={youtubeUrl}
                      onChange={(event) => setYoutubeUrl(event.target.value)}
                      onBlur={fetchTitle}
                      required
                      type="url"
                      placeholder="https://youtube.com/watch?v=…"
                      className="learn-input"
                    />
                  </Field>

                  <Field label="Lesson title">
                    <div className="flex gap-2">
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        placeholder="Lecture 05 — …"
                        className="learn-input min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        onClick={fetchTitle}
                        disabled={fetchingTitle}
                        className="learn-btn learn-btn-ghost h-12 shrink-0 px-4 text-[0.8rem]"
                      >
                        {fetchingTitle ? "…" : "Fetch"}
                      </button>
                    </div>
                  </Field>

                  {newCourse ? (
                    <>
                      <Field label="New course title">
                        <input
                          value={newCourseTitle}
                          onChange={(event) => setNewCourseTitle(event.target.value)}
                          required
                          placeholder="Course name"
                          className="learn-input"
                        />
                      </Field>
                      <Field label="Course description">
                        <textarea
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="One or two lines students will see in the catalogue."
                          className="learn-input"
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label="Course">
                      <select
                        value={courseId}
                        onChange={(event) => setCourseId(event.target.value)}
                        required
                        className="learn-input learn-select"
                      >
                        <option value="">Choose an existing course…</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <button
                    type="button"
                    onClick={() => setNewCourse((value) => !value)}
                    className="learn-handlink text-[0.8rem] font-medium"
                  >
                    {newCourse ? "← Use an existing course instead" : "+ Start a new course instead"}
                  </button>

                  <button type="submit" disabled={busy} className="learn-btn learn-btn-primary h-12 w-full">
                    {busy ? "Publishing…" : "Publish lesson"}
                  </button>
                </form>

                <p className="mt-4 text-[0.7rem] leading-5 text-[var(--l-ink-3)]">
                  Students see published lessons immediately. Keep videos unlisted on YouTube if you want the portal to be the only door in.
                </p>
              </aside>
            </Reveal>
          </div>
        </>
      )}
    </LearnShell>
  );
}
