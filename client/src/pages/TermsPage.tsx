import { BRAND_LOGO_URL } from "@shared/config";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

const PAGE_TITLE = "Terms & Conditions — NextLecture";
const PAGE_DESCRIPTION =
  "Terms & Conditions for the NextLecture website, Progressive Web App, and Android application used by GNDEC students.";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
        <p className="eyebrow text-teal-700 dark:text-teal-300">LEGAL</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Effective date:</strong> 5 November 2026
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          These Terms &amp; Conditions (&quot;Terms&quot;) apply to your access
          to and use of NextLecture, including its website, installable
          Progressive Web App (PWA), and Android application (collectively, the
          &quot;Service&quot;). By accessing or using the Service, you agree to
          these Terms. If you do not agree, do not use the Service.
        </p>

        <article className="mt-10 space-y-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <Section id="about" title="1. About NextLecture">
            <p>
              NextLecture is an independent, unofficial companion service
              designed to make selected college information and tools easier to
              access. Depending on the version and features available, the
              Service may provide timetable viewing, lecture and room
              information, attendance tracking, notices, holiday information,
              faculty information, vacant-room information, syllabus and
              question-paper resources, AI-assisted answers, reminders, and
              related utilities.
            </p>
            <p>
              <strong className="text-foreground">
                NextLecture is not an official product of, affiliated with,
                sponsored by, or endorsed by Guru Nanak Dev Engineering College
                (GNDEC) or any other institution.
              </strong>{" "}
              References to GNDEC, its departments, faculty, facilities, or
              timetable are for identification and informational purposes only.
            </p>
          </Section>

          <Section id="eligibility" title="2. Eligibility and acceptance">
            <p>
              You may use the Service only if you are legally permitted to agree
              to these Terms. If you are not legally competent to enter into a
              binding agreement, you should use the Service with the involvement
              and permission of a parent or legal guardian, where required by
              law.
            </p>
            <p>
              Your use of an individual feature may also be subject to
              additional notices or conditions shown when you access that
              feature.
            </p>
          </Section>

          <Section id="privacy" title="3. Privacy, analytics, and permissions">
            <p>
              Your use of the Service is also governed by the{" "}
              <strong className="text-foreground">Privacy Policy</strong>. It
              explains what information is collected, why it is used, how it is
              stored or shared, and the choices available to you.
            </p>
            <p>
              <strong className="text-foreground">Privacy Policy:</strong>{" "}
              <Link
                href="/privacy"
                className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
              >
                https://nextlecture.vercel.app/privacy
              </Link>
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                The web application may use Microsoft Clarity for analytics and
                session-replay functionality. Depending on the configuration,
                this may capture interactions with the app, technical
                information, and pages or screens visited.
              </li>
              <li>
                Do not enter passwords, payment details, sensitive personal
                information, or other confidential information into fields or
                areas that may be captured by analytics.
              </li>
              <li>
                Where consent is required, analytics or session recording must
                be enabled only after the appropriate notice and consent choice
                has been presented. You can review the Privacy Policy for
                available controls.
              </li>
              <li>
                The Android app and PWA may request device permissions to
                support specific features, such as notifications. You can manage
                permissions through your device or browser settings. Disabling a
                permission may affect the related feature.
              </li>
            </ul>
            <p>
              The actual collection and use of information must match the live
              Privacy Policy and the Service&apos;s technical configuration. The
              reviewed Service uses or may use Supabase for backend/database
              features, Firebase Cloud Messaging for Android push notifications,
              and Vercel for web and serverless hosting. Firebase Analytics and
              Crashlytics were not identified in the reviewed application
              source; this may change in a future release.
            </p>
          </Section>

          <Section id="accounts" title="4. Accounts, device storage, and user information">
            <p>
              Some features may work without an account and may store
              preferences or cached information locally on your device. Other
              features may require you to submit information or use an account,
              depending on the version of the Service.
            </p>
            <p>You are responsible for:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Keeping your device, account credentials (if applicable), and
                access methods secure.
              </li>
              <li>
                Providing information that is accurate and that you are
                permitted to provide.
              </li>
              <li>
                Using only your own account or an account you are authorised to
                access.
              </li>
              <li>
                Reviewing device and browser settings that affect local storage,
                notifications, and cached data.
              </li>
            </ul>
            <p>
              Uninstalling the app, clearing browser data, changing devices, or
              resetting your device may remove locally stored information. Do
              not treat the Service as your only copy of important attendance or
              academic records.
            </p>
          </Section>

          <Section id="accuracy" title="5. Timetable, college information, and accuracy">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Timetable and related institutional information may be retrieved
                from publicly available or institution-published sources,
                including official GNDEC sources.
              </li>
              <li>
                The source website, document format, publication location, or
                timetable may change without notice. Updates may therefore be
                delayed, incomplete, unavailable, or incorrectly interpreted.
              </li>
              <li>
                Notices, faculty details, room information, holidays,
                vacant-room information, and other college-related content may
                also be delayed or may differ from the latest institutional
                communication.
              </li>
              <li>
                Always verify important information—including lectures, rooms,
                examinations, holidays, deadlines, and official
                announcements—with the relevant college department or official
                source.
              </li>
            </ul>
            <p>
              The Service is provided for convenience and should not be treated
              as the authoritative source for institutional decisions or
              academic records.
            </p>
          </Section>

          <Section id="attendance" title="6. Attendance and other student tools">
            <p>
              Any attendance tracker, attendance calculation, percentage,
              estimate, streak, leaderboard, or similar student utility is
              provided as an organisational aid only.
            </p>
            <p>
              You are responsible for checking entries and calculations and
              comparing them with the college&apos;s official attendance
              records. NextLecture does not determine, certify, or guarantee
              your official attendance status, eligibility, or academic
              standing.
            </p>
            <p>
              Do not use these tools to misrepresent attendance or to interfere
              with another person&apos;s records.
            </p>
          </Section>

          <Section id="ai" title="7. AI-assisted features and educational resources">
            <p>
              Some features may use artificial intelligence or automated
              processing to provide answers, explanations, syllabus-related
              assistance, summaries, or other educational support.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                AI-generated responses may be inaccurate, incomplete, outdated,
                or misleading.
              </li>
              <li>
                AI output is not an official statement from GNDEC, a faculty
                member, or an examination authority.
              </li>
              <li>
                Verify important academic information against official materials
                and consult the appropriate faculty member when necessary.
              </li>
              <li>
                Previous-year papers, syllabus documents, FAQs, and other
                resources may be sourced from third parties or public
                institutional material. Their availability and accuracy are not
                guaranteed.
              </li>
            </ul>
            <p>
              Do not rely solely on AI-generated content for examinations,
              academic submissions, or important decisions.
            </p>
            <p>
              The Service supports a{" "}
              <strong className="text-foreground">
                bring-your-own-key (BYOK)
              </strong>{" "}
              model. Depending on the version and feature, you may select Groq,
              Google AI Studio/Gemini, or OpenRouter and provide your own API
              key. You are responsible for having the right to use the key,
              keeping it confidential, and reviewing the selected
              provider&apos;s terms, usage limits, and privacy policy. The
              Service does not guarantee that a provider will accept a key,
              remain available, or provide a particular model or response.
            </p>
            <p>
              Some deployments may also use limited server-side AI fallbacks.
              When a fallback is used, prompts or timetable content may be
              processed through NextLecture&apos;s backend and the configured AI
              provider. Do not submit passwords, payment details, sensitive
              personal information, or another person&apos;s confidential
              information in AI prompts or API-key fields.
            </p>
          </Section>

          <Section id="acceptable-use" title="8. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Use the Service for unlawful, fraudulent, abusive, or misleading
                purposes.
              </li>
              <li>
                Attempt to gain unauthorised access to the Service, its
                infrastructure, accounts, or data.
              </li>
              <li>
                Interfere with, overload, disrupt, reverse-engineer, or
                circumvent the security or normal operation of the Service.
              </li>
              <li>
                Scrape, harvest, reproduce, or republish Service data at scale
                without permission, except where permitted by applicable law.
              </li>
              <li>
                Impersonate another person or submit information that you are
                not authorised to share.
              </li>
              <li>
                Upload or transmit malicious code, spam, or content that
                infringes another person&apos;s rights.
              </li>
              <li>
                Use the Service to harass, threaten, expose, or misuse another
                person&apos;s information.
              </li>
            </ul>
            <p>
              We may restrict access to the Service where reasonably necessary
              to protect users, the Service, or its infrastructure, or to
              address misuse.
            </p>
          </Section>

          <Section id="ip" title="9. Intellectual property and third-party material">
            <p>
              The NextLecture name, original interface, original design
              elements, and original software are owned by their respective
              rights holders and are subject to the applicable licence or
              permissions.
            </p>
            <p>
              The NextLecture source code is made available under the licence
              stated in the relevant repositories. That licence governs
              permitted use of the code; it does not automatically grant rights
              to third-party content, institutional material, trademarks, or
              data.
            </p>
            <p>
              Timetables, notices, faculty information, logos, documents, and
              other third-party materials remain the property of their
              respective owners or publishers. NextLecture does not claim
              ownership of such material. If you believe content displayed
              through the Service infringes your rights or is inaccurate,
              contact us through the support channel below with sufficient
              details for review.
            </p>
            <p>
              Microsoft Clarity and other third-party names and trademarks
              belong to their respective owners. Their mention does not imply
              endorsement or affiliation.
            </p>
          </Section>

          <Section id="third-party" title="10. Third-party services and links">
            <p>
              The Service may depend on or link to third-party services,
              websites, APIs, hosting providers, analytics tools, AI providers,
              or institutional websites. These services may change, become
              unavailable, or operate under their own terms and privacy
              policies. Depending on the feature, third parties may include:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Vercel</strong> for web and
                serverless hosting:{" "}
                <a
                  href="https://vercel.com/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Vercel Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Vercel Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Supabase</strong> for
                database/backend services:{" "}
                <a
                  href="https://supabase.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Supabase Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Supabase Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">
                  Google Firebase Cloud Messaging
                </strong>{" "}
                for Android push notifications:{" "}
                <a
                  href="https://firebase.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Firebase Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://firebase.google.com/support/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Firebase Privacy and Security
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Microsoft Clarity</strong>{" "}
                for web analytics where enabled:{" "}
                <a
                  href="https://clarity.microsoft.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Clarity Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://privacy.microsoft.com/privacystatement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Microsoft Privacy Statement
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">
                  Groq, Google AI Studio/Gemini API, and OpenRouter
                </strong>{" "}
                for AI features, including BYOK requests:{" "}
                <a
                  href="https://groq.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Groq Privacy Policy
                </a>
                ,{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Google Privacy Policy
                </a>
                , and{" "}
                <a
                  href="https://openrouter.ai/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  OpenRouter Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">
                  GNDEC and other institutional sources
                </strong>{" "}
                for publicly available timetables, notices, documents, and
                related information.
              </li>
            </ul>
            <p>
              We do not control third-party services and are not responsible for
              their content, availability, security, or privacy practices. Your
              use of them may be subject to their own terms. Review the relevant
              provider terms before using a third-party feature or submitting
              information to it.
            </p>
          </Section>

          <Section id="availability" title="11. Availability, updates, and changes">
            <p>
              We aim to keep the Service useful and available, but we do not
              guarantee uninterrupted access, error-free operation,
              compatibility with every device, or continuous availability of any
              feature.
            </p>
            <p>
              We may update, modify, suspend, or discontinue features or the
              Service. We may also revise these Terms. The latest version
              published with its effective date will apply prospectively. If a
              change materially affects users, we will take reasonable steps to
              provide notice through the Service where practicable.
            </p>
          </Section>

          <Section id="disclaimers" title="12. Disclaimers">
            <p>
              To the maximum extent permitted by applicable law, the Service is
              provided on an{" "}
              <strong className="text-foreground">
                &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;
              </strong>{" "}
              basis, without warranties or guarantees, express or implied.
            </p>
            <p>We do not guarantee that:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Timetables, notices, faculty details, room availability, or
                other information will always be accurate or current.
              </li>
              <li>
                Notifications or background reminders will be delivered at a
                particular time or at all. Delivery may depend on device
                settings, operating-system restrictions, network connectivity,
                battery optimisation, and third-party services.
              </li>
              <li>
                AI-generated content will be correct or suitable for a
                particular purpose.
              </li>
              <li>
                Data stored on your device or through third-party services will
                always remain available.
              </li>
            </ul>
            <p>
              The Android application may offer a more reliable reminder
              experience on some devices, but no reminder is guaranteed. You
              remain responsible for checking your schedule and important
              announcements.
            </p>
            <p>
              Nothing in these Terms excludes any warranty, right, or remedy
              that cannot lawfully be excluded.
            </p>
          </Section>

          <Section id="liability" title="13. Limitation of liability">
            <p>
              To the maximum extent permitted by applicable law, the developer
              will not be liable for indirect, incidental, special, exemplary,
              or consequential loss arising from or related to your use of, or
              inability to use, the Service. This may include loss of data,
              missed lectures, missed reminders, academic consequences, or loss
              of profits.
            </p>
            <p>
              This section does not exclude or limit liability where such
              exclusion or limitation is prohibited by applicable law, including
              liability that cannot legally be waived.
            </p>
          </Section>

          <Section id="termination" title="14. Suspension and termination">
            <p>
              You may stop using the Service at any time. We may suspend or
              restrict access where reasonably necessary for security,
              maintenance, misuse prevention, legal compliance, or protection of
              the Service and its users.
            </p>
            <p>
              Sections that by their nature should continue after use
              ends—including intellectual property, disclaimers, limitation of
              liability, and governing law—will continue to apply.
            </p>
          </Section>

          <Section id="governing-law" title="15. Governing law and disputes">
            <p>
              These Terms are governed by the laws of India. Subject to any
              mandatory rights or jurisdiction available to users under
              applicable law, disputes relating to these Terms will be subject
              to the jurisdiction of the competent courts in India.
            </p>
            <p>
              Nothing in this section prevents a user from exercising a
              statutory right or remedy before a forum that has jurisdiction
              under applicable law.
            </p>
          </Section>

          <Section id="contact" title="16. Contact and support">
            <p>
              For questions, bug reports, or concerns about content displayed by
              NextLecture, contact the developer through the issue/support
              channel in the relevant repository:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Web application:</strong>{" "}
                <a
                  href="https://github.com/lsgzt/nextlecture-webapp/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  https://github.com/lsgzt/nextlecture-webapp/issues
                </a>
              </li>
              <li>
                <strong className="text-foreground">Android application:</strong>{" "}
                <a
                  href="https://github.com/lsgzt/nextlecture-android/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  https://github.com/lsgzt/nextlecture-android/issues
                </a>
              </li>
              <li>
                <strong className="text-foreground">Email:</strong>{" "}
                <a
                  href="mailto:lovepreet.singh.dev@gmail.com"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  lovepreet.singh.dev@gmail.com
                </a>
              </li>
            </ul>
            <p>
              Please do not post passwords, access tokens, private student
              information, or other sensitive data in public issues.
            </p>
          </Section>
        </article>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-teal-700/30 hover:text-teal-700 dark:hover:text-teal-300"
          >
            Back to Home
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-teal-700/30 hover:text-teal-700 dark:hover:text-teal-300"
          >
            Privacy Policy
          </Link>
          <Link
            href="/about-developer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-teal-700/30 hover:text-teal-700 dark:hover:text-teal-300"
          >
            About the Developer
          </Link>
        </div>
      </main>

      <footer className="container border-t border-border/70 py-10">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} NextLecture ·{" "}
          <Link
            href="/about-developer"
            className="font-semibold text-teal-700 underline decoration-teal-400 underline-offset-2 transition hover:text-teal-950 dark:text-teal-300 dark:hover:text-white"
          >
            Built and maintained by LSGZ
          </Link>
        </p>
      </footer>
    </div>
  );
}
