import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { changeTeacherPassword, listSessions } from "@/lib/faculty-attendance";
import { prettySubject, type AttendanceSession } from "@/lib/faculty-attendance-types";
import { FacultyShell, useFacultyIdentity } from "./shell";
import { attendancePct, fadeUpItem, pctTone, staggerParent } from "./parts";

export function FacultyProfile() {
  const identity = useFacultyIdentity();
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    listSessions(identity.teacher.id, { limit: 400 })
      .then((rows) => active && setSessions(rows))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load your history."));
    return () => {
      active = false;
    };
  }, [identity]);

  if (!identity) return <ProfileSkeleton />;

  return (
    <FacultyShell identity={identity}>
      {error ? (
        <div className="f-card mx-auto max-w-lg p-8 text-center">
          <p className="text-[0.95rem] font-semibold">The profile could not be loaded.</p>
          <p className="mt-2 text-[0.85rem] text-[var(--f-ink-2)]">{error}</p>
        </div>
      ) : (
        <ProfileBody sessions={sessions} />
      )}
    </FacultyShell>
  );
}

function ProfileSkeleton() {
  return (
    <div className="f-scope grid min-h-screen place-items-center bg-[var(--f-paper)]">
      <div className="flex items-center gap-3 text-[var(--f-ink-2)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--f-line)] border-t-[var(--f-navy)]" />
        <span className="font-mono text-[0.8rem] tracking-[0.12em] uppercase">Loading profile…</span>
      </div>
    </div>
  );
}

function ProfileBody({ sessions }: { sessions: AttendanceSession[] | null }) {
  const identity = useFacultyIdentity();
  const { teacher, mode } = identity ?? { teacher: null, mode: null };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);

  const summary = useMemo(() => {
    if (!sessions) return null;
    const subjects = new Map<string, { present: number; total: number; classes: number }>();
    for (const s of sessions) {
      const row = subjects.get(s.subject_name) ?? { present: 0, total: 0, classes: 0 };
      row.present += s.present_count;
      row.total += s.total_students;
      row.classes += 1;
      subjects.set(s.subject_name, row);
    }
    return {
      classes: sessions.length,
      subjects: Array.from(subjects.entries()).sort((a, b) => b[1].classes - a[1].classes),
      firstDate: sessions.length ? sessions[sessions.length - 1].attendance_date : null,
    };
  }, [sessions]);

  if (!teacher) return null;

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 6) {
      toast.error("Choose a password of at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("The new password and its confirmation do not match.");
      return;
    }
    if (next === current) {
      toast.error("The new password must be different from the current one.");
      return;
    }
    setBusy(true);
    try {
      await changeTeacherPassword(next);
      setChanged(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated. Use it the next time you sign in.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  const initials = teacher.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* identity card */}
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="f-card f-grain relative overflow-hidden bg-[var(--f-navy)] p-7 text-[#E9EEF2]">
        <div className="relative z-10 flex flex-wrap items-center gap-5">
          <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 font-display text-[1.6rem] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="f-eyebrow !text-[#8FB3C9]">Faculty profile</p>
            <h1 className="mt-1.5 font-display text-[1.8rem] leading-tight font-semibold tracking-[-0.015em] text-white">{teacher.full_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.82rem] text-[#B9CBDA]">
              <span className="flex items-center gap-1.5"><UserRound size={13} />{teacher.designation ?? "Faculty"}</span>
              {teacher.department ? <span className="flex items-center gap-1.5"><Building2 size={13} />{teacher.department}</span> : null}
              <span className="flex items-center gap-1.5"><Mail size={13} />{teacher.email}</span>
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            {teacher.is_active ? (
              <span className="flex items-center gap-1.5 rounded-full border border-[#7CC6A4]/30 bg-[#7CC6A4]/10 px-3 py-1.5 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[#7CC6A4] uppercase">
                <BadgeCheck size={12} />
                Active
              </span>
            ) : null}
            <span className="font-mono text-[0.62rem] tracking-[0.1em] text-[#8FB3C9]">
              {mode === "live" ? "attendance_record · live" : mode === "auth-only" ? "attendance_record · auth only" : "sample environment"}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
        {/* stats */}
        <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={fadeUpItem} className="f-card p-5">
            <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold">
              <GraduationCap size={16} className="text-[var(--f-green)]" />
              Teaching record
            </h2>
            {summary ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--f-paper-2)] p-3.5">
                    <p className="f-eyebrow !text-[0.56rem]">Classes recorded</p>
                    <p className="mt-1.5 font-display text-[1.7rem] leading-none font-semibold">{summary.classes}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--f-paper-2)] p-3.5">
                    <p className="f-eyebrow !text-[0.56rem]">Subjects</p>
                    <p className="mt-1.5 font-display text-[1.7rem] leading-none font-semibold">{summary.subjects.length}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {summary.subjects.map(([subject, row]) => (
                    <div key={subject} className="flex items-baseline justify-between gap-3 border-t border-dashed border-[var(--f-line)] pt-3">
                      <p className="truncate text-[0.85rem] font-medium">{prettySubject(subject)}</p>
                      <p className="shrink-0 font-mono text-[0.74rem] text-[var(--f-ink-2)]">
                        <span className={cn("font-semibold", pctTone(attendancePct(row.present, row.total)))}>{attendancePct(row.present, row.total)}%</span>
                        <span className="text-[var(--f-ink-3)]"> · {row.classes} class{row.classes > 1 ? "es" : ""}</span>
                      </p>
                    </div>
                  ))}
                  {summary.subjects.length === 0 && (
                    <p className="text-[0.82rem] text-[var(--f-ink-2)]">No submissions recorded yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-5 animate-pulse rounded bg-[var(--f-paper-2)]" />
                ))}
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUpItem} className="f-card p-5">
            <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              <ShieldCheck size={15} className="text-[var(--f-green)]" />
              How your data is protected
            </h3>
            <ul className="mt-3 space-y-2 text-[0.78rem] leading-relaxed text-[var(--f-ink-2)]">
              <li>• Sign-in and passwords are handled by Supabase Auth in the dedicated <strong>attendance_record</strong> project — separate from the student app.</li>
              <li>• Row Level Security restricts you to your own sessions and the rosters of your assigned classes.</li>
              <li>• Submissions are atomic and cannot be duplicated or silently overwritten.</li>
              <li>• Every correction requires a reason and is written to an immutable audit trail.</li>
            </ul>
          </motion.div>
        </motion.div>

        {/* security */}
        <motion.div variants={fadeUpItem} className="f-card h-fit p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold">
            <Lock size={16} className="text-[var(--f-green)]" />
            Security
          </h2>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[var(--f-ink-2)]">
            {changed || !teacher.must_change_password
              ? "Your password is up to date. You can change it again any time."
              : "Your account still uses the administrator-issued initial password — please set your own now."}
          </p>

          {(!changed && teacher.must_change_password) && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E8DCBF] bg-[#FBF3DD] p-3.5 text-[0.78rem] leading-relaxed text-[#6B4E10]">
              <KeyRound size={15} className="mt-[1px] shrink-0 text-[#8A6212]" />
              Password changes are applied through Supabase Auth directly — the portal never stores or sees your password.
            </div>
          )}

          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <label className="block">
              <span className="f-eyebrow mb-2 block">Current password</span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="f-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="f-eyebrow mb-2 block">New password</span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="f-input"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label className="block">
              <span className="f-eyebrow mb-2 block">Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="f-input"
                placeholder="Repeat the new password"
                autoComplete="new-password"
                required
              />
            </label>
            <button type="submit" disabled={busy || !next || !confirm} className="f-btn f-btn-primary h-11 w-full">
              {busy ? "Updating…" : "Update password"}
              <Save size={15} />
            </button>
          </form>

          {changed && (
            <p className="mt-4 rounded-xl border border-[#BFDCC9] bg-[var(--f-tint)] p-3.5 text-[0.8rem] font-medium text-[var(--f-green-deep)]">
              Password updated — the “change your initial password” reminder will disappear after your next page load.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
