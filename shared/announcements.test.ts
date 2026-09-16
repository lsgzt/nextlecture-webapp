import { describe, expect, it } from "vitest";
import {
  matchesAudience,
  normalizeAnnouncements,
  parseAudienceFilter,
  resolveAnnouncementStyle,
} from "./announcements";

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

  it("preserves link, branch, section, subsection, and type", () => {
    const result = normalizeAnnouncements({
      announcements: [
        {
          id: "it-lab",
          title: "Lab closed",
          message: "OS1 closed",
          publishedAt: "2026-09-16T10:00:00Z",
          type: "warn",
          branch: "IT",
          section: "",
          subsection: "",
          link: "https://example.com/notice",
          active: true,
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].link).toBe("https://example.com/notice");
    expect(result[0].type).toBe("warn");
    expect(result[0].branch).toBe("IT");
  });

  it("filters by audience when profile is provided", () => {
    const payload = {
      announcements: [
        {
          id: "all",
          title: "Everyone",
          message: "Campus note",
          publishedAt: "2026-09-10T00:00:00Z",
          branch: "all",
          active: true,
        },
        {
          id: "it-only",
          title: "IT only",
          message: "IT note",
          publishedAt: "2026-09-16T12:00:00Z",
          branch: "IT",
          active: true,
        },
        {
          id: "cs-only",
          title: "CS only",
          message: "CS note",
          publishedAt: "2026-09-16T13:00:00Z",
          branch: "CS",
          active: true,
        },
      ],
    };

    const forIt = normalizeAnnouncements(payload, { branch: "IT", section: "ITB", subsection: "ITB2" });
    expect(forIt.map(a => a.id)).toEqual(["it-only"]);

    const forCs = normalizeAnnouncements(payload, { branch: "CS" });
    expect(forCs.map(a => a.id)).toEqual(["cs-only"]);

    // Without profile: only untargeted (branch empty/all)
    const noProfile = normalizeAnnouncements(payload, null);
    expect(noProfile.map(a => a.id)).toEqual(["all"]);
  });

  it("matches hierarchical section and subsection (AND across levels)", () => {
    const payload = {
      announcements: [
        {
          id: "itb2",
          title: "ITB2 meet",
          message: "Mentor meeting",
          publishedAt: "2026-09-16T11:00:00Z",
          branch: "IT",
          section: "ITB",
          subsection: "ITB2",
          active: true,
        },
        {
          id: "itb",
          title: "ITB section",
          message: "Section note",
          publishedAt: "2026-09-16T10:00:00Z",
          branch: "IT",
          section: "ITB",
          subsection: "",
          active: true,
        },
      ],
    };

    const itb2 = normalizeAnnouncements(payload, {
      branch: "IT",
      section: "ITB",
      subsection: "ITB2",
    });
    expect(itb2[0].id).toBe("itb2");

    const ita = normalizeAnnouncements(payload, {
      branch: "IT",
      section: "ITA",
      subsection: "ITA1",
    });
    expect(ita).toEqual([]);
  });
});

describe("parseAudienceFilter", () => {
  it("treats empty and all as no filter", () => {
    expect(parseAudienceFilter("")).toEqual([]);
    expect(parseAudienceFilter("all")).toEqual([]);
    expect(parseAudienceFilter("ALL")).toEqual([]);
  });

  it("splits lists and normalises tokens", () => {
    expect(parseAudienceFilter("CS, IT")).toEqual(["cs", "it"]);
    expect(parseAudienceFilter("ITB1; ITB-2 | itb_3")).toEqual(["itb1", "itb2", "itb3"]);
  });
});

describe("matchesAudience", () => {
  it("is case and hyphen insensitive", () => {
    expect(
      matchesAudience(
        { branch: "IT", section: "ITB", subsection: "ITB-2" },
        { branch: "it", section: "itb", subsection: "itb2" },
      ),
    ).toBe(true);
  });
});

describe("resolveAnnouncementStyle", () => {
  it("maps aliases to canonical styles", () => {
    expect(resolveAnnouncementStyle("info")).toBe("info");
    expect(resolveAnnouncementStyle("notice")).toBe("notice");
    expect(resolveAnnouncementStyle("warning")).toBe("warn");
    expect(resolveAnnouncementStyle("warn")).toBe("warn");
    expect(resolveAnnouncementStyle("celebrate")).toBe("happy");
    expect(resolveAnnouncementStyle("happy")).toBe("happy");
    expect(resolveAnnouncementStyle("critical")).toBe("urgent");
    expect(resolveAnnouncementStyle("alert")).toBe("urgent");
    expect(resolveAnnouncementStyle("feature")).toBe("update");
    expect(resolveAnnouncementStyle("update")).toBe("update");
    expect(resolveAnnouncementStyle(undefined)).toBe("info");
  });
});
