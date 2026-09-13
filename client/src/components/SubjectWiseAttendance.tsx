import type { AttendanceLectureType, AttendanceRecord } from "@shared/attendance";
import { BookOpenCheck, ChevronDown } from "lucide-react";
import { useState } from "react";
import { buildSubjectWiseSummaries } from "@/lib/attendance";

type SubjectWiseAttendanceProps = {
  records: AttendanceRecord[];
  target: number;
};

const TYPE_LABELS: Record<AttendanceLectureType, string> = {
  lecture: "Lecture",
  practical: "Practical",
  tutorial: "Tutorial",
  unspecified: "Legacy / unclassified",
};

/** Subject-wise attendance with an expandable lecture/practical/tutorial breakdown. */
export function SubjectWiseAttendance({ records, target }: SubjectWiseAttendanceProps) {
  const rows = buildSubjectWiseSummaries(records, target);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
          <BookOpenCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">SUBJECT-WISE ATTENDANCE</p>
          <p className="mt-1 text-sm text-muted-foreground">Click a subject to see lecture, practical, and tutorial attendance separately.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">Mark lectures present or absent to see each subject&apos;s percentage.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {rows.map(row => {
            const belowTarget = row.percentage !== null && row.percentage < target;
            const expanded = expandedSubject === row.subject;
            const typeRows = (Object.keys(TYPE_LABELS) as AttendanceLectureType[]).filter(type => row.byType[type].markedTotal > 0);
            return (
              <li key={row.subject} className="py-3.5 first:pt-4">
                <button type="button" className="flex w-full items-center gap-3 text-left" aria-expanded={expanded} onClick={() => setExpandedSubject(expanded ? null : row.subject)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{row.subject}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{row.present} present · {row.absent} absent</p>
                  </div>
                  <p className={`shrink-0 font-display text-xl font-semibold tabular-nums ${belowTarget ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-300"}`}>
                    {row.percentage === null ? "—" : `${row.percentage}%`}
                  </p>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                  {typeRows.map(type => {
                    const typeRow = row.byType[type];
                    const typeBelowTarget = typeRow.percentage !== null && typeRow.percentage < target;
                    return <div key={type} className="rounded-xl bg-muted/45 px-3 py-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[type]}</p>
                      <p className={`mt-1 font-display text-lg font-semibold tabular-nums ${typeBelowTarget ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-300"}`}>{typeRow.percentage === null ? "—" : `${typeRow.percentage}%`}</p>
                      <p className="text-xs text-muted-foreground">{typeRow.present} present · {typeRow.absent} absent</p>
                    </div>;
                  })}
                </div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
