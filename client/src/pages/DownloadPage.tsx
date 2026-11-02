import { BRAND_LOGO_URL } from "@shared/config";
import { startAndroidApkDownload } from "@/lib/android-download";
import {
  ArrowLeft,
  BellRing,
  BookOpenText,
  CalendarDays,
  Download,
  FileText,
  HelpCircle,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Trophy,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

const features = [
  "Get timely lecture reminders so you never miss a class",
  "Smooth interface with premium animations",
  "Find vacant rooms in seconds",
  "Get all official notices right inside NextLecture",
  "Get a list of all official holidays",
  "Keep track of your overall and subject-wise attendance",
  "Get the official syllabus",
  "Get all previous years’ question papers",
  "Get FAQs for every subject",
  "Compete with your classmates using the attendance leaderboard",
  "Ask anything about your syllabus to Syllabus AI inside NextLecture",
];

const featureIcons = [
  BellRing,
  Sparkles,
  MapPin,
  MessageCircle,
  CalendarDays,
  ClipboardCheck,
  BookOpenText,
  FileText,
  HelpCircle,
  Trophy,
  Sparkles,
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="container sticky top-0 z-20 flex h-18 items-center justify-between border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <Link href="/" className="group inline-flex items-center gap-2.5 font-display text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
          <img src={BRAND_LOGO_URL} alt="NextLecture logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" />
          <span>NextLecture</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300" aria-label="Back to home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link href="/app" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 sm:inline-flex">
            Web App
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="container max-w-3xl pb-16 pt-6 sm:pt-10">
        <AnnouncementBanner className="mb-6" />

        {/* App store style hero card */}
        <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-xl shadow-stone-950/[0.06] dark:shadow-black/30">
          <div className="bg-gradient-to-br from-teal-700 via-teal-800 to-[#0f3d38] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
              <img
                src={BRAND_LOGO_URL}
                alt="NextLecture app icon"
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded-[1.35rem] object-cover shadow-lg shadow-black/25 ring-2 ring-white/20"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-bold tracking-[0.16em] text-teal-100/90">ANDROID APP</p>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">NextLecture</h1>
                <p className="mt-2 text-sm font-medium text-teal-100/90">GNDEC timetable · attendance · syllabus</p>
                <p className="mt-1 text-xs text-teal-100/70">Free · APK download · Built for GNDEC students</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => startAndroidApkDownload()}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-white px-6 text-base font-semibold text-teal-900 shadow-md transition hover:-translate-y-0.5 hover:bg-teal-50 active:scale-[0.97]"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Download APK
              </button>
              <p className="text-center text-xs text-teal-100/75 sm:text-left">Starts downloading immediately — no extra page</p>
            </div>
          </div>

          <div className="border-t border-border/80 px-6 py-5 sm:px-10">
            <p className="text-sm leading-6 text-muted-foreground">
              <strong className="font-semibold text-foreground">Android 8.0 or higher required.</strong> NextLecture only supports devices running Android 8 (Oreo) or above. It cannot be installed on Android 7 or lower.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mt-10">
          <p className="eyebrow">WHAT YOU GET</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Everything in one app</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            The Android app goes beyond the web timetable — reminders, rooms, notices, attendance, and Syllabus AI on your phone.
          </p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Sparkles;
              return (
                <li
                  key={feature}
                  className="flex gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium leading-6 text-foreground">{feature}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Troubleshoot */}
        <section className="mt-12 rounded-[1.75rem] border border-amber-200/80 bg-amber-50/60 p-6 dark:border-amber-900/50 dark:bg-amber-950/25 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow text-amber-800/80 dark:text-amber-200/80">TROUBLESHOOT</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-amber-950 dark:text-amber-50">
                App not installing?
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-7 text-amber-950/90 dark:text-amber-100/85">
            <div className="rounded-xl border border-amber-200/70 bg-white/70 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/40">
              <p className="font-semibold">“App not installed” on the package installer?</p>
              <p className="mt-1.5">
                Turn off Google Play Protect: open the <strong>Play Store</strong> → your <strong>profile</strong> →{" "}
                <strong>Play Protect</strong> → <strong>Settings</strong> → turn <strong>Play Protect</strong> off, then try installing again.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-white/70 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/40">
              <p className="font-semibold">Blocked by Samsung Auto Blocker?</p>
              <p className="mt-1.5">
                Go to <strong>Settings</strong> → <strong>Security and privacy</strong> (or Privacy and security) → turn off{" "}
                <strong>Auto Blocker</strong>, then install the APK again.
              </p>
            </div>
          </div>
        </section>

        {/* Support */}
        <section className="mt-10 rounded-[1.75rem] border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Still not installing?</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Contact me and I’ll help you get set up.
          </p>
          <ul className="mt-5 space-y-2 text-sm font-medium">
            <li>
              Telegram:{" "}
              <a href="https://t.me/lsgzt" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white">
                @lsgzt
              </a>
            </li>
            <li>
              Discord:{" "}
              <span className="font-bold text-teal-700 dark:text-teal-300">@lsgz</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => startAndroidApkDownload()}
            className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.97]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download APK again
          </button>
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/" className="font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-300">
            Back to home
          </Link>
          {" · "}
          <a href="https://lsgz.vercel.app" target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-300">
            Built and maintained by LSGZ
          </a>
        </p>
      </main>
    </div>
  );
}
