import { describe, expect, it } from "vitest";
import { normalizeAnnouncements } from "./announcements";

describe("normalizeAnnouncements", () => {
  it("returns empty when payload has no announcements", () => {
    expect(normalizeAnnouncements({})).toEqual([]);
    expect(normalizeAnnouncements({ announcements: [] })).toEqual([]);
    expect(normalizeAnnouncements(null)).toEqual([]);
  });

  it("keeps only the newest active announcement", () => {
    const result = normalizeAnnouncements({
      version: 1,
      announcements: [
        {
          id: "old",
          title: "Old",
          message: "Earlier",
          publishedAt: "2026-08-01T00:00:00Z",
          active: true,
        },
        {
          id: "inactive",
          title: "Hidden",
          message: "No",
          publishedAt: "2026-09-01T00:00:00Z",
          active: false,
        },
        {
          id: "new",
          title: "New",
          message: "Later",
          publishedAt: "2026-09-06T00:00:00Z",
          active: true,
        },
      ],
    });
    expect(result.map(item => item.id)).toEqual(["new"]);
  });
});
