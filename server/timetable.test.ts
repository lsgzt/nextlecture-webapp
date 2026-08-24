import { describe, expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import { buildTimetableRequestHeaders, discoverTimetableSourceFromIndexHtml, findGroupTimetable, getOfficialTimetable, parseTimetableHtml, resolveTimetableSource, setTimetableCacheForTests, validateOfficialTimetableUrl } from "./timetable";

const SAMPLE_TIMETABLE_HTML = `
  <ul><li>Year BTECH FIRST YEAR CHEMISTRY GROUP<ul><li>Group ITB:<a href="#table_53">ITB2</a></li></ul></li></ul>
  <table id="table_53"><caption><span class="name">ITB2</span></caption>
    <thead><tr><td></td><th class="xAxis">Monday</th><th class="xAxis">Tuesday</th><th class="xAxis">Wednesday</th><th class="xAxis">Thursday</th><th class="xAxis">Friday</th></tr></thead>
    <tbody>
      <tr><th class="yAxis">08:30</th><td><div class="line1"><span class="subject">CHEMISTRY</span><span class="activitytag"> L</span></div><div class="teacher">DR AMANDEEP KAUR</div><div class="room">S205</div></td><td class="empty">---</td><td class="empty">---</td><td class="empty">---</td><td class="empty">---</td></tr>
      <tr><th class="yAxis">09:30</th><td class="empty">---</td><td rowspan="2"><div class="line1"><span class="subject">PROGRAMMING FOR PROBLEM SOLVING</span><span class="activitytag"> P</span></div><div class="teacher">FAC 6 (IT)</div><div class="room">PL1 LAB IT DEPT</div></td><td class="empty">---</td><td class="empty">---</td><td class="empty">---</td></tr>
      <tr><th class="yAxis">10:30</th><td class="empty">---</td><td class="empty">---</td><td class="empty">---</td><td class="empty">---</td></tr>
      <tr class="foot"><td></td><td colspan="5">Timetable generated with FET</td></tr>
    </tbody>
  </table>`;

describe("GNDEC timetable parser", () => {
  it("extracts official group tables, structured lecture fields, and multi-slot end times", () => {
    const parsed = parseTimetableHtml(SAMPLE_TIMETABLE_HTML);
    const timetable = findGroupTimetable(parsed, "itb2");

    expect(parsed.groups).toEqual([{ code: "ITB2", sourceYear: "Year BTECH FIRST YEAR CHEMISTRY GROUP" }]);
    expect(timetable?.lectures).toHaveLength(2);
    expect(timetable?.timeSlots).toEqual(["08:30", "09:30", "10:30"]);
    expect(timetable?.lectures[0]).toMatchObject({
      day: "Monday",
      startTime: "08:30",
      endTime: "09:30",
      subject: "CHEMISTRY",
      teacher: "DR AMANDEEP KAUR",
      venue: "S205",
      lectureType: "L",
      confidence: "structured",
    });
    expect(timetable?.lectures[1]).toMatchObject({
      day: "Tuesday",
      startTime: "09:30",
      endTime: "11:30",
      subject: "PROGRAMMING FOR PROBLEM SOLVING",
    });
  });

  it("rejects a source with no valid timetable tables", () => {
    expect(() => parseTimetableHtml("<html><body>Maintenance</body></html>")).toThrow(
      "did not contain any valid group tables",
    );
  });
});

describe("official-first timetable source resolver", () => {
  const officialIndex = "https://appsc.gndec.ac.in/time_tables";
  const validSource = "https://appsc.gndec.ac.in/sites/default/files/2026-08/current_subgroups_days_horizontal.html";

  function response(body: string, status = 200) {
    return new Response(body, { status, headers: { "Content-Type": "text/html" } });
  }

  afterEach(() => {
    setTimetableCacheForTests(null);
    vi.unstubAllGlobals();
  });

  it("uses the first valid official Sub-section wise anchor and never queries fallback when the index is usable", async () => {
    const fetcher = vi.fn(async () => response(`
      <a href="https://example.com/invalid.html">Sub-section wise Time Table</a>
      <a href="/sites/default/files/2026-08/current_subgroups_days_horizontal.html">Sub-section wise Time Table</a>
      <a href="/sites/default/files/2026-08/older_subgroups_days_horizontal.html">Subsection wise</a>`));

    await expect(resolveTimetableSource({ fetcher, officialIndexUrl: officialIndex, fallbackApiUrl: "https://fallback.example/api" })).resolves.toMatchObject({
      url: validSource,
      source: "official-index",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(officialIndex, expect.any(Object));
  });

  it("uses a validated public fallback only after official discovery fails", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response("maintenance", 503))
      .mockResolvedValueOnce(response(JSON.stringify({ url: validSource })));

    await expect(resolveTimetableSource({ fetcher, officialIndexUrl: officialIndex, fallbackApiUrl: "https://fallback.example/api" })).resolves.toMatchObject({
      url: validSource,
      source: "vercel-fallback",
    });
    expect(fetcher).toHaveBeenNthCalledWith(1, officialIndex, expect.any(Object));
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://fallback.example/api", expect.any(Object));
  });

  it("retains a previously valid source when both discovery mechanisms fail or return invalid URLs", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response("maintenance", 503))
      .mockResolvedValueOnce(response(JSON.stringify({ url: "https://evil.example/timetable.html" })));

    await expect(resolveTimetableSource({ fetcher, officialIndexUrl: officialIndex, fallbackApiUrl: "https://fallback.example/api", lastKnownSourceUrl: validSource })).resolves.toMatchObject({
      url: validSource,
      source: "last-known-good",
    });
  });

  it("rejects untrusted, non-HTTPS, redirected, and non-HTML URL candidates", () => {
    expect(validateOfficialTimetableUrl("javascript:alert(1)")).toBeNull();
    expect(validateOfficialTimetableUrl("http://appsc.gndec.ac.in/file.html")).toBeNull();
    expect(validateOfficialTimetableUrl("https://example.com/file.html")).toBeNull();
    expect(validateOfficialTimetableUrl("https://appsc.gndec.ac.in/file.pdf")).toBeNull();
  });

  it("clears conditional validators when the source URL changes and retains them when it does not", () => {
    const previous = {
      data: { groups: [], timetables: [], sourceGeneratedAt: null },
      fetchedAt: 1,
      sourceUrl: validSource,
      validators: { etag: "old-etag", lastModified: "Wed, 21 Oct 2015 07:28:00 GMT" },
    };
    expect(buildTimetableRequestHeaders(previous, validSource)).toMatchObject({ "If-None-Match": "old-etag", "If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" });
    expect(buildTimetableRequestHeaders(previous, "https://appsc.gndec.ac.in/sites/default/files/2026-09/future.html")).not.toHaveProperty("If-None-Match");
  });

  it("parses the first usable subsection link in document order", () => {
    expect(discoverTimetableSourceFromIndexHtml(`<a href="/bad.pdf">Sub-section wise</a><a href="/sites/default/files/2026-08/current_subgroups_days_horizontal.html">Subsection wise</a>`, officialIndex)).toBe(validSource);
  });

  it("returns a fresh cached timetable immediately while source resolution proceeds in the background", async () => {
    const cached = {
      data: parseTimetableHtml(SAMPLE_TIMETABLE_HTML),
      fetchedAt: Date.now(),
      sourceUrl: validSource,
    };
    setTimetableCacheForTests(cached);
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", fetcher);

    await expect(getOfficialTimetable(false, "ITB2")).resolves.toMatchObject({ cache: cached, freshness: "fresh", updateError: null });
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledWith(officialIndex, expect.any(Object));
  });

  it("keeps the last known good cache when forced source resolution and refresh fail", async () => {
    const cached = {
      data: parseTimetableHtml(SAMPLE_TIMETABLE_HTML),
      fetchedAt: 0,
      sourceUrl: validSource,
      validators: { etag: "good-etag", lastModified: null },
    };
    setTimetableCacheForTests(cached);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("upstream offline"); }));

    await expect(getOfficialTimetable(true, "ITB2")).resolves.toMatchObject({ cache: cached, freshness: "stale", updateError: expect.stringContaining("upstream offline") });
  });
});
