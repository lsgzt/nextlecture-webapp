import { BRAND_LOGO_URL } from "@shared/config";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  GraduationCap,
  Linkedin,
  Send,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

const PAGE_TITLE = "Lovepreet Singh (LSGZ) – Creator & Developer of NextLecture";
const PAGE_DESCRIPTION =
  "Meet Lovepreet Singh (LSGZ), independent student developer at GNDEC and the original creator and maintainer of NextLecture — a platform that simplifies timetables and campus academic tools for GNDEC students.";

const DEVELOPER = {
  fullName: "Lovepreet Singh",
  alias: "LSGZ",
  role: "Independent Student Developer",
  college: "Guru Nanak Dev Engineering College (GNDEC), Ludhiana, Punjab, India",
  portfolio: "https://lsgz.vercel.app",
  github: "https://github.com/lsgzt",
  linkedin: "https://www.linkedin.com/in/lovepreet-singh-3b358287/",
  telegram: "https://t.me/lsgzt",
} as const;

export default function AboutDeveloperPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    const metaDesc = document.querySelector('meta[name="description"]');
    const previousDesc = metaDesc?.getAttribute("content") ?? null;
    if (metaDesc) metaDesc.setAttribute("content", PAGE_DESCRIPTION);
    return () => {
      document.title = previousTitle;
      if (metaDesc && previousDesc !== null) metaDesc.setAttribute("content", previousDesc);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="container sticky top-0 z-20 flex h-18 items-center justify-between border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 font-display text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground"
        >
          <img
            src={BRAND_LOGO_URL}
            alt="NextLecture logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25"
          />
          <span>NextLecture</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="container max-w-3xl py-12 sm:py-16">
        <p className="eyebrow text-teal-700 dark:text-teal-300">DEVELOPER</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
          Meet the Developer Behind NextLecture
        </h1>

        <article className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-stone-100 shadow-md shadow-stone-950/10 dark:border-white/10 dark:bg-stone-950 dark:shadow-black/40"
              aria-hidden="true"
            >
              {/* Dark mark for light mode */}
              <img
                src="/lsgz-logo-light.png"
                alt=""
                width={80}
                height={80}
                className="h-14 w-14 object-contain dark:hidden"
              />
              {/* White mark for dark mode */}
              <img
                src="/lsgz-logo-dark.png"
                alt=""
                width={80}
                height={80}
                className="hidden h-14 w-14 object-contain dark:block"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                {DEVELOPER.fullName}{" "}
                <span className="text-muted-foreground">({DEVELOPER.alias})</span>
              </h2>
              <p className="mt-1.5 text-sm font-medium text-teal-800 dark:text-teal-300">
                {DEVELOPER.role}
              </p>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>{DEVELOPER.college}</span>
              </p>
            </div>
          </div>

          <section className="mt-8 space-y-4 text-base leading-7 text-muted-foreground">
            <p>
              Lovepreet Singh, also known as LSGZ, is the original creator and
              maintainer of NextLecture. He independently conceptualized,
              designed, developed, and continues to maintain the platform as a
              student project focused on making campus academic tools simpler
              for GNDEC students.
            </p>
            <p>
              NextLecture began from a practical need: the official college
              timetable contained the right information, but finding the correct
              branch, section, day, and room often took longer than it should.
              The goal was to reduce that friction — select a group once, then
              quickly see what is next, when it starts, and where to go.
            </p>
            <p>
              Beyond the timetable, the same approach extended to vacant rooms,
              campus notices, holidays, attendance helpers, previous papers, and
              related academic utilities. The project reflects an ongoing
              interest in building focused, useful software for real student
              workflows rather than broad feature lists.
            </p>
          </section>

          <section className="mt-8" aria-label="Developer links">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">
              Connect
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li>
                <a
                  href={DEVELOPER.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                >
                  <ExternalLink className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                  <span className="min-w-0 flex-1 truncate">Portfolio</span>
                  <span className="text-xs text-muted-foreground">lsgz.vercel.app</span>
                </a>
              </li>
              <li>
                <a
                  href={DEVELOPER.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                >
                  <Github className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                  <span className="min-w-0 flex-1 truncate">GitHub</span>
                  <span className="text-xs text-muted-foreground">@lsgzt</span>
                </a>
              </li>
              <li>
                <a
                  href={DEVELOPER.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                >
                  <Linkedin className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                  <span className="min-w-0 flex-1 truncate">LinkedIn</span>
                </a>
              </li>
              <li>
                <a
                  href={DEVELOPER.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                >
                  <Send className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                  <span className="min-w-0 flex-1 truncate">Telegram</span>
                  <span className="text-xs text-muted-foreground">@lsgzt</span>
                </a>
              </li>
            </ul>
          </section>
        </article>

        <section className="mt-10 rounded-3xl border border-teal-200/80 bg-teal-50/50 p-6 dark:border-teal-900 dark:bg-teal-950/25 sm:p-8">
          <p className="eyebrow text-teal-800 dark:text-teal-300">THE PROJECT</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-teal-950 dark:text-teal-50 sm:text-3xl">
            About NextLecture
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-teal-950/80 dark:text-teal-100/80">
            NextLecture is an education-focused web application created and
            maintained by Lovepreet Singh (LSGZ). It helps GNDEC students access
            timetables, vacant rooms, campus notices, holidays, and related
            academic tools in one place. The platform is independently developed
            and is not an official product of the college.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98]"
            >
              Open Web App
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-300 bg-white/70 px-5 text-sm font-semibold text-teal-900 transition hover:bg-white dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-950/70"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </main>

      <footer className="container border-t border-border/70 py-10">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} NextLecture · Built and maintained by{" "}
          <span className="font-semibold text-teal-700 dark:text-teal-300">LSGZ</span>
        </p>
      </footer>
    </div>
  );
}
