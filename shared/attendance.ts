export type AttendanceStatus = "present" | "absent";

export type AttendanceRecord = {
  attendance_date: string;
  lecture_key: string;
  status: AttendanceStatus;
  subject: string | null;
  teacher: string | null;
  venue: string | null;
  start_minutes: number;
  end_minutes: number;
  created_at: string;
  updated_at: string;
};

export type AttendanceSummary = {
  present: number;
  absent: number;
  markedTotal: number;
  percentage: number | null;
  target: number;
  affordableMisses: number;
  lecturesToAttend: number | null;
};

export type AttendanceHistory = {
  from: string;
  to: string;
  records: AttendanceRecord[];
  summary: AttendanceSummary;
};

export type AttendanceSession = {
  studentId: string;
  accessToken: string;
  issuedAt: string;
};

export const ATTENDANCE_LEADERBOARD_SCOPES = ["subsection", "section", "branch", "all"] as const;

export type AttendanceLeaderboardScope = (typeof ATTENDANCE_LEADERBOARD_SCOPES)[number];

/**
 * This intentionally contains only presentation-safe leaderboard fields.
 * Attendance records, tokens, fingerprints, CRNs, and registration numbers never enter the UI model.
 */
export type AttendanceLeaderboardEntry = {
  rank: number;
  name: string;
  percentage: number;
  markedTotal: number;
  currentStreak: number;
};

export type AttendanceLeaderboard = {
  scope: AttendanceLeaderboardScope;
  scopeLabel: string;
  participants: number;
  rows: AttendanceLeaderboardEntry[];
  me: AttendanceLeaderboardEntry | null;
};

export type AttendanceRecordInput = {
  attendanceDate: string;
  lectureKey: string;
  status: AttendanceStatus;
  subject: string;
  teacher: string;
  venue: string;
  startMinutes: number;
  endMinutes: number;
};
