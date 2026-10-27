#!/usr/bin/env python3
"""One-shot generator: trims the Android app's bundled faculty directory
(319 teachers, gndec.ac.in public records) into a typed TS data module for
the web client. Mirrors the Android app's approach: the directory ships
inside the app; the web client only re-renders it.

Source: /home/z/my-project/repos/nextlecture-android/app/src/main/res/raw/faculty_directory.json
Output: client/src/data/faculty-directory.ts
"""
import json
import sys
from pathlib import Path

# Optional argument: path to the Android bundle's faculty_directory.json.
# Default points at a sibling clone of the GitLab Android repo.
DEFAULT_SRC = Path(__file__).resolve().parents[1] / "repos/nextlecture-android/app/src/main/res/raw/faculty_directory.json"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
OUT = Path(__file__).resolve().parents[1] / "client/src/data/faculty-directory.ts"

records = json.loads(SRC.read_text(encoding="utf-8"))

KEEP = [
    "name", "designation", "email", "profile_id", "department", "dept_id",
    "profile_url", "image_url", "phone_office", "phone_mobile",
    "admin_roles", "phone_source", "also_published_as",
]

trimmed = []
for record in records:
    entry = {}
    for key in KEEP:
        value = record.get(key)
        if value is None or value == "" or value == []:
            continue
        entry[key] = value
    trimmed.append(entry)

# Sort: canonical department order first, then alphabetical name — same list
# order the Android browser shows.
CANONICAL = [
    "Applied Science", "Computer Science & Engg.", "Information Technology",
    "Electronics & Communication Engineering", "Electrical Engineering",
    "Mechanical Engineering", "Production Engineering", "Civil Engineering",
]

def sort_key(r):
    dept = r.get("department", "").strip()
    try:
        rank = CANONICAL.index(dept)
    except ValueError:
        rank = len(CANONICAL)
    return (rank, r.get("department", "").lower(), r.get("name", "").lower())

trimmed.sort(key=sort_key)

header = '''/**
 * The bundled college faculty directory — 319 teachers with their public
 * contact details (name, photo, designation, e-mail, phone numbers),
 * exactly the dataset the NextLecture Android app ships inside its APK.
 *
 * Static client data by design: the college publishes no faculty API, so
 * the directory is bundled rather than fetched. Profile photos load
 * straight from gndec.ac.in; weekly schedules are derived client-side
 * from the room-occupancy data the vacant-rooms feature already fetches.
 *
 * DO NOT hand-edit: regenerate with scripts/build-faculty-data.py.
 */

export type FacultyMember = {
  name: string;
  designation: string;
  email: string;
  profile_id: string;
  department: string;
  dept_id: number;
  profile_url: string;
  image_url: string;
  phone_office: string;
  phone_mobile: string;
  admin_roles: string;
  phone_source: string;
  also_published_as: string[];
};

export const FACULTY_DIRECTORY: FacultyMember[] = '''

body = json.dumps(trimmed, ensure_ascii=False, indent=2)
tail = ";\n"

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(header + body + tail, encoding="utf-8")

print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(trimmed)} members)")
dept_counts = {}
for r in trimmed:
    dept_counts[r.get("department", "?")] = dept_counts.get(r.get("department", "?"), 0) + 1
for dept, count in dept_counts.items():
    print(f"  {count:>3}  {dept}")
