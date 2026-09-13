import type { AttendanceRecord } from "@shared/attendance";
import { BookOpenCheck } from "lucide-react";
import { buildSubjectWiseSummaries } from "@/lib/attendance";

type SubjectWiseAttendanceProps = {
  records: AttendanceRecord[];
  target: number;
};

/**
 * Subject-wise attendance breakdown — mirrors Android SubjectSummaryCard.
 * Uses the same present/absent records from the shared attendance backend.
 */
export function SubjectWiseAttendance({ records, target }: SubjectWiseAttendanceProps) {
  const rows = buildSubjectWiseSummaries(records, target);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
          <BookOpenCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">SUBJECT-WISE ATTENDANCE</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Same marks as the Android app, grouped by subject from your synced history.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Mark lectures present or absent to see each subject&apos;s percentage.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {rows.map(row => {
            const belowTarget = row.percentage !== null && row.percentage < target;
            return (
              <li key={row.subject} className="flex items-center gap-3 py-3.5 first:pt-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{row.subject}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {row.present} present · {row.absent} absent
                  </p>
                </div>
                <p
                  className={`shrink-0 font-display text-xl font-semibold tabular-nums ${
                    belowTarget ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-300"
                  }`}
                >
                  {row.percentage === null ? "—" : `${row.percentage}%`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
