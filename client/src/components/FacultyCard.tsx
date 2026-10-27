import { GraduationCap, Phone, UserRound } from "lucide-react";
import type { StudentProfile } from "@shared/student-profile";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

function PersonRow({
  name,
  role,
  detail,
  mobile,
}: {
  name: string;
  role: string;
  detail?: string | null;
  mobile?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
        {initials(name) || <UserRound className="h-4 w-4" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-foreground">{name}</p>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{role}</span>
        </div>
        {detail && <p className="mt-0.5 truncate text-sm text-muted-foreground">{detail}</p>}
      </div>
      {mobile && (
        <a
          href={`tel:${mobile.replace(/[^+\d]/g, "")}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal-200 bg-teal-50 text-teal-700 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-300 dark:hover:bg-teal-950/60"
          aria-label={`Call ${name} on ${mobile}`}
          title={mobile}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/**
 * Faculty details for the signed-in student — mentor and class coordinator
 * straight from the official record, matching the Android app's profile.
 */
export function FacultyCard({ profile, className = "" }: { profile: StudentProfile; className?: string }) {
  const mentorName = profile.mentorName?.trim();
  const coordinatorName = profile.classCoordinator?.trim();
  if (!mentorName && !coordinatorName) return null;

  return (
    <section className={`nl-enter rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 ${className}`} aria-label="Your faculty">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-[-0.035em]">Your faculty</h2>
          <p className="text-xs text-muted-foreground">Mentor and coordinator from your official record</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {mentorName && (
          <PersonRow
            name={mentorName}
            role="Mentor"
            detail={[profile.mentoringGroup, profile.venue].filter(Boolean).join(" · ") || null}
            mobile={profile.mentorMobileNumber || null}
          />
        )}
        {coordinatorName && <PersonRow name={coordinatorName} role="Class coordinator" detail={profile.branch ? `${profile.branch} · ${profile.subsection || profile.section}` : null} />}
      </div>
    </section>
  );
}
