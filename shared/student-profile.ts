export const TEMPORARY_SECTION_BRANCHES = ["CE", "CS", "EC", "EE", "IT", "ME", "RAI"] as const;

export type TemporarySectionBranch = (typeof TEMPORARY_SECTION_BRANCHES)[number];

export type StudentProfile = {
  candidateName: string;
  registrationNumber: string;
  /** The official document's serial number, presented to students as roll number. */
  rollNumber: string;
  branch: string;
  temporarySection: string;
  temporarySubsection: string;
  mentorName: string | null;
  source: "official" | "manual";
  sourceUrl: string | null;
  savedAt: number;
};

export type StudentProfileMatch = Pick<
  StudentProfile,
  "candidateName" | "registrationNumber" | "rollNumber" | "branch" | "temporarySection" | "temporarySubsection"
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
