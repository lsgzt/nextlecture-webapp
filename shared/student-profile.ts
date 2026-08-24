export const TEMPORARY_SECTION_BRANCHES = ["CE", "CS", "EC", "EE", "IT", "ME", "RAI"] as const;

export type TemporarySectionBranch = (typeof TEMPORARY_SECTION_BRANCHES)[number];

export type StudentProfile = {
  studentName: string;
  /** GNDEC's Class Roll Number (CRN) is the official roll number in the revised PDFs. */
  crn: string;
  /** Optional compatibility field used to locate the same attendance owner as NextLecture Android. */
  registrationNumber?: string | null;
  fatherName: string | null;
  motherName: string | null;
  branch: string;
  section: string;
  subsection: string;
  mentoringGroup: string | null;
  mentorName: string | null;
  mentorMobileNumber: string | null;
  venue: string | null;
  source: "official" | "manual";
  sourceUrl: string | null;
  savedAt: number;
};

export type StudentProfileMatch = Pick<
  StudentProfile,
  "studentName" | "crn" | "branch" | "section" | "subsection" | "mentoringGroup"
>;

export type TemporarySectionPayload = {
  branch: TemporarySectionBranch;
  students: StudentProfile[];
};

export type TemporarySectionCacheEnvelope = {
  data: TemporarySectionPayload;
  fetchedAt: number;
  sourceUrl: string;
};
