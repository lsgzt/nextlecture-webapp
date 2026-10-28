#!/usr/bin/env python3
"""Generate the faculty-attendance demo dataset (client fallback data).

Reads the parsed official timetable + the student directory and emits a
TypeScript module with real, verified data:
- the two provisioned teachers
- their real weekly timetable slots (composite groups joined with '+')
- their real teaching assignments
- a sample of real students per first-year group (10 per group keeps the
  bundle small; D2 groups correctly have no roster)
- a couple of realistic demo sessions

Output: client/src/lib/faculty-attendance-demo.ts
"""
import json
import re

TT = json.load(open("/home/z/analysis/tt-parsed.json"))
SUBS = TT["subgroups"]
STUDENTS = json.load(open("/home/z/analysis/student-directory.json"))

DAY_INDEX = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4}

TEACHERS = {
    "neeraj": {
        "id": "demo-neeraj",
        "full_name": "Neeraj Kumar",
        "email": "neerajkumar735561@gmail.com",
        "department": "Applied Science",
        "designation": "Assistant Professor",
        "profile_id": "402",
        "match": "NEERAJ KUMAR",
    },
    "randhir": {
        "id": "demo-randhir",
        "full_name": "Dr. Randhir Singh",
        "email": "rsingh@gndec.ac.in",
        "department": "Applied Science",
        "designation": "Professor",
        "profile_id": "75",
        "match": "DR RANDHIR SINGH",
    },
}

# Official branch codes, longest first so 3-letter branches (RAI) win.
BRANCHES = ["RAI", "MCA", "MBA", "BCA", "BBA", "CE", "CS", "EC", "EE", "IT", "ME"]


def norm(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())


def cell_matches(cell_teacher, target):
    """True when one of the (possibly comma-joined) teacher labels matches."""
    for part in re.split(r"[,/]", cell_teacher or ""):
        if norm(part) == norm(target):
            return True
    return False


def year_and_branch(group):
    """Derive (year, branch, section) from an official subgroup code.

    CSF1  -> (1, 'CS', 'CSF')      first-year, no prefix
    D2ECA1 -> (2, 'EC', 'ECA')     D{n} prefix = year n
    """
    m = re.match(r"^D(\d)(.+)$", group)
    if m:
        year, rest = int(m.group(1)), m.group(2)
    else:
        year, rest = 1, group
    branch = next((b for b in BRANCHES if rest.startswith(b)), rest[:2])
    section = rest[:-1] if rest[-1].isdigit() else rest
    return year, branch, section


def main():
    slots = []
    assignments = {}

    for teacher_key, teacher in TEACHERS.items():
        # group -> list of lectures taught by this teacher
        by_group = {}
        for g, gd in SUBS.items():
            for l in gd["lectures"]:
                if l["teacher"] and cell_matches(l["teacher"], teacher["match"]):
                    by_group.setdefault(g, []).append(l)
        for g, ls in by_group.items():
            year, branch, section = year_and_branch(g)
            types = sorted({l["lectureType"] or "" for l in ls} - {""})
            assignments.setdefault(teacher_key, []).append({
                "subject": ls[0]["subject"],
                "branch": branch,
                "year": year,
                "section": section,
                "timetable_group": g,
                "lecture_types": ",".join(types),
            })
        # merge identical lectures (same day/time/subject/venue) across groups
        merged = {}
        for g, ls in by_group.items():
            for l in ls:
                key = (l["day"], l["startTime"], l["endTime"], l["subject"], l["lectureType"], l["venue"])
                merged.setdefault(key, []).append(g)
        for (day, start, end, subject, ltype, venue), groups in sorted(
                merged.items(), key=lambda kv: (DAY_INDEX[kv[0][0]], kv[0][1])):
            year, branch, section = year_and_branch(sorted(groups)[0])
            slots.append({
                "teacher": teacher["id"],
                "day_of_week": DAY_INDEX[day],
                "start": start,
                "end": end,
                "subject": subject,
                "branch": branch,
                "year": year,
                "section": section,
                "timetable_group": "+".join(sorted(groups)),
                "lecture_type": ltype or None,
                "venue": venue,
            })

    # roster sample: 10 real students per first-year group of either teacher
    needed_groups = {a["timetable_group"] for lst in assignments.values() for a in lst}
    demo_students = []
    group_counts = {}
    seen_roll = set()
    for s in STUDENTS:
        g = s.get("subsection", "")
        if g not in needed_groups or g.startswith("D"):
            continue
        if group_counts.get(g, 0) >= 10 or s["registrationNumber"] in seen_roll:
            continue
        group_counts[g] = group_counts.get(g, 0) + 1
        seen_roll.add(s["registrationNumber"])
        demo_students.append({
            "roll_number": s["registrationNumber"],
            "crn": s["crn"],
            "full_name": s["candidateName"],
            "branch": s["branch"],
            "year": 1,
            "section": s["section"],
            "subsection": s["subsection"],
            "timetable_group": s["subsection"],
        })

    def ts_teacher(t):
        return (
            f'{{ id: "{TEACHERS[t]["id"]}", full_name: "{TEACHERS[t]["full_name"]}", '
            f'email: "{TEACHERS[t]["email"]}", department: "{TEACHERS[t]["department"]}", '
            f'designation: {json.dumps(TEACHERS[t]["designation"])}, '
            f'profile_id: {json.dumps(TEACHERS[t]["profile_id"])}, '
            f'must_change_password: true, is_active: true }}'
        )

    def ts_slot(s):
        return (
            f'  {{ teacher_id: "{s["teacher"]}", day_of_week: {s["day_of_week"]}, '
            f'start_time: "{s["start"]}", end_time: "{s["end"]}", '
            f'subject_name: "{s["subject"]}", branch: "{s["branch"]}", year: {s["year"]}, '
            f'section: "{s["section"]}", timetable_group: "{s["timetable_group"]}", '
            f'lecture_type: {json.dumps(s["lecture_type"])}, venue: {json.dumps(s["venue"])} }}'
        )

    def ts_assignment(a):
        return (
            f'  {{ subject_name: "{a["subject"]}", branch: "{a["branch"]}", year: {a["year"]}, '
            f'section: "{a["section"]}", timetable_group: "{a["timetable_group"]}", '
            f'lecture_types: "{a["lecture_types"]}" }}'
        )

    def ts_student(s):
        return (
            f'  {{ roll_number: "{s["roll_number"]}", crn: {json.dumps(s["crn"])}, '
            f'full_name: "{s["full_name"]}", branch: "{s["branch"]}", year: {s["year"]}, '
            f'section: "{s["section"]}", subsection: {json.dumps(s["subsection"])}, '
            f'timetable_group: "{s["timetable_group"]}" }}'
        )

    out = []
    out.append("/**")
    out.append(" * Sample dataset for the faculty attendance portal.")
    out.append(" *")
    out.append(" * Used ONLY when the attendance_record Supabase project is not reachable")
    out.append(" * (missing env vars or unapplied migration), mirroring the LMS module's")
    out.append(" * read-only sample mode. Every value below is REAL data extracted from the")
    out.append(" * official GNDEC timetable (17-09-2026 export) and the public first-year")
    out.append(" * student directory — a 10-student sample per first-year group.")
    out.append(" *")
    out.append(" * Generated by scripts/faculty_attendance_demo_data.py — do not edit by hand.")
    out.append(" */")
    out.append("")
    out.append('import type { FacultyTeacher, FacultyStudent, FacultyAssignment, FacultySlot } from "./faculty-attendance-types";')
    out.append("")
    out.append("export const DEMO_TEACHERS: Record<string, FacultyTeacher> = {")
    for key in TEACHERS:
        out.append(f'  "{TEACHERS[key]["id"]}": {ts_teacher(key)},')
    out.append("};")
    out.append("")
    out.append('export const DEMO_TEACHER_BY_EMAIL: Record<string, string> = {')
    for key in TEACHERS:
        out.append(f'  "{TEACHERS[key]["email"]}": "{TEACHERS[key]["id"]}",')
    out.append("};")
    out.append("")
    out.append("export const DEMO_SLOTS: FacultySlot[] = [")
    out.extend(ts_slot(s) + "," for s in slots)
    out.append("];")
    out.append("")
    out.append('export const DEMO_ASSIGNMENTS: Record<string, FacultyAssignment[]> = {')
    for key in TEACHERS:
        out.append(f'  "{TEACHERS[key]["id"]}": [')
        out.extend(ts_assignment(a) + "," for a in sorted(assignments.get(key, []), key=lambda x: (x["subject"], x["timetable_group"])))
        out.append("  ],")
    out.append("};")
    out.append("")
    out.append("export const DEMO_STUDENTS: FacultyStudent[] = [")
    out.extend(ts_student(s) + "," for s in demo_students)
    out.append("];")
    out.append("")

    with open("/home/z/my-project/client/src/lib/faculty-attendance-demo.ts", "w") as f:
        f.write("\n".join(out))

    print(f"teachers: {len(TEACHERS)}")
    print(f"slots: {len(slots)}")
    for key in TEACHERS:
        print(f"  {TEACHERS[key]['full_name']}: {sum(1 for s in slots if s['teacher']==key)} slots, {len(assignments.get(key, []))} assignments")
    print(f"students: {len(demo_students)} across groups: {sorted(group_counts.keys())}")


if __name__ == "__main__":
    main()
