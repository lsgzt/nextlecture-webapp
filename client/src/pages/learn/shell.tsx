import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCurrentRole,
  getSession,
  getStudent,
  getTeacher,
  lmsDemo,
  lmsSupabase,
  demoStudent,
  demoTeacher,
  type Student,
  type Teacher,
} from "@/lib/lms";
import { EASE, Monogram, Reveal } from "./parts";

export type Identity = { student: Student | null; teacher: Teacher | null; demo: boolean };

export function useLmsIdentity(role?: "student" | "teacher") {
  const [, navigate] = useLocation();
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (lmsDemo) {
        if (role === "teacher") setIdentity({ student: null, teacher: demoTeacher, demo: true });
        else setIdentity({ student: demoStudent, teacher: null, demo: true });
        return;
      }
      const session = await getSession();
      if (!active) return;
      if (!session?.user.email) {
        navigate("/learn/login");
        return;
      }
      const currentRole = await getCurrentRole(session.user.email);
      if (!active) return;
      if (role && currentRole !== role) {
        navigate(currentRole === "teacher" ? "/learn/admin" : "/learn");
        return;
      }
      if (currentRole === "student") setIdentity({ student: await getStudent(session.user.email), teacher: null, demo: false });
      else if (currentRole === "teacher") setIdentity({ student: null, teacher: await getTeacher(session.user.email), demo: false });
      else setIdentity({ student: null, teacher: null, demo: false });
    })().catch(() => {
      if (active) navigate("/learn/login");
    });
    return () => {
      active = false;
    };
  }, [role, navigate]);

  return identity;
}

function NavLink({ href, label }: { href: string; label: string }) {
  const [path] = useLocation();
  const active = href === "/learn" ? path === "/learn" : path.startsWith(href);
  return (
    <Link href={href} className={cn("learn-navlink text-[0.85rem] font-medium", active && "font-semibold")} data-active={active}>
      {label}
    </Link>
  );
}

function DemoBadge() {
  return (
    <span
      title="Supabase is not configured on this deployment — you are browsing a sample dataset."
      className="hidden items-center gap-1.5 rounded-full border border-[var(--l-amber)]/35 bg-[var(--l-amber-tint)] px-2.5 py-1 font-mono text-[0.6rem] font-medium tracking-[0.14em] text-[var(--l-amber)] uppercase sm:inline-flex"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--l-amber)]" />
      Sample data
    </span>
  );
}

function MobileMenu({ identity, onNavigate }: { identity: Identity; onNavigate: () => void }) {
  const isTeacher = Boolean(identity.teacher);
  const links = [
    { href: "/learn", label: "Overview" },
    { href: "/learn/courses", label: "Courses" },
    { href: "/learn/teachers", label: "Teachers" },
    ...(isTeacher ? [{ href: "/learn/admin", label: "Teacher studio" }] : []),
    ...(!isTeacher ? [{ href: "/learn/profile", label: "Your profile" }] : []),
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--l-paper)] md:hidden"
    >
      <div className="flex h-16 items-center justify-between px-5">
        <span className="flex items-center gap-2.5">
          <img src="/nextlecture-logo.png" alt="NextLecture logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[0.65rem] object-contain" />
          <span className="text-[0.95rem] font-bold tracking-tight">NextLecture</span>
          <span className="font-mono text-[0.7rem] text-[var(--l-ink-3)]">/ learn</span>
        </span>
        <button aria-label="Close menu" onClick={onNavigate} className="grid h-10 w-10 place-items-center rounded-full text-[var(--l-ink-2)] transition-colors hover:bg-[var(--l-tint)]">
          <X size={20} />
        </button>
      </div>
      <nav className="flex flex-1 flex-col justify-center gap-1 px-6">
        {links.map((link, index) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + index * 0.06, duration: 0.4, ease: EASE }}
          >
            <Link href={link.href} onClick={onNavigate} className="group flex items-baseline gap-4 py-3.5">
              <span className="font-mono text-[0.66rem] text-[var(--l-ink-3)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-display text-[1.9rem] font-semibold leading-none tracking-[-0.01em] text-[var(--l-ink)] transition-colors group-hover:text-[var(--l-green)]">
                {link.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="border-t border-[var(--l-line)] px-6 py-5">
        <p className="font-mono text-[0.64rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">
          {identity.teacher ? "Teacher access" : "Student access"}
        </p>
        <p className="mt-1 text-[0.9rem] font-medium">{identity.student?.name ?? identity.teacher?.name}</p>
      </div>
    </motion.div>
  );
}

function ShellSkeleton() {
  return (
    <div className="learn-scope learn-page min-h-screen">
      <div className="h-16 border-b border-[var(--l-line)]" />
      <main className="mx-auto w-full max-w-6xl px-5 pt-12 sm:px-8">
        <div className="learn-shimmer h-2.5 w-32" />
        <div className="learn-shimmer mt-4 h-10 w-64 max-w-full" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="learn-card overflow-hidden">
              <div className="learn-shimmer aspect-video !rounded-none" />
              <div className="space-y-2.5 p-4">
                <div className="learn-shimmer h-2.5 w-3/5" />
                <div className="learn-shimmer h-3.5 w-full" />
                <div className="learn-shimmer h-3.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function LearnShell({
  children,
  role,
  eyebrow,
  title,
  description,
  headAside,
}: {
  children: React.ReactNode;
  role?: "student" | "teacher";
  eyebrow?: string;
  title?: string;
  description?: string;
  headAside?: React.ReactNode;
}) {
  const identity = useLmsIdentity(role);
  const [path, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!identity) return <ShellSkeleton />;

  const isTeacher = Boolean(identity.teacher);
  const displayName = identity.student?.name ?? identity.teacher?.name ?? "Learner";

  async function logout() {
    if (!lmsDemo && lmsSupabase) await lmsSupabase.auth.signOut();
    navigate("/learn/login");
  }

  return (
    <div className="learn-scope learn-page flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--l-line)] bg-[color-mix(in_oklab,var(--l-paper)_84%,white)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/learn" className="group flex items-center gap-2.5">
            <img
              src="/nextlecture-logo.png"
              alt="NextLecture logo"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-[0.65rem] object-contain transition-transform duration-300 group-hover:-rotate-6"
            />
            <span className="flex items-baseline gap-1.5">
              <span className="text-[0.95rem] font-bold tracking-tight text-[var(--l-ink)]">NextLecture</span>
              <span className="font-mono text-[0.7rem] text-[var(--l-ink-3)]">/ learn</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <NavLink href="/learn" label="Overview" />
            <NavLink href="/learn/courses" label="Courses" />
            <NavLink href="/learn/teachers" label="Teachers" />
            {!isTeacher && <NavLink href="/learn/profile" label="Profile" />}
            {isTeacher && <NavLink href="/learn/admin" label="Studio" />}
          </nav>

          <div className="flex items-center gap-2.5">
            {identity.demo && <DemoBadge />}
            {identity.student ? (
              <Link
                href="/learn/profile"
                title="View your student profile"
                className="hidden items-center gap-2.5 rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] py-1 pl-1 pr-3.5 transition-colors hover:border-[var(--l-green)]/45 md:flex"
              >
                <Monogram name={displayName} className="h-7 w-7 text-[0.6rem]" />
                <span className="max-w-32 truncate text-[0.8rem] font-medium text-[var(--l-ink)]">{displayName}</span>
              </Link>
            ) : (
              <span className="hidden items-center gap-2.5 rounded-full border border-[var(--l-line)] bg-[var(--l-surface)] py-1 pl-1 pr-3.5 md:flex">
                <Monogram name={displayName} className="h-7 w-7 text-[0.6rem]" />
                <span className="max-w-32 truncate text-[0.8rem] font-medium text-[var(--l-ink)]">{displayName}</span>
              </span>
            )}
            <button
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--l-ink-2)] transition-colors hover:bg-[var(--l-tint)] hover:text-[var(--l-green)]"
            >
              <LogOut size={16} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--l-ink)] transition-colors hover:bg-[var(--l-tint)] md:hidden"
            >
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{menuOpen && <MobileMenu identity={identity} onNavigate={() => setMenuOpen(false)} />}</AnimatePresence>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-10 sm:px-8 sm:pt-12">
        {(eyebrow || title) && (
          <Reveal className="mb-9">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                {eyebrow && <p className="learn-eyebrow">{eyebrow}</p>}
                {title && (
                  <h1 className="mt-2.5 font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.015em] text-[var(--l-ink)] sm:text-[2.5rem]">
                    {title}
                  </h1>
                )}
                {description && <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-[var(--l-ink-2)]">{description}</p>}
              </div>
              {headAside}
            </div>
          </Reveal>
        )}
        {children}
      </main>

      <footer className="border-t border-[var(--l-line)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-mono text-[0.64rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">
            NextLecture Learn — made at GNDEC, for GNDEC
          </p>
          <p className="font-mono text-[0.64rem] tracking-[0.16em] text-[var(--l-ink-3)] uppercase">
            first years · est. 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
