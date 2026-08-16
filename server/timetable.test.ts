import { describe, expect, it } from "vitest";
import { findGroupTimetable, parseTimetableHtml } from "./timetable";

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
