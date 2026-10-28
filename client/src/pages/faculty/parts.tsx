import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LECTURE_TYPE_LABEL, type LectureType } from "@/lib/faculty-attendance-types";

export const F_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: F_EASE } },
};

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, ease: F_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Portal monogram — the register motif. */
export function FacultyMonogram({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[0.65rem] bg-[var(--f-navy)] text-[#EDF1F4]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ClipboardCheck size={Math.round(size * 0.55)} strokeWidth={1.9} />
    </span>
  );
}

export function lectureTypeChip(type: LectureType | null) {
  if (!type) return null;
  const label = LECTURE_TYPE_LABEL[type];
  const tone = type === "L" ? "bg-[var(--f-tint)] text-[var(--f-green-deep)] border-[color-mix(in_oklab,var(--f-green)_25%,transparent)]"
    : type === "T" ? "bg-[#F0EBDD] text-[#7A5A18] border-[#E2D5AF]"
      : "bg-[#E7EDF6] text-[#2C4A77] border-[#C9D8EC]";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-[0.1rem] font-mono text-[0.6rem] font-medium tracking-[0.12em] uppercase", tone)}>
      {label}
    </span>
  );
}

export function groupChip(group: string) {
  const count = group.split("+").length;
  return (
    <span title={count > 1 ? `Joint class: ${group.split("+").join(", ")}` : group} className="inline-flex items-center rounded-full border border-[var(--f-line)] bg-[var(--f-paper-2)] px-2 py-[0.1rem] font-mono text-[0.62rem] font-medium tracking-[0.08em] text-[var(--f-ink-2)]">
      {group}
    </span>
  );
}

export function attendancePct(present: number, total: number): number {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

export function pctTone(pct: number): string {
  if (pct >= 85) return "text-[var(--f-green)]";
  if (pct >= 70) return "text-[#7A5A18]";
  return "text-[#A23B2E]";
}

export function formatTime12(t: string): string {
  const [hStr, m] = t.split(":");
  let h = Number(hStr);
  const meridiem = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${meridiem}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Day-pill for timetable headers. */
export function DayPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-mono text-[0.68rem] font-semibold tracking-[0.1em] uppercase",
        active ? "bg-[var(--f-navy)] text-white" : "bg-[var(--f-paper-2)] text-[var(--f-ink-3)]",
      )}
    >
      {label}
    </span>
  );
}
