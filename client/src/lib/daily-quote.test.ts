import { describe, expect, it } from "vitest";
import {
  isQuoteFetchDue,
  nextQuoteTriggerAfter,
  quoteDayKey,
  quoteTriggerAt,
} from "@shared/daily-quote";

/**
 * Fixed instants for the 05:32 Asia/Kolkata boundary (IST = UTC+05:30, no DST):
 *   2026-10-26T18:30:00Z = 2026-10-27 00:00 IST  (midnight)
 *   2026-10-27T00:02:00Z = 2026-10-27 05:32 IST  (the boundary itself)
 *   2026-10-27T00:01:00Z = 2026-10-27 05:31 IST  (one minute before)
 *   2026-10-28T00:02:00Z = 2026-10-28 05:32 IST  (tomorrow's boundary)
 */
const OCT27_MIDNIGHT_IST = Date.parse("2026-10-26T18:30:00Z");
const OCT27_BEFORE_BOUNDARY = Date.parse("2026-10-27T00:01:00Z");
const OCT27_BOUNDARY = Date.parse("2026-10-27T00:02:00Z");
const OCT28_BOUNDARY = Date.parse("2026-10-28T00:02:00Z");

describe("quoteDayKey", () => {
  it("uses the IST calendar date, not the device zone", () => {
    expect(quoteDayKey(OCT27_MIDNIGHT_IST)).toBe("2026-10-27");
  });

  it("still belongs to yesterday just before IST midnight", () => {
    expect(quoteDayKey(OCT27_MIDNIGHT_IST - 1)).toBe("2026-10-26");
  });

  it("is zero-padded to yyyy-mm-dd", () => {
    expect(quoteDayKey(Date.parse("2026-01-01T18:30:00Z"))).toBe("2026-01-02");
  });
});

describe("quoteTriggerAt / nextQuoteTriggerAfter", () => {
  it("lands the boundary at 05:32 IST on the instant's IST date", () => {
    expect(quoteTriggerAt(OCT27_MIDNIGHT_IST)).toBe(OCT27_BOUNDARY);
  });

  it("returns today's boundary while it is still ahead", () => {
    expect(nextQuoteTriggerAfter(OCT27_BEFORE_BOUNDARY)).toBe(OCT27_BOUNDARY);
  });

  it("skips to tomorrow's boundary once today's has passed", () => {
    expect(nextQuoteTriggerAfter(OCT27_BOUNDARY)).toBe(OCT28_BOUNDARY);
  });
});

describe("isQuoteFetchDue", () => {
  it("is due when nothing is cached", () => {
    expect(isQuoteFetchDue("", OCT27_MIDNIGHT_IST)).toBe(true);
    expect(isQuoteFetchDue("", OCT27_BEFORE_BOUNDARY)).toBe(true);
  });

  it("is not due again on the same IST day", () => {
    expect(isQuoteFetchDue("2026-10-27", Date.parse("2026-10-27T06:00:00Z"))).toBe(false);
  });

  it("keeps yesterday's quote before the 05:32 refresh", () => {
    expect(isQuoteFetchDue("2026-10-26", OCT27_BEFORE_BOUNDARY)).toBe(false);
  });

  it("becomes due once the 05:32 boundary has passed", () => {
    expect(isQuoteFetchDue("2026-10-26", OCT27_BOUNDARY)).toBe(true);
    expect(isQuoteFetchDue("2026-10-26", OCT27_BOUNDARY + 60_000)).toBe(true);
  });
});
