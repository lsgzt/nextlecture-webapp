/** Shared types for NextLecture announcements (web + Android JSON source). */

export type AnnouncementType = "notice" | "warning" | "info" | string;

export type Announcement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string;
  type?: AnnouncementType;
  active?: boolean;
};

export type AnnouncementsPayload = {
  version?: number;
  announcements?: Announcement[];
};

/** Raw JSON published with the Android app; empty or inactive lists show nothing. */
export const ANNOUNCEMENTS_SOURCE_URL =
  "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/announcements.json";

export function normalizeAnnouncements(payload: unknown): Announcement[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as AnnouncementsPayload).announcements;
  if (!Array.isArray(list) || list.length === 0) return [];

  const active = list
    .filter((item): item is Announcement => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<Announcement>;
      if (row.active === false) return false;
      return typeof row.id === "string" && row.id.length > 0 && typeof row.title === "string" && typeof row.message === "string";
    })
    .sort((a, b) => {
      const left = Date.parse(a.publishedAt) || 0;
      const right = Date.parse(b.publishedAt) || 0;
      return right - left;
    });

  // Web only surfaces the single newest active announcement (not the full history).
  return active.slice(0, 1);
}
