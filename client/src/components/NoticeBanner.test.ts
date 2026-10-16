import { describe, expect, it } from "vitest";
import { getActiveNoticeBanners } from "./NoticeBanner";
import { compactNoticeTitle } from "./NoticeReader";
import type { CampusNotice } from "@shared/campus";

function notice(id: string, start: string, until = ""): CampusNotice {
  return {
    id,
    title: `Notice ${id}`,
    publishedDate: start,
    displayDate: start,
    url: "https://gndec.ac.in/",
    author: "",
    source: "GNDEC homepage",
    firstSeenAt: `${start}T08:00:00.000Z`,
    bannerStartDate: start,
    bannerUntilDate: until,
  };
}

describe("compactNoticeTitle", () => {
  it("adds an ellipsis only when the title is shortened", () => {
    expect(compactNoticeTitle("Short title", 20)).toBe("Short title");
    expect(compactNoticeTitle("A notice title that is too long", 20)).toBe(
      "A notice title that..."
    );
  });
});

describe("getActiveNoticeBanners", () => {
  it("shows a notice on its arrival day and the following full day", () => {
    const item = notice("holiday", "2026-10-14", "2026-10-15");
    expect(getActiveNoticeBanners([item], "2026-10-14")).toEqual([item]);
    expect(getActiveNoticeBanners([item], "2026-10-15")).toEqual([item]);
    expect(getActiveNoticeBanners([item], "2026-10-16")).toEqual([]);
  });

  it("keeps every notice that is active on the same day", () => {
    const first = notice("first", "2026-10-14", "2026-10-15");
    const second = notice("second", "2026-10-14", "2026-10-15");
    expect(getActiveNoticeBanners([first, second], "2026-10-15")).toEqual([
      first,
      second,
    ]);
  });

  it("derives the next-day expiry when the backend has no bannerUntilDate", () => {
    const item = notice("fallback", "2026-10-14");
    expect(getActiveNoticeBanners([item], "2026-10-15")).toEqual([item]);
    expect(getActiveNoticeBanners([item], "2026-10-16")).toEqual([]);
  });
});
