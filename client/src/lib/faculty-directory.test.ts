import { describe, expect, it } from "vitest";
import {
  facultyInitials,
  isDialablePhone,
  isIntercom,
  prettyFacultyName,
  shortDepartment,
  splitContacts,
} from "./faculty-directory";
import { deriveFacultySchedules, extractFullName, nameScore } from "./faculty-timetable";
import type { FacultyMember } from "@/data/faculty-directory";
import type { GlobalRoomData } from "@shared/vacant-rooms";

describe("prettyFacultyName", () => {
  it("title-cases names and formats honorifics", () => {
    expect(prettyFacultyName("DR. HARPREET KAUR GREWAL")).toBe("Dr. Harpreet Kaur Grewal");
    expect(prettyFacultyName("ER AMANDEEP SINGH")).toBe("Er. Amandeep Singh");
    expect(prettyFacultyName("MS. RAKHI")).toBe("Ms. Rakhi");
  });
});

describe("facultyInitials", () => {
  it("skips honorifics and takes the first two name letters", () => {
    expect(facultyInitials("DR. HARPREET KAUR GREWAL")).toBe("HK");
    expect(facultyInitials("ER. JASWANT SINGH")).toBe("JS");
    expect(facultyInitials("Single")).toBe("S");
  });
});

describe("contact helpers", () => {
  it("splits multi-valued contact fields", () => {
    expect(splitContacts("kds@gndec.ac.in, kds97dee@gmail.com")).toEqual(["kds@gndec.ac.in", "kds97dee@gmail.com"]);
    expect(splitContacts(undefined)).toEqual([]);
  });

  it("recognises the college intercom and refuses to dial it", () => {
    expect(isIntercom("ext 4531")).toBe(true);
    expect(isDialablePhone("ext 4531")).toBe(false);
    expect(isDialablePhone("9814014910")).toBe(true);
    expect(isDialablePhone("0161-5064529")).toBe(true);
  });
});

describe("shortDepartment", () => {
  it("maps long department names to chip labels", () => {
    expect(shortDepartment("Computer Science & Engg.")).toBe("CSE");
    expect(shortDepartment("Electronics & Communication Engineering")).toBe("ECE");
    expect(shortDepartment("Applied Science")).toBe("Applied Science");
  });
});

describe("extractFullName", () => {
  it("splits TOC labels into name and code", () => {
    expect(extractFullName("SSK (Dr. Sehijpal Singh)")).toEqual({ fullName: "Dr. Sehijpal Singh", code: "SSK" });
    expect(extractFullName("Dr. Kanwardeep Singh (KDS)")).toEqual({ fullName: "Dr. Kanwardeep Singh", code: "KDS" });
    expect(extractFullName("DR AMANDEEP KAUR")).toEqual({ fullName: "DR AMANDEEP KAUR", code: null });
    expect(extractFullName("HVS")).toEqual({ fullName: null, code: "HVS" });
  });
});

describe("nameScore", () => {
  it("scores exact, spacing-insensitive and subset matches like the Android matcher", () => {
    expect(nameScore("DR. KULVINDER SINGH MANN", "Dr. Kulwinder Singh Mann")).toBe(70);
    expect(nameScore("AMANDEEP KAUR", "Amandeep Kaur Sohal")).toBe(78);
    expect(nameScore("D S PATHANIA", "DALJEEP SINGH PATHANIA")).toBe(85);
    expect(nameScore("DR AMANDEEP KAUR", "DR AMANDEEP KAUR SOHAL")).toBeLessThan(nameScore("AMANDEEP KAUR SOHAL", "DR AMANDEEP KAUR SOHAL"));
  });
});

describe("deriveFacultySchedules", () => {
  const members: FacultyMember[] = [
    { name: "DR AMANDEEP KAUR SOHAL", designation: "Professor", profile_id: "1", department: "Applied Science", dept_id: 1 },
    { name: "DR KANWARDEEP SINGH", designation: "Professor", profile_id: "2", department: "Computer Science & Engg.", dept_id: 3 },
  ];

  const roomData: GlobalRoomData = {
    sources: [],
    incompleteRoots: [],
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    slotStarts: [540, 600],
    rooms: [
      {
        key: "s204",
        name: "S204",
        occupancy: [
          [
            { busy: true, subject: "Physics", teacher: "DR AMANDEEP KAUR SOHAL" },
            { busy: true, subject: "Coding", teacher: "SSK (Dr. Sehijpal Singh)" },
          ],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
        ],
      },
    ],
    fetchedAtMillis: 0,
  };

  it("assigns a full-name label and a code label to the right teacher", () => {
    // Note: SSK code pass only claims a member whose first initial is S;
    // the fixture above therefore maps SSK to nobody, while the exact
    // name label maps to member 1 — the honest strict behaviour.
    const schedules = deriveFacultySchedules(roomData, members);
    const amandeep = schedules.get("1");
    expect(amandeep).toBeDefined();
    expect(amandeep?.[0]).toMatchObject({ dayIndex: 0, slotIndex: 0, subject: "Physics", room: "S204" });
    // Code pass: SSK starts with S; neither fixture member starts with S.
    expect(schedules.get("2")).toBeUndefined();
  });
});
