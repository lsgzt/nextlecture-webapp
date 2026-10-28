import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, LogOut, Menu, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  facultyDemo,
  getFacultySession,
  isFacultySchemaMissing,
  resolveTeacher,
  signOutTeacher,
  subscribeFacultyAuth,
} from "@/lib/faculty-attendance";
import type { FacultyTeacher } from "@/lib/faculty-attendance-types";
import { F_EASE, FacultyMonogram } from "./parts";

export type FacultyIdentity = {
  teacher: FacultyTeacher;
  /** live = real data; auth-only = real sign-in, unapplied schema; demo = sample mode */
  mode: "live" | "auth-only" | "demo";
};

/**
 * Auth guard for every faculty page. Redirects to /faculty/login when signed
 * out and resolves the teacher profile from the attendance database.
 */
export function useFacultyIdentity(): FacultyIdentity | null {
  const [, navigate] = useLocation();
  const [identity, setIdentity] = useState<FacultyIdentity | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (facultyDemo) {
        // Sample mode: remember the demo identity chosen on the login page.
        const stored = typeof window !== "undefined" ? window.sessionStorage.getItem("faculty-demo-teacher") : null;
        setIdentity({ teacher: JSON.parse(stored ?? "null") ?? { id: "demo-neeraj", full_name: "Neeraj Kumar", email: "neerajkumar735561@gmail.com", department: "Applied Science", designation: "Assistant Professor", profile_id: "402", must_change_password: true, is_active: true }, mode: "demo" });
        return;
      }
      const session = await getFacultySession();
      if (!active) return;
      if (!session?.user) {
        navigate("/faculty/login");
        return;
      }
      try {
        const resolution = await resolveTeacher(session);
        if (!active) return;
        setIdentity({ teacher: resolution.teacher, mode: resolution.mode });
      } catch (error) {
        if (!active) return;
        await signOutTeacher();
        toast.error(error instanceof Error ? error.message : "Could not sign you in.");
        navigate("/faculty/login");
      }
    })().catch(() => {
      if (active) navigate("/faculty/login");
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return identity;
}

const NAV: Array<{ href: string; label: string }> = [
  { href: "/faculty/dashboard", label: "Dashboard" },
  { href: "/faculty/timetable", label: "Timetable" },
  { href: "/faculty/attendance", label: "Attendance" },
  { href: "/faculty/profile", label: "Profile" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const [path] = useLocation();
  const active = path.startsWith(href);
  return (
    <Link href={href} className={cn("f-navlink text-[0.85rem] font-medium", active && "font-semibold")} data-active={active}>
      {label}
    </Link>
  );
}

function ModeBanner({ mode }: { mode: FacultyIdentity["mode"] }) {
  if (mode === "live") return null;
  const isAuthOnly = mode === "auth-only";
  return (
    <div className="f-scope border-b border-[#E8DCBF] bg-[#FBF3DD]">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 sm:px-6">
        <AlertTriangle size={15} className="mt-[3px] shrink-0 text-[#8A6212]" />
        <p className="text-[0.78rem] leading-relaxed text-[#6B4E10]">
          {isAuthOnly ? (
            <>
              You are signed in to the <strong>attendance_record</strong> project, but its tables have not been created yet — the data below is sample data.
              Apply <code className="rounded bg-[#F1E4C3] px-1 py-0.5 font-mono text-[0.72rem]">supabase/faculty-attendance/0001_init.sql</code> in the Supabase SQL Editor and run the sync, then reload.
            </>
          ) : (
            <>
              The attendance database is not configured on this deployment — you are browsing a <strong>sample dataset</strong>.
              Set <code className="rounded bg-[#F1E4C3] px-1 py-0.5 font-mono text-[0.72rem]">VITE_FACULTY_ATTENDANCE_SUPABASE_URL</code> and <code className="rounded bg-[#F1E4C3] px-1 py-0.5 font-mono text-[0.72rem]">VITE_FACULTY_ATTENDANCE_SUPABASE_PUBLISHABLE_KEY</code> to go live.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span
      title="The attendance database is not fully connected — you are browsing sample data."
      className="hidden items-center gap-1.5 rounded-full border border-[#D9B96A]/45 bg-[#FBF3DD] px-2.5 py-1 font-mono text-[0.6rem] font-medium tracking-[0.14em] text-[#8A6212] uppercase sm:inline-flex"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#C99526]" />
      Sample data
    </span>
  );
}

export function FacultyShell({
  identity,
  children,
  wide,
}: {
  identity: FacultyIdentity;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [, navigate] = useLocation();
  const [path] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { teacher, mode } = identity;
  const showDemo = mode !== "live";

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  async function handleSignOut() {
    await signOutTeacher();
    if (typeof window !== "undefined") window.sessionStorage.removeItem("faculty-demo-teacher");
    toast.success("Signed out of the faculty portal.");
    navigate("/faculty/login");
  }

  return (
    <div className="f-scope flex min-h-screen flex-col bg-[var(--f-paper)] text-[var(--f-ink)]">
      <ModeBanner mode={mode} />

      <header className="sticky top-0 z-40 border-b border-[var(--f-line)] bg-[rgba(246,244,237,0.88)] backdrop-blur-md">
        <div className={cn("mx-auto flex h-[4.25rem] items-center justify-between gap-4 px-4 sm:px-6", wide ? "max-w-7xl" : "max-w-6xl")}>
          <Link href="/faculty/dashboard" className="flex min-w-0 items-center gap-2.5">
            <FacultyMonogram />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-[0.95rem] font-bold tracking-tight">NextLecture</span>
                <span className="font-mono text-[0.7rem] text-[var(--f-ink-3)]">/ faculty</span>
              </span>
              <span className="hidden truncate text-[0.72rem] text-[var(--f-ink-2)] sm:block">
                {teacher.full_name} · {teacher.designation ?? "Faculty"}{teacher.department ? ` · ${teacher.department}` : ""}
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {showDemo && <DemoBadge />}
            <button onClick={handleSignOut} className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--f-line)] bg-white px-3 text-[0.8rem] font-medium text-[var(--f-ink-2)] transition-colors hover:border-[#A23B2E]/40 hover:text-[#A23B2E]" aria-label="Sign out">
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button onClick={() => setMenuOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--f-line)] bg-white md:hidden" aria-label="Toggle menu">
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: F_EASE }}
              className="overflow-hidden border-t border-[var(--f-line)] bg-white md:hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-4">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-lg px-2 py-2.5 text-[0.95rem] font-medium text-[var(--f-ink-2)] hover:bg-[var(--f-tint)]">
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>

      <footer className="mt-auto border-t border-[var(--f-line)] bg-[var(--f-paper-2)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <p className="flex items-center gap-2 font-mono text-[0.64rem] tracking-[0.14em] text-[var(--f-ink-3)] uppercase">
            <ShieldAlert size={13} />
            attendance_record · isolated database
          </p>
          <p className="font-mono text-[0.64rem] tracking-[0.14em] text-[var(--f-ink-3)] uppercase">
            {mode === "live" ? "live data" : "sample data"}
          </p>
        </div>
      </footer>
    </div>
  );
}
