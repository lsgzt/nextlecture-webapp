import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Check, Link2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import {
  demoStudent,
  getProgress,
  getReactionCounts,
  getSession,
  getVideo,
  listVideos,
  lmsDemo,
  lmsSupabase,
  saveProgress,
  setReaction,
  type Video,
} from "@/lib/lms";
import { cn } from "@/lib/utils";
import { EmptyState, Monogram, Reveal } from "./parts";
import { LearnShell } from "./shell";

function WatchSkeleton() {
  return (
    <>
      <div className="learn-shimmer h-4 w-36" />
      <div className="learn-shimmer mt-6 aspect-video w-full !rounded-[1.3rem]" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="learn-shimmer h-3 w-44" />
          <div className="learn-shimmer h-9 w-full max-w-xl" />
          <div className="learn-shimmer h-4 w-56" />
          <div className="learn-shimmer h-11 w-72 !rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <div className="learn-shimmer h-16 w-28 !rounded-lg" />
              <div className="flex-1 space-y-2 py-1">
                <div className="learn-shimmer h-3.5 w-full" />
                <div className="learn-shimmer h-3.5 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Watch({ id }: { id: string }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [missing, setMissing] = useState(false);
  const [reaction, setReactionState] = useState<"like" | "dislike" | null>(null);
  const [counts, setCounts] = useState({ likes: 0, dislikes: 0 });
  const [complete, setComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [upNext, setUpNext] = useState<Video[]>([]);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let active = true;
    setMissing(false);
    setVideo(null);
    (async () => {
      const lesson = await getVideo(id);
      if (!active) return;
      if (!lesson) {
        setMissing(true);
        return;
      }
      setVideo(lesson);
      const session = lmsDemo ? null : await getSession().catch(() => null);
      const account = session?.user.email ?? (lmsDemo ? demoStudent.email : "");
      setEmail(account);
      setCounts(await getReactionCounts(id));
      if (account) {
        const progress = await getProgress(account, id).catch(() => []);
        setComplete(Boolean(progress[0]?.completed));
      }
      const courseVideos = await listVideos({ courseId: lesson.course_id }).catch(() => [] as Video[]);
      if (active) setUpNext(courseVideos);
    })().catch(() => {
      if (active) setMissing(true);
    });

    const channel =
      !lmsDemo && lmsSupabase
        ? lmsSupabase
            .channel(`lms-reactions-${id}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "lms_video_reactions", filter: `video_id=eq.${id}` },
              () => {
                getReactionCounts(id).then(setCounts).catch(() => undefined);
              },
            )
            .subscribe()
        : null;

    return () => {
      active = false;
      if (channel && lmsSupabase) lmsSupabase.removeChannel(channel);
    };
  }, [id]);

  async function react(next: "like" | "dislike") {
    if (!email) return;
    const selected = reaction === next ? null : next;
    try {
      setCounts(await setReaction(email, id, selected));
      setReactionState(selected);
    } catch {
      toast.error("Could not save your reaction");
    }
  }

  async function markComplete() {
    if (!email || marking) return;
    setMarking(true);
    try {
      await saveProgress(email, id, 1, true);
      setComplete(true);
      toast.success("Lesson marked complete");
    } catch {
      toast.error("Could not save progress");
    } finally {
      setMarking(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  if (missing) {
    return (
      <LearnShell>
        <Link href="/learn/courses" className="learn-handlink text-[0.85rem] font-medium">
          ← The catalogue
        </Link>
        <div className="mt-8">
          <EmptyState title="This lesson has been moved or unpublished" hint="The catalogue still has everything that's live right now." />
        </div>
      </LearnShell>
    );
  }

  if (!video) {
    return (
      <LearnShell>
        <WatchSkeleton />
      </LearnShell>
    );
  }

  const courseLabel = video.course?.title ?? "Course";

  return (
    <LearnShell>
      <Reveal>
        <Link href={`/learn/courses?course=${video.course_id}`} className="learn-handlink text-[0.85rem] font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>←</span>
            {courseLabel}
          </span>
        </Link>
      </Reveal>

      <Reveal delay={0.05} className="mt-5">
        <div className="overflow-hidden rounded-[1.3rem] bg-black shadow-[0_28px_60px_-28px_rgba(9,38,31,0.55)] ring-1 ring-black/10">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?rel=0&modestbranding=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Reveal delay={0.1}>
            <p className="learn-eyebrow">
              <span className="learn-eyebrow-strong">Now playing</span>
              <span className="mx-2 text-[var(--l-line)]">·</span>
              {courseLabel}
            </p>
            <h1 className="mt-2.5 font-display text-[1.7rem] leading-[1.18] font-semibold tracking-[-0.015em] text-[var(--l-ink)] sm:text-[2rem]">
              {video.title}
            </h1>
            {video.teacher && (
              <div className="mt-4 flex items-center gap-3">
                <Monogram name={video.teacher.name} className="h-9 w-9 text-[0.62rem]" />
                <div>
                  <p className="text-[0.9rem] font-semibold text-[var(--l-ink)]">{video.teacher.name}</p>
                  <p className="text-[0.76rem] text-[var(--l-ink-3)]">{video.teacher.department ?? "Faculty"}</p>
                </div>
              </div>
            )}
          </Reveal>

          <Reveal delay={0.15} className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => react("like")}
                  aria-pressed={reaction === "like"}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-4 text-[0.8rem] font-semibold transition-colors duration-200",
                    reaction === "like"
                      ? "bg-[var(--l-tint)] text-[var(--l-green)]"
                      : "text-[var(--l-ink-2)] hover:bg-[var(--l-tint-2)] hover:text-[var(--l-ink)]",
                  )}
                >
                  <ThumbsUp size={14} strokeWidth={1.9} fill={reaction === "like" ? "currentColor" : "none"} />
                  <span className="font-mono text-[0.72rem] tabular-nums">{counts.likes}</span>
                </button>
                <div className="h-5 w-px bg-[var(--l-line)]" />
                <button
                  type="button"
                  onClick={() => react("dislike")}
                  aria-pressed={reaction === "dislike"}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-4 text-[0.8rem] font-semibold transition-colors duration-200",
                    reaction === "dislike"
                      ? "bg-[var(--l-amber-tint)] text-[var(--l-amber)]"
                      : "text-[var(--l-ink-2)] hover:bg-[var(--l-tint-2)] hover:text-[var(--l-ink)]",
                  )}
                >
                  <ThumbsDown size={14} strokeWidth={1.9} fill={reaction === "dislike" ? "currentColor" : "none"} />
                  <span className="font-mono text-[0.72rem] tabular-nums">{counts.dislikes}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={markComplete}
                disabled={complete || marking || !email}
                className={cn("learn-btn h-11", complete ? "learn-btn-ghost text-[var(--l-green)]" : "learn-btn-primary")}
              >
                {complete ? (
                  <>
                    <Check size={15} />
                    Completed
                  </>
                ) : marking ? (
                  "Saving…"
                ) : (
                  "Mark complete"
                )}
              </button>

              <button type="button" onClick={copyLink} title="Copy link" aria-label="Copy link" className="learn-btn learn-btn-quiet h-11 w-11 !px-0">
                <Link2 size={15} strokeWidth={1.8} />
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-8 rounded-[1.1rem] border border-dashed border-[var(--l-line)] bg-[var(--l-surface)]/70 p-5">
              <p className="font-mono text-[0.62rem] font-medium tracking-[0.18em] text-[var(--l-ink-3)] uppercase">About this lesson</p>
              <p className="mt-2.5 max-w-xl text-[0.85rem] leading-relaxed text-[var(--l-ink-2)]">
                Watch at your own pace — your progress saves automatically. Completing lessons keeps your desk tidy, and reactions tell teachers which explanations actually land.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <aside>
            <p className="learn-eyebrow mb-3">Up next · {courseLabel}</p>
            <div className="learn-scrolly space-y-1.5 lg:max-h-[34rem] lg:overflow-y-auto lg:pr-2">
              {upNext.map((item) => {
                const current = item.id === id;
                return (
                  <Link
                    key={item.id}
                    href={`/learn/watch/${item.id}`}
                    className={cn(
                      "group flex gap-3 rounded-xl p-2 transition-colors duration-200",
                      current ? "bg-[var(--l-tint)]" : "hover:bg-[var(--l-tint-2)]",
                    )}
                  >
                    <span className="learn-thumb relative block h-[4.2rem] w-[7.4rem] shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={`https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                        className="h-full w-full object-cover"
                      />
                      <span className="learn-thumb-veil" />
                      {current && (
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="rounded-full bg-white/95 px-2 py-0.5 font-mono text-[0.56rem] font-medium tracking-[0.14em] text-[var(--l-green)]">
                            NOW
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="block font-mono text-[0.6rem] tracking-[0.14em] text-[var(--l-ink-3)]">
                        {String(item.position ?? 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "mt-1 line-clamp-2 block text-[0.8rem] leading-snug",
                          current ? "font-semibold text-[var(--l-green)]" : "font-medium text-[var(--l-ink)]",
                        )}
                      >
                        {item.title}
                      </span>
                    </span>
                  </Link>
                );
              })}
              {upNext.length === 0 && (
                <p className="rounded-xl border border-dashed border-[var(--l-line)] p-4 text-[0.8rem] leading-relaxed text-[var(--l-ink-3)]">
                  The rest of this course will appear here as it is published.
                </p>
              )}
            </div>
          </aside>
        </Reveal>
      </div>
    </LearnShell>
  );
}
