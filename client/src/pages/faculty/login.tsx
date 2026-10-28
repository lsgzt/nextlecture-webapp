import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ClipboardCheck, KeyRound, LogIn, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { DEMO_TEACHERS, DEMO_TEACHER_BY_EMAIL } from "@/lib/faculty-attendance-demo";
import {
  facultyDemo,
  getFacultySession,
  isFacultySchemaMissing,
  signInTeacher,
  subscribeFacultyAuth,
} from "@/lib/faculty-attendance";
import { F_EASE, FacultyMonogram } from "./parts";

export function FacultyLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  // Resume an existing session automatically.
  useEffect(() => {
    if (facultyDemo) return;
    let active = true;
    const finish = async () => {
      const session = await getFacultySession();
      if (!active || !session?.user) return;
      navigate("/faculty/dashboard");
    };
    finish().catch(() => undefined);
    const unsubscribe = subscribeFacultyAuth((session) => {
      if (active && session?.user) navigate("/faculty/dashboard");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter both your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (facultyDemo) {
        // Sample mode: any of the two rostered teachers may explore the portal.
        const demoId = DEMO_TEACHER_BY_EMAIL[email.trim().toLowerCase()];
        if (!demoId) {
          toast.error("Sample mode lists only the two rostered teachers — try one of those addresses.");
          return;
        }
        window.sessionStorage.setItem("faculty-demo-teacher", JSON.stringify(DEMO_TEACHERS[demoId]));
        toast.success(`Signed in to the sample portal as ${DEMO_TEACHERS[demoId].full_name}.`);
        navigate("/faculty/dashboard");
        return;
      }

      await signInTeacher(email, password);
      toast.success("Signed in. Redirecting…");
      navigate("/faculty/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(who: "neeraj" | "randhir") {
    setEmail(who === "neeraj" ? "neerajkumar735561@gmail.com" : "rsingh@gndec.ac.in");
    setPassword(who === "neeraj" ? "Neeraj" : "rsingh");
  }

  const stageMotion = reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: F_EASE } };

  return (
    <div className="f-scope grid min-h-screen bg-[var(--f-paper)] text-[var(--f-ink)] lg:grid-cols-[1.05fr_1fr]">
      {/* ——— left panel: the registry ——— */}
      <aside className="f-grain relative hidden overflow-hidden bg-[var(--f-navy)] text-[#E9EEF2] lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full border border-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[22rem] w-[22rem] rounded-full border border-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#24406E]/40 blur-2xl" />

        <div className="relative z-10 flex items-center gap-3">
          <FacultyMonogram />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[0.95rem] font-bold tracking-tight">NextLecture</span>
            <span className="font-mono text-[0.7rem] text-white/50">/ faculty</span>
          </span>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="f-eyebrow !text-[#8FB3C9]">GNDEC · faculty portal</p>
          <h1 className="mt-5 font-display text-[3.2rem] leading-[1.05] font-semibold tracking-[-0.02em] text-[#F2F5F8]">
            The register,
            <br />
            without the register.
          </h1>
          <p className="mt-6 max-w-sm text-[1rem] leading-8 text-[#A6BCCE]">
            Mark subject-wise attendance for your own sections, submit it atomically, and correct it with a full audit trail — all stored in a database dedicated to faculty attendance.
          </p>

          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 20, rotate: 0 }}
            animate={reduce ? undefined : { opacity: 1, y: 0, rotate: -1.5 }}
            transition={reduce ? { duration: 0 } : { delay: 0.25, duration: 0.7, ease: F_EASE }}
            className="mt-12 max-w-[19.5rem] rounded-xl bg-[#F6F4EC] p-5 text-[#1C2733] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[0.6rem] font-medium tracking-[0.2em] text-[#7C8A99] uppercase">Class — Mon, 09:30</p>
              <ClipboardCheck size={14} className="text-[#2C4A77]" />
            </div>
            <p className="mt-2.5 text-[0.92rem] font-semibold">Mathematics-I · CSF1+CSF2</p>
            <div className="mt-3 space-y-1.5 border-t border-dashed border-[#E0DCCE] pt-3 font-mono text-[0.66rem] leading-4">
              <p className="flex justify-between"><span className="text-[#7C8A99]">Present</span><span className="font-semibold text-[#0D5E4D]">58</span></p>
              <p className="flex justify-between"><span className="text-[#7C8A99]">Absent</span><span className="font-semibold text-[#A23B2E]">5</span></p>
              <p className="flex justify-between"><span className="text-[#7C8A99]">Submitted</span><span className="font-semibold">✓ 09:41 AM</span></p>
            </div>
          </motion.div>
        </div>

        <p className="relative z-10 font-mono text-[0.64rem] tracking-[0.16em] text-white/45 uppercase">
          Separate database · verified access · audit trail
        </p>
      </aside>

      {/* ——— right: the form ——— */}
      <section className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-12 flex items-center justify-center gap-2.5 lg:hidden">
            <FacultyMonogram />
            <span className="flex items-baseline gap-1.5">
              <span className="text-[0.95rem] font-bold tracking-tight">NextLecture</span>
              <span className="font-mono text-[0.7rem] text-[var(--f-ink-3)]">/ faculty</span>
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key="form" {...stageMotion}>
              <p className="f-eyebrow">Teacher sign-in</p>
              <h2 className="mt-3 font-display text-[2.1rem] leading-[1.1] font-semibold tracking-[-0.015em] text-[var(--f-ink)]">
                Your classes, your marks.
              </h2>
              <p className="mt-4 text-[0.92rem] leading-relaxed text-[var(--f-ink-2)]">
                Use the email and password issued for the faculty portal. Accounts live in the dedicated <strong>attendance_record</strong> project — your student-facing NextLecture sign-in stays separate.
              </p>

              {facultyDemo && (
                <div className="mt-6 rounded-[1.1rem] border border-dashed border-[#D9B96A]/50 bg-[#FBF3DD] p-4">
                  <p className="flex items-center gap-2 font-mono text-[0.62rem] font-medium tracking-[0.16em] text-[#8A6212] uppercase">
                    <TriangleAlert size={13} />
                    Sample environment
                  </p>
                  <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#6B4E10]">
                    The attendance database is not configured here. Explore the full portal with sample data using either rostered teacher address.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => fillDemo("neeraj")} className="f-btn f-btn-ghost h-9 !text-[0.78rem]">Use Neeraj Kumar</button>
                    <button type="button" onClick={() => fillDemo("randhir")} className="f-btn f-btn-ghost h-9 !text-[0.78rem]">Use Dr. Randhir Singh</button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <label className="block">
                  <span className="f-eyebrow mb-2 block">Teacher email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="f-input h-[3.25rem]"
                    autoComplete="email"
                  />
                </label>
                <label className="block">
                  <span className="f-eyebrow mb-2 block">Password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="f-input h-[3.25rem]"
                    autoComplete="current-password"
                  />
                </label>
                <button type="submit" disabled={busy} className="f-btn f-btn-primary h-[3.25rem] w-full">
                  {busy ? "Verifying…" : (
                    <>
                      Sign in
                      <LogIn size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 rounded-[1rem] border border-[var(--f-line)] bg-white p-4">
                <p className="flex items-start gap-2.5 text-[0.76rem] leading-relaxed text-[var(--f-ink-2)]">
                  <KeyRound size={15} className="mt-[1px] shrink-0 text-[var(--f-ink-3)]" />
                  Initial passwords are issued by the administrator and should be changed after your first sign-in (Profile → Security). Passwords are handled by Supabase Auth — they are never stored in the attendance tables.
                </p>
              </div>

              <p className="mt-6 text-[0.72rem] leading-5 text-[var(--f-ink-3)]">
                Not a member of the faculty portal? Ask the administrator to provision your account — sign-up is invite-only.
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
