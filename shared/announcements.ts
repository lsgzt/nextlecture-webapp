/** Shared types for NextLecture announcements (web + Android JSON source). */

export type AnnouncementType =
  | "info"
  | "notice"
  | "warn"
  | "warning"
  | "happy"
  | "celebrate"
  | "urgent"
  | "critical"
  | "alert"
  | "update"
  | "feature"
  | string;

export type Announcement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string;
  type?: AnnouncementType;
  /** Optional URL — when set, the whole card is clickable. */
  link?: string;
  /** Audience filters (empty / "all" = everyone at that level). Comma/;/| lists are OR'd. */
  branch?: string;
  section?: string;
  subsection?: string;
  active?: boolean;
};

export type AnnouncementsPayload = {
  version?: number;
  announcements?: Announcement[];
};

/** Profile fields used for hierarchical audience targeting. */
export type AnnouncementAudience = {
  branch?: string | null;
  section?: string | null;
  subsection?: string | null;
};

/** Canonical visual style after alias normalisation. */
export type AnnouncementStyle =
  | "info"
  | "notice"
  | "warn"
  | "happy"
  | "urgent"
  | "update";

/** Raw JSON published with the Android app; empty or inactive lists show nothing. */
export const ANNOUNCEMENTS_SOURCE_URL =
  "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/announcements.json";

/** Case-insensitive, space/hyphen-insensitive token (matches Android). */
export function normalizeAudienceToken(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s\-_.]/g, "");
}

/**
 * Parse a filter field into a list of normalised tokens.
 * Empty / "all" → empty list (meaning “match everyone”).
 */
export function parseAudienceFilter(raw: string | null | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || normalizeAudienceToken(trimmed) === "all") return [];
  return trimmed
    .split(/[,;|]/)
    .map(part => normalizeAudienceToken(part))
    .filter(Boolean);
}

/**
 * Hierarchical audience match (AND across levels, OR within a level).
 * Matches Android: if the student has no profile, only untargeted announcements apply.
 */
export function matchesAudience(
  announcement: Pick<Announcement, "branch" | "section" | "subsection">,
  audience: AnnouncementAudience | null | undefined,
): boolean {
  const branchFilter = parseAudienceFilter(announcement.branch);
  const sectionFilter = parseAudienceFilter(announcement.section);
  const subsectionFilter = parseAudienceFilter(announcement.subsection);

  const hasAnyFilter =
    branchFilter.length > 0 || sectionFilter.length > 0 || subsectionFilter.length > 0;

  if (!audience) {
    // No profile → only college-wide (untargeted) announcements.
    return !hasAnyFilter;
  }

  const studentBranch = normalizeAudienceToken(audience.branch);
  const studentSection = normalizeAudienceToken(audience.section);
  const studentSubsection = normalizeAudienceToken(audience.subsection);

  if (branchFilter.length > 0) {
    if (!studentBranch || !branchFilter.includes(studentBranch)) return false;
  }
  if (sectionFilter.length > 0) {
    if (!studentSection || !sectionFilter.includes(studentSection)) return false;
  }
  if (subsectionFilter.length > 0) {
    if (!studentSubsection || !subsectionFilter.includes(studentSubsection)) return false;
  }
  return true;
}

/** Map type aliases to a single visual style (matches Android Home card styles). */
export function resolveAnnouncementStyle(type: AnnouncementType | undefined): AnnouncementStyle {
  const t = (type ?? "info").toLowerCase().trim();
  if (t === "warn" || t === "warning") return "warn";
  if (t === "happy" || t === "celebrate") return "happy";
  if (t === "urgent" || t === "critical" || t === "alert") return "urgent";
  if (t === "update" || t === "feature") return "update";
  if (t === "notice") return "notice";
  return "info";
}

function coerceAnnouncement(item: unknown): Announcement | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (row.active === false) return null;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.title !== "string" || !row.title.trim()) return null;
  if (typeof row.message !== "string" || !row.message.trim()) return null;

  const linkRaw = typeof row.link === "string" ? row.link.trim() : "";
  return {
    id: row.id.trim(),
    title: row.title.trim(),
    message: row.message,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : "",
    type: typeof row.type === "string" ? row.type : "info",
    link: linkRaw || undefined,
    branch: typeof row.branch === "string" ? row.branch : undefined,
    section: typeof row.section === "string" ? row.section : undefined,
    subsection: typeof row.subsection === "string" ? row.subsection : undefined,
    active: true,
  };
}

/**
 * Filter active announcements that match the audience, sort newest-first,
 * and return only the single newest match (web surfaces one card).
 */
export function normalizeAnnouncements(
  payload: unknown,
  audience?: AnnouncementAudience | null,
): Announcement[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as AnnouncementsPayload).announcements;
  if (!Array.isArray(list) || list.length === 0) return [];

  const active = list
    .map(coerceAnnouncement)
    .filter((item): item is Announcement => item !== null)
    .filter(item => matchesAudience(item, audience))
    .sort((a, b) => {
      const left = Date.parse(a.publishedAt) || 0;
      const right = Date.parse(b.publishedAt) || 0;
      return right - left;
    });

  return active.slice(0, 1);
}
