/**
 * Color language for lecture activity types, mirroring the NextLecture
 * Android app: Lecture = green, Practical = blue, Tutorial = orange.
 * Every schedule surface (cards, hero, week rows, search results, legend)
 * reads its accents from here so the three-way color coding stays perfectly
 * consistent.
 */

export type LectureTypeKey = "lecture" | "practical" | "tutorial" | "general";

export type LectureTypeStyle = {
  key: LectureTypeKey;
  /** Human readable label ("Lecture" / "Practical" / "Tutorial"), null when untyped. */
  label: string | null;
  /** Small colored dot (schedule cards, search results, legend). */
  dot: string;
  /** 3px vertical edge bar on schedule cards. */
  edge: string;
  /** Filled chip used inside the teal hero and week cards. */
  chipOnTeal: string;
  /** Soft chip used on light cards. */
  chipOnCard: string;
  /** Plain text color when no chip is used. */
  text: string;
};

function normalizeType(lectureType: string | null | undefined): LectureTypeKey {
  const code = (lectureType ?? "").trim().toUpperCase();
  if (!code) return "general";
  if (code === "L" || code === "LECTURE") return "lecture";
  if (code === "P" || code === "PRACTICAL" || code === "LAB" || code === "PRACTICAL/LAB") return "practical";
  if (code === "T" || code === "TUTORIAL") return "tutorial";
  return "general";
}

const STYLES: Record<LectureTypeKey, LectureTypeStyle> = {
  lecture: {
    key: "lecture",
    label: "Lecture",
    dot: "bg-green-600 dark:bg-green-400",
    edge: "bg-green-600 dark:bg-green-400",
    chipOnTeal: "bg-white/15 text-green-100",
    chipOnCard: "bg-green-50 text-green-700 border border-green-200/80 dark:bg-green-950/45 dark:text-green-300 dark:border-green-900",
    text: "text-green-700 dark:text-green-300",
  },
  practical: {
    key: "practical",
    label: "Practical",
    dot: "bg-blue-600 dark:bg-blue-400",
    edge: "bg-blue-600 dark:bg-blue-400",
    chipOnTeal: "bg-white/15 text-blue-100",
    chipOnCard: "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    text: "text-blue-700 dark:text-blue-300",
  },
  tutorial: {
    key: "tutorial",
    label: "Tutorial",
    dot: "bg-orange-500 dark:bg-orange-400",
    edge: "bg-orange-500 dark:bg-orange-400",
    chipOnTeal: "bg-white/15 text-orange-100",
    chipOnCard: "bg-orange-50 text-orange-700 border border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
    text: "text-orange-700 dark:text-orange-300",
  },
  general: {
    key: "general",
    label: null,
    dot: "bg-slate-400 dark:bg-slate-500",
    edge: "bg-slate-300 dark:bg-slate-600",
    chipOnTeal: "bg-white/15 text-teal-50",
    chipOnCard: "bg-muted text-muted-foreground border border-border",
    text: "text-muted-foreground",
  },
};

export function getLectureTypeStyle(lectureType: string | null | undefined): LectureTypeStyle {
  return STYLES[normalizeType(lectureType)];
}
