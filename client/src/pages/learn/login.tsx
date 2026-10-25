import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, LogIn, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { getCurrentRole, lookupLogin, sendMagicLink, subscribeToAuth, getSession, devSignIn, lmsDemo, lmsSupabase, LMS_DEV_LOGIN } from "@/lib/lms";
import { EASE } from "./parts";

const INDEX_CARD_COURSES = [
  ["MECH-101", "Engineering Mechanics"],
  ["CHEM-102", "Applied Chemistry"],
  ["MATH-103", "Calculus I"],
  ["CSE-104", "Programming Fundamentals"],
  ["HUMN-105", "Communication Skills"],
];

export function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "sent">("email");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const reduce = useReducedMotion();

  useEffect(() => {
    if (lmsDemo) return; // no session to resume in sample mode
    let active = true;
    const finishLogin = async (session: any) => {
      if (!active || !session?.user.email) return;
      try {
        const role = await getCurrentRole(session.user.email);
        if (role === "teacher") navigate("/learn/admin");
        else if (role === "student") navigate("/learn");
        else {
          await lmsSupabase?.auth.signOut();
          toast.error("This account is not approved for the learning portal.");
        }
      } catch (error: any) {
        toast.error(error.message ?? "Could not finish sign in");
      }
    };
    getSession().then(finishLogin).catch(() => undefined);
    const unsubscribe = subscribeToAuth(finishLogin);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  async function continueLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const lookup = await lookupLogin(email);
      if (!lookup) {
        toast.error("Only first-year students and approved teachers can access this portal.");
        return;
      }
      if (LMS_DEV_LOGIN) {
        // TEMPORARY no-email mode: roster check passed, go straight in.
        if (!lmsDemo) await devSignIn(email);
        toast.success(`Signed in as ${lookup.display_name}`);
        navigate(lookup.role === "teacher" ? "/learn/admin" : "/learn");
        return;
      }
      await sendMagicLink(email);
      setSentTo(email.trim().toLowerCase());
      setStage("sent");
      toast.success(`Sign-in link sent to ${email}`);
    } catch (error: any) {
      toast.error(error.message ?? "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  const stageMotion = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
        transition: { duration: 0.4, ease: EASE },
      };

  return (
    <div className="learn-scope learn-page grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      {/* ——— left panel: the reading room ——— */}
      <aside className="learn-grain relative hidden overflow-hidden bg-[#0B392E] text-[#EAF2EA] lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* concentric rings */}
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full border border-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[22rem] w-[22rem] rounded-full border border-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-[14rem] w-[14rem] rounded-full border border-white/[0.05]" />
        <div aria-hidden className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#10573F]/40 blur-2xl" />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/nextlecture-logo.png" alt="NextLecture logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[0.65rem] bg-[#E4EDE6] object-contain p-1" />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[0.95rem] font-bold tracking-tight">NextLecture</span>
            <span className="font-mono text-[0.7rem] text-white/50">/ learn</span>
          </span>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="learn-eyebrow !text-[#7FB6A0]">For first-years at GNDEC</p>
          <h1 className="mt-5 font-display text-[3.3rem] leading-[1.05] font-semibold tracking-[-0.02em] text-[#F2F0E4]">
            First year,
            <br />
            without the noise.
          </h1>
          <p className="mt-6 max-w-sm text-[1rem] leading-8 text-[#A9C6B6]">
            Every recorded lecture from your own faculty — organised by course, replayable whenever the semester gets away from you.
          </p>

          <motion.div
            initial={reduce ? undefined : { opacity: 0, rotate: 0, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, rotate: -2, y: 0 }}
            transition={reduce ? { duration: 0 } : { delay: 0.25, duration: 0.7, ease: EASE }}
            className="mt-12 max-w-[19rem] rounded-xl bg-[#F7F4EC] p-5 text-[#1D2A23] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[0.6rem] font-medium tracking-[0.2em] text-[#7F8D84] uppercase">Semester 01 — index</p>
              <span className="font-mono text-[0.6rem] text-[#B26A2C]">est.</span>
            </div>
            <div className="mt-3 space-y-2">
              {INDEX_CARD_COURSES.map(([code, name], index) => (
                <div key={code} className={index > 0 ? "border-t border-dashed border-[#E4DFD1] pt-2" : ""}>
                  <p className="flex items-baseline gap-2.5 font-mono text-[0.66rem] leading-4">
                    <span className="text-[#0D5E4D]">{code}</span>
                    <span className="text-[#4E5D54]">{name}</span>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <p className="relative z-10 font-mono text-[0.64rem] tracking-[0.16em] text-white/45 uppercase">
          Private to the GNDEC first-year community
        </p>
      </aside>

      {/* ——— right: the form ——— */}
      <section className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-12 flex items-center justify-center gap-2.5 lg:hidden">
            <img src="/nextlecture-logo.png" alt="NextLecture logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[0.65rem] object-contain" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-[0.95rem] font-bold tracking-tight">NextLecture</span>
              <span className="font-mono text-[0.7rem] text-[var(--l-ink-3)]">/ learn</span>
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {stage === "email" ? (
              <motion.div key="email" {...stageMotion}>
                <p className="learn-eyebrow">Student &amp; faculty access</p>
                <h2 className="mt-3 font-display text-[2.1rem] leading-[1.1] font-semibold tracking-[-0.015em] text-[var(--l-ink)]">
                  {LMS_DEV_LOGIN ? "Straight in, no inbox." : "One link, no passwords."}
                </h2>
                <p className="mt-4 text-[0.92rem] leading-relaxed text-[var(--l-ink-2)]">
                  {LMS_DEV_LOGIN
                    ? "Use your college email — the portal checks it against the first-year roster and signs you in right away. Email verification is paused while we set up our mail service."
                    : "We'll email you a one-time sign-in link. Use your college email — the portal checks it against the first-year roster before anything is sent."}
                </p>

                <form onSubmit={continueLogin} className="mt-9 space-y-4">
                  <label className="block">
                    <span className="learn-eyebrow mb-2 block">College email</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@gndec.ac.in"
                      className="learn-input h-[3.25rem]"
                      autoComplete="email"
                    />
                  </label>
                  <button type="submit" disabled={busy} className="learn-btn learn-btn-primary h-[3.25rem] w-full">
                    {busy ? "Checking the roster…" : (
                      <>
                        {LMS_DEV_LOGIN ? "Sign in" : "Email me a sign-in link"}
                        {LMS_DEV_LOGIN ? <LogIn size={16} /> : <ArrowRight size={16} />}
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-10 text-[0.72rem] leading-5 text-[var(--l-ink-3)]">
                  New here? If your email is on the roster, an account is created for you automatically the first time you sign in.
                </p>
              </motion.div>
            ) : (
              <motion.div key="sent" {...stageMotion}>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--l-tint)] text-[var(--l-green)]">
                  <MailCheck size={24} strokeWidth={1.7} />
                </span>
                <p className="learn-eyebrow mt-7">Check your inbox</p>
                <h2 className="mt-3 font-display text-[2.1rem] leading-[1.15] font-semibold tracking-[-0.015em] text-[var(--l-ink)]">
                  Link sent to <span className="text-[var(--l-green)]">{sentTo}</span>.
                </h2>
                <p className="mt-4 text-[0.92rem] leading-relaxed text-[var(--l-ink-2)]">
                  Open the email on this device and tap the button inside. The link expires after an hour and can only be used once.
                </p>

                {lmsDemo && (
                  <div className="mt-7 rounded-[1.1rem] border border-dashed border-[var(--l-amber)]/40 bg-[var(--l-amber-tint)] p-5">
                    <p className="font-mono text-[0.62rem] font-medium tracking-[0.16em] text-[var(--l-amber)] uppercase">Sample environment</p>
                    <p className="mt-2 text-[0.85rem] leading-relaxed text-[#7A4A16]">
                      Supabase isn&apos;t configured here, so no email actually left the building — but the rest of the portal is explorable.
                    </p>
                    <button onClick={() => navigate("/learn")} className="learn-btn learn-btn-ghost mt-4 h-10 w-full">
                      Open the sample dashboard
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStage("email")}
                  className="learn-handlink mt-9 text-[0.85rem] font-medium"
                >
                  Use a different email
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
