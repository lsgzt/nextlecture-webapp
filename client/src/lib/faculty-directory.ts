/**
 * Faculty directory helpers — a faithful port of the NextLecture Android
 * app's FacultyDirectory / FacultyMembersScreen logic (FacultyDirectory.kt):
 * pretty display names, avatar initials, contact-list splitting, the
 * college intercom rule, department chip labels and the canonical
 * department order used by the directory browser and universal search.
 */
import { FACULTY_DIRECTORY, type FacultyMember } from "@/data/faculty-directory";

/** Splits a contact field into the individual values the college published. */
export function splitContacts(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/** True for the college's internal extension numbers ("ext 4531"). */
export function isIntercom(value: string): boolean {
  return value.trim().toLowerCase().startsWith("ext");
}

/**
 * True when a value is a phone number the dialler can actually call.
 * The college's intercom ("ext 4531") only works through its own
 * switchboard, so it must never become a tel: link.
 */
export function isDialablePhone(value: string): boolean {
  if (isIntercom(value)) return false;
  if (!/^[+\- ()\d]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

const HONORIFICS = new Set(["dr", "er", "prof", "professor", "pf", "ms", "mrs", "mr"]);

const HONORIFIC_LABEL: Record<string, string> = {
  dr: "Dr.",
  er: "Er.",
  prof: "Prof.",
  professor: "Prof.",
  pf: "Pf.",
  ms: "Ms.",
  mrs: "Mrs.",
  mr: "Mr.",
};

/** "DR. HARPREET KAUR GREWAL" -> "Dr. Harpreet Kaur Grewal" (Android prettyName). */
export function prettyFacultyName(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => {
      const cleaned = word.replace(/^[.,]+|[.,]+$/g, "");
      const label = HONORIFIC_LABEL[cleaned];
      if (label) return label;
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join(" ");
}

/** Two-letter avatar initials: first letters of the first two non-honorific words. */
export function facultyInitials(name: string): string {
  const words = name
    .split(/[^A-Za-z]+/)
    .filter(word => word.length > 0)
    .map(word => word.replace(/^[.,]+|[.,]+$/g, ""))
    .filter(word => !HONORIFICS.has(word.toLowerCase()));
  const letters = words.map(word => word.charAt(0).toUpperCase());
  return (letters[0] ?? "?") + (letters[1] ?? "");
}

/** Chip label for a department — the full names are far too wide for chips. */
export function shortDepartment(department: string): string {
  const key = department.trim();
  const map: Record<string, string> = {
    "Applied Science": "Applied Science",
    "Information Technology": "IT",
    "Computer Science & Engg.": "CSE",
    "Electrical Engineering": "EE",
    "Mechanical Engineering": "ME",
    "Production Engineering": "M&PE",
    "Civil Engineering": "CE",
    "Electronics & Communication Engineering": "ECE",
    "Business Administration": "MBA",
    "Computer Applications": "MCA",
    "Computer Center": "Computer Center",
    "School of Architecture": "Architecture",
  };
  return map[key] ?? key;
}

const CANONICAL_DEPARTMENTS = [
  "Applied Science",
  "Computer Science & Engg.",
  "Information Technology",
  "Electronics & Communication Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Production Engineering",
  "Civil Engineering",
];

/** Canonical display order: the seven timetable-publishing branches first. */
export function orderedDepartments(departments: string[]): string[] {
  return [...departments].sort((a, b) => {
    const rankA = CANONICAL_DEPARTMENTS.indexOf(a.trim());
    const rankB = CANONICAL_DEPARTMENTS.indexOf(b.trim());
    return (rankA < 0 ? CANONICAL_DEPARTMENTS.length : rankA) - (rankB < 0 ? CANONICAL_DEPARTMENTS.length : rankB) || a.trim().toLowerCase().localeCompare(b.trim().toLowerCase());
  });
}

/** The bundled directory, already ordered for display. */
export const FACULTY_MEMBERS: FacultyMember[] = FACULTY_DIRECTORY;

export const FACULTY_DEPARTMENTS: string[] = orderedDepartments(
  Array.from(new Set(FACULTY_MEMBERS.map(member => member.department).filter(Boolean)))
);

export const FACULTY_DEPARTMENT_COUNTS: Record<string, number> = FACULTY_MEMBERS.reduce<Record<string, number>>((counts, member) => {
  counts[member.department] = (counts[member.department] ?? 0) + 1;
  return counts;
}, {});

export function facultyByProfileId(profileId: string): FacultyMember | null {
  return FACULTY_MEMBERS.find(member => member.profile_id === profileId) ?? null;
}

/**
 * Profile ids that sort to the very top of the directory listing — the
 * teachers students reach for most (mentor / HOD). Everyone else keeps the
 * bundled department-then-name order, so pinned members lead their own
 * department group instead of duplicating it.
 */
export const PINNED_FACULTY_PROFILE_IDS: readonly string[] = ["71"]; // Dr. Harpreet Kaur Grewal

/** Sort rank for a member: 0..n-1 for pinned ids, pinned count otherwise. */
export function facultyPinRank(member: FacultyMember): number {
  const index = PINNED_FACULTY_PROFILE_IDS.indexOf(member.profile_id);
  return index === -1 ? PINNED_FACULTY_PROFILE_IDS.length : index;
}

/** Whether a member is pinned to the top of the directory listing. */
export function isPinnedFaculty(member: FacultyMember): boolean {
  return PINNED_FACULTY_PROFILE_IDS.includes(member.profile_id);
}

export function facultyEmails(member: FacultyMember): string[] {
  return splitContacts(member.email);
}

export function facultyMobileNumbers(member: FacultyMember): string[] {
  return splitContacts(member.phone_mobile);
}

export function facultyOfficeNumbers(member: FacultyMember): string[] {
  return splitContacts(member.phone_office);
}

/** Office numbers that are real lines rather than intercom extensions. */
export function facultyDialableOfficeNumbers(member: FacultyMember): string[] {
  return facultyOfficeNumbers(member).filter(isDialablePhone);
}

/** Search the directory by name, e-mail or phone number (Android filter parity). */
export function filterFaculty(members: FacultyMember[], needle: string, department: string | null): FacultyMember[] {
  const query = needle.trim().toLowerCase();
  return members.filter(member => {
    if (department && member.department !== department) return false;
    if (!query) return true;
    return (
      member.name.toLowerCase().includes(query) ||
      (member.also_published_as ?? []).some(alias => alias.toLowerCase().includes(query)) ||
      facultyEmails(member).some(email => email.toLowerCase().includes(query)) ||
      facultyMobileNumbers(member).some(number => number.includes(query)) ||
      facultyOfficeNumbers(member).some(number => number.includes(query))
    );
  });
}
