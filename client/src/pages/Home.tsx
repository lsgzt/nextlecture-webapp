import { ANDROID_APP_URL, BRAND_LOGO_URL } from "@shared/config";
import { ArrowRight, BellRing, BookOpenCheck, CalendarDays, ChevronDown, CircleCheck, ExternalLink, MapPin, Moon, Sparkles, Sun, UsersRound } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

const problemSteps = ["Find department", "Find branch", "Find section", "Find the right day", "Find the time and room"];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="container sticky top-0 z-20 flex h-18 items-center justify-between border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <Link href="/" className="group inline-flex items-center gap-2.5 font-display text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
          <img
            src={BRAND_LOGO_URL}
            alt="NextLecture timetable logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25"
          />
          <span>NextLecture</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <a className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground lg:inline-flex" href="#story">Why it exists</a>
          <Link href="/syllabus" className="hidden text-sm font-semibold text-teal-700 transition hover:text-teal-950 sm:inline-flex dark:text-teal-300 dark:hover:text-white">Syllabus AI</Link>
          <ThemeToggle />
          <Link href="/app" className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-800/20 transition hover:bg-teal-800 active:scale-[0.97] sm:px-5">
            Open app
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero-grid">
          <div className="container grid items-center gap-12 py-15 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-26">
            <div className="relative z-10 max-w-2xl">
              <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" /> MADE FOR GNDEC STUDENTS</p>
              <h1 className="mt-5 max-w-xl font-display text-[2.85rem] font-semibold leading-[0.99] tracking-[-0.06em] text-balance text-foreground sm:text-6xl lg:text-[4.35rem]">
                Never miss your<br className="hidden sm:block" /> next lecture.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground sm:text-xl">
                See what’s next, where to go, and who’s teaching — without digging through the college timetable.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/app" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-teal-800 active:scale-[0.97]">
                  Open Web App <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href={ANDROID_APP_URL} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-base font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-teal-700/30 hover:text-teal-700 active:scale-[0.97] dark:hover:text-teal-300" target="_blank" rel="noreferrer">
                  Android App <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link href="/syllabus" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-5 text-base font-semibold text-teal-800 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-100 active:scale-[0.97] dark:border-teal-900 dark:bg-teal-950/35 dark:text-teal-200">Ask Syllabus AI <Sparkles className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Fast timetable access for every phone. For timely reminders, use the Android app.</p>
            </div>

            <div className="relative mx-auto w-full max-w-[630px] lg:ml-auto">
              <div className="absolute -right-8 top-10 -z-10 h-64 w-64 rounded-full bg-teal-200/35 blur-3xl dark:bg-teal-900/25" />
              <div className="preview-shell rounded-[2rem] border border-stone-200 bg-[#fcfcfa] p-3 shadow-2xl shadow-stone-950/10 dark:border-white/10 dark:bg-[#17211f] dark:shadow-black/30 sm:p-5">
                <div className="mb-5 flex items-center justify-between px-1">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 dark:text-teal-300">NEXTLECTURE</p>
                    <p className="mt-1 text-lg font-semibold tracking-[-0.035em] text-[#1a2824] dark:text-stone-100">Good afternoon</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/45 dark:text-teal-300"><Sun className="h-4 w-4" /></span>
                </div>
                <div className="rounded-2xl bg-teal-700 p-5 text-white shadow-lg shadow-teal-950/15 sm:p-6">
                  <div className="flex items-center justify-between gap-4"><span className="text-[0.68rem] font-bold tracking-[0.14em] text-teal-100">NEXT LECTURE</span><span className="rounded-full bg-white/13 px-2.5 py-1 text-xs font-semibold">Starts in 24 min</span></div>
                  <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">CHEMISTRY</h2>
                  <p className="mt-1 text-sm font-medium text-teal-100">8:30 AM – 9:30 AM</p>
                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
                    <p className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4 text-teal-200" /> S205</p>
                    <p className="truncate text-right text-sm font-medium text-teal-100">DR AMANDEEP KAUR</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
                  {[{ t: "08:30", s: "Chemistry", active: true }, { t: "09:30", s: "Math II" }, { t: "10:30", s: "Professional English" }].map(item => (
                    <div key={item.t} className={`rounded-xl border p-3 ${item.active ? "border-teal-200 bg-teal-50/65 dark:border-teal-800 dark:bg-teal-950/35" : "border-stone-100 bg-white dark:border-white/7 dark:bg-white/3"}`}>
                      <p className="text-[0.68rem] font-semibold text-muted-foreground">{item.t}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#29332f] dark:text-stone-100">{item.s}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-center text-xs font-medium text-muted-foreground">A calmer way to read your timetable.</p>
            </div>
          </div>
        </section>

        <section id="story" className="border-y border-border/70 bg-card/45">
          <div className="container grid gap-10 py-18 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:py-24">
            <div>
              <p className="eyebrow">WHY NEXTLECTURE?</p>
              <h2 className="mt-4 max-w-sm font-display text-4xl font-semibold leading-tight tracking-[-0.055em] sm:text-5xl">Built from a very familiar headache.</h2>
            </div>
            <div className="max-w-2xl text-lg leading-8 text-muted-foreground">
              <p>I made NextLecture after accidentally missing one of my lectures. The official timetable had everything I needed, but finding the right branch, section, day and room was more complicated than it should have been.</p>
              <p className="mt-5">So I built something simpler: select your group once, and see what’s next — when it starts and where you need to go.</p>
            </div>
          </div>
        </section>

        <section className="container py-18 sm:py-24">
          <div className="mb-10 max-w-xl">
            <p className="eyebrow">THE DIFFERENCE</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Your timetable, without the hunt.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between"><h3 className="font-display text-2xl font-semibold tracking-[-0.04em]">Without NextLecture</h3><span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500 dark:bg-white/7 dark:text-stone-300"><CalendarDays className="h-5 w-5" /></span></div>
              <div className="mt-7 space-y-0">
                {problemSteps.map((step, index) => <div key={step}><p className="rounded-xl border border-border/80 bg-muted/35 px-4 py-3 text-sm font-medium text-muted-foreground">{step}</p>{index < problemSteps.length - 1 && <ChevronDown className="mx-auto my-1.5 h-4 w-4 text-stone-400" aria-hidden="true" />}</div>)}
              </div>
            </article>
            <article className="rounded-3xl border border-teal-200 bg-teal-50/55 p-6 dark:border-teal-900 dark:bg-teal-950/25 sm:p-8">
              <div className="flex items-center justify-between"><h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-teal-950 dark:text-teal-100">With NextLecture</h3><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 text-white"><BookOpenCheck className="h-5 w-5" /></span></div>
              <div className="mt-7 space-y-2.5">
                {["Select your group", "See your next lecture", "Go to class"].map((step, index) => <div key={step}><p className="flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-teal-950 shadow-sm dark:bg-teal-950/45 dark:text-teal-100"><CircleCheck className="h-4 w-4 text-teal-600 dark:text-teal-300" />{step}</p>{index < 2 && <ChevronDown className="mx-auto my-1 h-4 w-4 text-teal-500" aria-hidden="true" />}</div>)}
              </div>
            </article>
          </div>
        </section>

        <section className="container pb-18 sm:pb-24">
          <div className="rounded-[2rem] bg-[#153b36] px-6 py-9 text-white shadow-xl shadow-teal-950/10 sm:px-10 sm:py-12 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
            <div><p className="eyebrow text-teal-200">THE WEB APP</p><h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Your timetable. Without the headache.</h2><p className="mt-4 max-w-xl text-lg leading-8 text-teal-100">Choose your GNDEC group and instantly see the lectures ahead.</p></div>
            <Link href="/app" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-teal-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50 active:scale-[0.97] lg:mt-0">Open Web App <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/45">
          <div className="container grid gap-9 py-18 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-900/45 dark:text-teal-300"><UsersRound className="h-5 w-5" /></div><h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.05em]">Using an iPhone?</h2><p className="mt-3 max-w-md leading-7 text-muted-foreground">No problem. Open NextLecture in your browser to check your upcoming lectures whenever you need them. You can keep your last saved timetable available offline, too.</p></article>
            <article className="rounded-3xl border border-teal-200 bg-teal-50/55 p-6 dark:border-teal-900 dark:bg-teal-950/25 sm:p-8"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white"><BellRing className="h-5 w-5" /></div><h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.05em] text-teal-950 dark:text-teal-100">Want lecture reminders?</h2><p className="mt-3 max-w-md leading-7 text-teal-900/70 dark:text-teal-100/75">For timely lecture reminders, use the Android app. It can schedule reminders directly on your phone using the timetable stored there.</p><a href={ANDROID_APP_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-teal-800 underline decoration-teal-400 underline-offset-4 transition hover:text-teal-950 dark:text-teal-200 dark:hover:text-white">Download Android App <ExternalLink className="h-3.5 w-3.5" /></a></article>
          </div>
        </section>
      </main>

      <footer className="container py-12"><div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end"><div><div className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.04em]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-700 text-[0.62rem] font-bold text-white">NL</span>NextLecture</div><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Made for GNDEC students. Built because finding your next lecture shouldn’t be this complicated.</p></div><div className="flex gap-5 text-sm font-medium text-muted-foreground"><Link href="/app" className="transition hover:text-foreground">Web App</Link><Link href="/syllabus" className="transition hover:text-foreground">Syllabus AI</Link><a href={ANDROID_APP_URL} target="_blank" rel="noreferrer" className="transition hover:text-foreground">Android App</a><a href="https://appsc.gndec.ac.in/" target="_blank" rel="noreferrer" className="transition hover:text-foreground">GNDEC</a></div></div><p className="mt-10 text-xs text-muted-foreground">© 2026 NextLecture</p></footer>
    </div>
  );
}
