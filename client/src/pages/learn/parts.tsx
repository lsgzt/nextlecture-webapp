import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Link } from "wouter";
import { Compass, Play, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Course, Teacher, Video } from "@/lib/lms";

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : { opacity: 0, y: 14 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={cn("h-full min-w-0", className)} variants={fadeUpItem}>
      {children}
    </motion.div>
  );
}

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

const MONOGRAM_TINTS: Array<[string, string]> = [
  ["#E4EDE6", "#0B5C4A"],
  ["#F4EBD8", "#8A5A16"],
  ["#EDF0DE", "#55612A"],
  ["#F1E5DE", "#7A3B2E"],
  ["#E2EDEA", "#0B5C4A"],
  ["#EFE8E2", "#6B4A2E"],
];

export function Monogram({ name, className }: { name: string; className?: string }) {
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [bg, fg] = MONOGRAM_TINTS[hash % MONOGRAM_TINTS.length];
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-bold select-none", className)}
      style={{ background: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}

/** Per-video duotone fallback so 404ing thumbnails still look intentional. */
function thumbGradient(seed: string) {
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  const palettes = [
    "linear-gradient(135deg, #16302a, #0d5e4d)",
    "linear-gradient(150deg, #223B2F, #0A4A3C)",
    "linear-gradient(120deg, #123230, #0F5546)",
    "linear-gradient(160deg, #1B3229, #0D5E4D)",
  ];
  return palettes[hash];
}

export function VideoCard({ video, index = 1 }: { video: Video; index?: number }) {
  return (
    <Link href={`/learn/watch/${video.id}`} className="group block h-full rounded-[1.1rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--l-green)]">
      <article className="learn-card learn-card-interactive flex h-full flex-col overflow-hidden">
        <div className="learn-thumb aspect-video" style={{ background: thumbGradient(video.id) }}>
          <img
            src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
            className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
          />
          <div className="learn-thumb-veil" />
          <span className="absolute left-3 top-2.5 font-mono text-[0.62rem] font-medium tracking-[0.16em] text-white/75">
            {String(index).padStart(2, "0")}
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <span className="learn-playchip">
              <Play size={14} fill="currentColor" className="ml-0.5" />
            </span>
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="learn-eyebrow truncate">{video.course?.title ?? "Lesson"}</p>
          <h3 className="mt-1.5 line-clamp-2 text-[0.92rem] font-semibold leading-snug text-[var(--l-ink)]">
            {video.title}
          </h3>
          <p className="mt-auto flex items-center gap-1.5 pt-3 text-[0.78rem] text-[var(--l-ink-3)]">
            <UserRound size={13} strokeWidth={1.8} />
            <span className="truncate">{video.teacher?.name ?? "Faculty"}</span>
          </p>
        </div>
      </article>
    </Link>
  );
}

export function CourseCard({ course, index = 1 }: { course: Course; index?: number }) {
  const cover = course.videos?.[0];
  const lessons = course.videos?.length ?? 0;
  return (
    <Link href={`/learn/courses?course=${course.id}`} className="group block h-full rounded-[1.1rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--l-green)]">
      <article className="learn-card learn-card-interactive flex h-full flex-col overflow-hidden">
        <div className="learn-thumb aspect-[16/9]" style={{ background: thumbGradient(course.id) }}>
          {cover && (
            <img
              src={`https://i.ytimg.com/vi/${cover.youtube_id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
              className="h-full w-full object-cover opacity-90 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
            />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(9,34,28,0.82), rgba(9,34,28,0.18) 55%, rgba(9,34,28,0.08))" }} />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className="learn-chip border-white/25 bg-white/10 text-[0.58rem]! text-white/90 backdrop-blur-sm">
              {String(lessons).padStart(2, "0")} lessons
            </span>
            <h3 className="mt-2 font-display text-[1.2rem] font-semibold leading-snug text-[#F5F2E8]">
              {course.title}
            </h3>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="line-clamp-2 text-[0.84rem] leading-relaxed text-[var(--l-ink-2)]">
            {course.description || "A focused course from your learning team."}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-[var(--l-line)] pt-3">
            <span className="flex min-w-0 items-center gap-2 text-[0.8rem] font-medium text-[var(--l-ink-2)]">
              {course.teacher && <Monogram name={course.teacher.name} className="h-6 w-6 text-[0.55rem]" />}
              <span className="truncate">{course.teacher?.name ?? "Faculty"}</span>
            </span>
            <span className="shrink-0 font-mono text-[0.62rem] tracking-[0.14em] text-[var(--l-ink-3)]">
              {String(index).padStart(2, "0")}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function EmptyState({
  icon: Icon = Compass,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[1.1rem] border border-dashed border-[var(--l-line)] bg-[var(--l-surface)]/60 px-8 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--l-tint)] text-[var(--l-green)]">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <p className="font-medium text-[var(--l-ink)]">{title}</p>
      {hint && <p className="max-w-xs text-[0.82rem] leading-relaxed text-[var(--l-ink-3)]">{hint}</p>}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="learn-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[1.4rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--l-ink)]">
          {title}
        </h2>
      </div>
      {aside}
    </Reveal>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="learn-card overflow-hidden">
          <div className="learn-shimmer aspect-video !rounded-none" />
          <div className="space-y-2.5 p-4">
            <div className="learn-shimmer h-2.5 w-3/5" />
            <div className="learn-shimmer h-3.5 w-full" />
            <div className="learn-shimmer h-3.5 w-4/5" />
            <div className="learn-shimmer mt-4 h-2.5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
