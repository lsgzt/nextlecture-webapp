import { BRAND_LOGO_URL } from "@shared/config";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

const PAGE_TITLE = "Privacy Policy — NextLecture";
const PAGE_DESCRIPTION =
  "Privacy Policy for the NextLecture website, Progressive Web App, and Android application used by GNDEC students.";

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

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Effective date:</strong> 2026-11-05
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Applies to the NextLecture website and web application (
          <a
            href="https://nextlecture.vercel.app"
            className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300 dark:hover:text-white"
          >
            https://nextlecture.vercel.app
          </a>
          ), its Progressive Web App (PWA), and the NextLecture Android
          application.
        </p>

        <article className="mt-10 space-y-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <Section id="overview" title="1. Overview">
            <p>
              NextLecture (&quot;the Service&quot;) is a student companion
              application for Guru Nanak Dev Engineering College (GNDEC). It
              helps students view timetable information, receive lecture
              reminders, manage attendance information, access college-related
              information, and use other academic features made available in the
              app.
            </p>
            <p>
              This Privacy Policy explains what information may be collected or
              processed when you use the Service, why it is used, which service
              providers may process it, how long it may be retained, and what
              choices are available to you.
            </p>
            <p>
              Some features may work locally on your device, while other
              features require information to be sent to our hosting, database,
              notification, analytics, or AI service providers. The information
              processed depends on the features you choose to use and the
              version of the Service.
            </p>
          </Section>

          <Section id="information-we-collect" title="2. Information we collect or process">
            <h3 className="text-base font-semibold text-foreground">
              2.1 Microsoft Clarity — web analytics and session recordings
            </h3>
            <p>
              The NextLecture website/web application may use{" "}
              <strong className="text-foreground">Microsoft Clarity</strong> to
              understand how visitors interact with the web app and to improve
              usability.
            </p>
            <p>Depending on your browser and the Clarity configuration, this may include:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Interaction events such as clicks, taps, scrolling, navigation,
                and time spent on pages.
              </li>
              <li>
                Session replay information showing interactions with pages and
                interface elements.
              </li>
              <li>
                Technical information such as browser type, device type,
                operating system, screen dimensions, language, referring page,
                and approximate location inferred from network information.
              </li>
              <li>Cookies or similar identifiers used for analytics.</li>
            </ul>
            <p>
              Clarity may capture parts of the page displayed in your browser.
              We configure masking for fields and content that should not be
              recorded, but masking is not a reason to enter passwords, payment
              details, or other highly sensitive information into the Service.
              We periodically review the configuration, but cannot guarantee
              that every item of page content will always be masked correctly.
            </p>
            <p>
              Microsoft processes Clarity data under its own terms and privacy
              documentation:{" "}
              <a
                href="https://privacy.microsoft.com/privacystatement"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
              >
                Microsoft Privacy Statement
              </a>{" "}
              and{" "}
              <a
                href="https://clarity.microsoft.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
              >
                Microsoft Clarity Terms
              </a>
              .
            </p>
            <p>
              Clarity is used for product analytics and troubleshooting, not as
              a tool for us to intentionally identify individual students.
              Clarity is used on the web experience; it is not used for Android
              screen recording unless this policy is updated to say otherwise.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.2 Information stored on your device
            </h3>
            <p>
              The Service may store information locally in browser storage, a
              PWA cache, or Android app storage so that features load faster and
              can work when connectivity is limited. Depending on the version
              and features you use, this may include:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Your selected academic year, branch, section, or timetable
                group.
              </li>
              <li>Cached timetable, dashboard, notices, or other content.</li>
              <li>
                Locally maintained attendance entries or attendance preferences,
                if that feature is implemented to store them on-device.
              </li>
              <li>App preferences and notification settings.</li>
            </ul>
            <p>
              Local data remains on your device unless a feature explicitly
              synchronizes it with a server. You can usually clear browser/site
              data through your browser settings or clear app data/uninstall the
              Android app through Android settings. Clearing local data may
              remove saved preferences, cached content, or locally stored
              attendance information.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.3 Timetable, college and public information
            </h3>
            <p>
              The Service retrieves, parses, displays, or reorganizes timetable
              and other college-related information from sources such as
              GNDEC&apos;s publicly available websites and notices. This may
              include timetables, holidays, faculty information, room or
              facility information, syllabi, and academic documents.
            </p>
            <p>
              The Service does not claim ownership of official college
              information. The accuracy, availability, and continued publication
              of source information are controlled by the relevant source. When
              you open an external source or website, that provider&apos;s
              privacy policy may apply.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.4 Supabase, database, and synchronized application data
            </h3>
            <p>
              Some NextLecture features use{" "}
              <strong className="text-foreground">Supabase</strong> as a
              backend/database provider. The reviewed code uses Supabase for
              synchronized attendance, faculty data, previous-question-paper
              data, notification registration records, notification state, and
              selected feed/cache data. Depending on the feature, this may
              include:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Academic selections such as year, branch, section, or timetable
                group.
              </li>
              <li>
                Attendance records, attendance summaries, or
                attendance-related preferences.
              </li>
              <li>Streak, leaderboard, or other participation values.</li>
              <li>
                An Android app installation&apos;s FCM token, platform, app
                version, and last-seen time.
              </li>
              <li>
                App settings or records you choose to save or synchronize.
              </li>
              <li>
                Technical records needed to operate, secure, and troubleshoot
                the feature.
              </li>
            </ul>
            <p>
              The web application also has a separate MySQL-compatible database
              connection configured through{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                DATABASE_URL
              </code>
              . The repository schema includes user records, timetable cache,
              and external-source cache. The actual database provider and
              enabled tables depend on the deployment.
            </p>
            <p>
              Only information actually collected by the deployed feature should
              be considered collected. The precise fields, tables, access rules,
              and retention periods depend on the current production
              configuration. The Android app may store profile information that
              you enter, such as a student name, roll or registration number,
              branch, section, parent or mentor details, and attendance-related
              settings, in the app&apos;s local settings store. The web
              application may process a name, email address, or account
              identifier when sign-in or authenticated features are used. Only
              fields required by the relevant feature should be collected, and
              the app should clearly explain that requirement.
            </p>
            <p>
              Supabase may process and store data on our behalf as a
              hosting/database service provider. See{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
              >
                Supabase Privacy Policy
              </a>
              .
            </p>
            <p>
              <strong className="text-foreground">Important:</strong> Some
              NextLecture functions may use separate databases or projects. Data
              in one project is not necessarily shared with another. This policy
              applies to the databases and services actually connected to the
              production NextLecture web and Android apps, not to unrelated test
              projects or separately operated tools.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.5 Android notifications and Firebase Cloud Messaging
            </h3>
            <p>
              The Android app may use{" "}
              <strong className="text-foreground">
                Firebase Cloud Messaging (FCM)
              </strong>{" "}
              to deliver push notifications, such as lecture reminders or
              important app updates, when that functionality is enabled.
            </p>
            <p>
              For push delivery, Firebase may process a device/app registration
              token and technical delivery information. The token identifies an
              app installation for notification delivery; it is not the same as
              your phone number. Notification scheduling or reminder logic may
              also be handled locally on your device, depending on the
              notification type.
            </p>
            <p>
              You can control notifications through Android&apos;s app
              notification settings. Disabling notifications may prevent you
              from receiving reminders or updates, but should not prevent use of
              unrelated app features.
            </p>
            <p>
              Firebase&apos;s privacy information is available at{" "}
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
              >
                Firebase Privacy and Security
              </a>
              .
            </p>
            <p>
              This section does not mean that NextLecture uses every Firebase
              product. Firebase Analytics, Crashlytics, Performance Monitoring,
              or other Firebase services should be disclosed separately if they
              are enabled in the production app.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.6 AI-powered features
            </h3>
            <p>
              Some features may use AI services to answer questions or help
              users understand academic information, such as syllabus-related
              questions or FAQs.
            </p>
            <p>
              When you submit a question to an AI-powered feature, the text of
              your question and the relevant context supplied to generate an
              answer may be sent to the AI provider configured for that feature.
              The provider may process that information to generate a response
              and may retain technical or request data under its own terms.
            </p>
            <p>
              Please do not submit passwords, financial details, private contact
              information, sensitive personal information, or another
              person&apos;s confidential information in AI prompts.
            </p>
            <p>
              NextLecture supports a{" "}
              <strong className="text-foreground">
                bring-your-own-key (BYOK)
              </strong>{" "}
              model for its AI features. You can choose an AI provider and enter
              that provider&apos;s API key yourself. The Android app stores
              provider keys in its app key store, and the web app stores a
              user-entered Gemini key in browser storage. NextLecture does not
              issue, sell, or provide these user API keys.
            </p>
            <p>
              Most user-selected AI requests are sent directly to the selected
              provider using the key you supply. The reviewed deployments also
              contain limited server-side fallback services configured with
              deployment secrets: the web application can use a
              server-configured Gemini key for syllabus responses, and the
              Android backend can use a server-configured Groq key for timetable
              normalization. When such a fallback is used, the relevant prompt
              or timetable content is sent through that backend and to the
              configured provider. Do not enter an API key that you are not
              authorized to use.
            </p>
            <p>The supported AI providers are:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Groq:</strong>{" "}
                <a
                  href="https://groq.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Groq Privacy Policy
                </a>
              </li>
              <li>
                <strong className="text-foreground">
                  Google AI Studio / Gemini API:
                </strong>{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <strong className="text-foreground">OpenRouter:</strong>{" "}
                <a
                  href="https://openrouter.ai/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  OpenRouter Privacy Policy
                </a>
              </li>
            </ul>
            <p>
              Your use of a provider is also subject to that provider&apos;s
              terms, privacy policy, retention settings, and applicable
              data-processing practices. Provider policies may change, and the
              provider may retain request data, logs, or technical information
              according to its own configuration and terms. Review the relevant
              provider documentation before submitting confidential or sensitive
              information.
            </p>
            <p>
              Where the app stores a BYOK key locally, it may remain in browser
              or Android app storage until you remove it, clear the relevant
              app/site data, or uninstall/reset the app. Do not submit
              passwords, financial details, private contact information,
              sensitive personal information, or another person&apos;s
              confidential information in an AI prompt or API-key field.
            </p>

            <h3 className="pt-2 text-base font-semibold text-foreground">
              2.7 Information you provide to the Service
            </h3>
            <p>
              If a feature lets you submit feedback, questions, support
              requests, or other content, we process the information you choose
              to provide so that we can respond or operate that feature. Do not
              include sensitive information unless it is necessary for the
              request.
            </p>
            <p>
              The current Service may not require account registration. If
              sign-in, profiles, or account-based features are introduced, this
              policy must be updated to explain the information collected, the
              purpose, and how accounts can be deleted.
            </p>
          </Section>

          <Section id="not-intentionally-collected" title="3. Information we do not intentionally collect">
            <p>
              Based on the current design, NextLecture is not intended to
              collect precise GPS location, read your contacts, or access your
              photos, files, or media merely to show your timetable.
            </p>
            <p>
              Do not interpret this section as a guarantee that no technical
              information is processed. Analytics, hosting, database, and
              notification providers may receive technical information needed to
              deliver their services.
            </p>
            <p>
              If a future feature requests access to location, contacts, camera,
              photos, files, or other device permissions, the app should explain
              why the permission is needed at the point of use and this policy
              should be updated.
            </p>
          </Section>

          <Section id="how-we-use" title="4. How we use information">
            <p>Depending on the features you use, information may be processed to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Display and personalize timetable and academic information.</li>
              <li>
                Save or synchronize attendance records and related summaries,
                where supported.
              </li>
              <li>
                Operate leaderboard, streak, or other app features, where
                enabled.
              </li>
              <li>Deliver push notifications and lecture reminders.</li>
              <li>Answer questions through AI-powered features.</li>
              <li>Cache information and support offline access.</li>
              <li>
                Understand app usage, diagnose errors, improve accessibility,
                and improve the user experience.
              </li>
              <li>
                Protect the Service against abuse, security incidents, or
                technical failures.
              </li>
              <li>Respond to feedback and support requests.</li>
            </ul>
            <p>
              We do not sell personal information. We do not use information
              collected through NextLecture to build advertising profiles for
              sale.
            </p>
          </Section>

          <Section id="how-shared" title="5. How information is shared">
            <p>
              We share or allow processing of information only where needed to
              operate the Service, comply with law, or protect the Service and
              its users. Depending on the features enabled, recipients may
              include:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Microsoft Clarity:</strong>{" "}
                web interaction analytics and session replay, as described in
                Section 2.1.
              </li>
              <li>
                <strong className="text-foreground">Supabase:</strong> database
                and backend hosting for features that synchronize information,
                as described in Section 2.4.
              </li>
              <li>
                <strong className="text-foreground">
                  Google Firebase / Firebase Cloud Messaging:
                </strong>{" "}
                push notification delivery and related technical token
                processing, as described in Section 2.5.
              </li>
              <li>
                <strong className="text-foreground">
                  Groq, Google AI Studio / Gemini API, and OpenRouter:
                </strong>{" "}
                processing of prompts, relevant context, API requests, and
                related technical information for AI-powered features, as
                described in Section 2.6. These services are used on a BYOK
                basis, so the user supplies the API key for the selected
                provider.
              </li>
              <li>
                <strong className="text-foreground">Vercel:</strong> hosts the
                web application and the Android app&apos;s supporting serverless
                backends and may process request, log, and security information.
                See{" "}
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
                <strong className="text-foreground">
                  Official college sources:
                </strong>{" "}
                NextLecture retrieves publicly available college information.
                This does not mean that NextLecture sends your personal
                attendance or device data to GNDEC.
              </li>
            </ul>
            <p>
              Service providers may process information under their own privacy
              terms and contractual arrangements. We do not authorize them to
              use information received through NextLecture for unrelated
              purposes, except where their own legal obligations or terms apply.
            </p>
            <p>
              We may also disclose information if required by applicable law, a
              valid legal process, or to protect users, the Service, or our
              legal rights.
            </p>
          </Section>

          <Section id="cookies" title="6. Cookies and similar technologies">
            <p>
              The web app may use cookies, local storage, cache, and similar
              technologies for essential functionality, saved preferences,
              offline support, and analytics. Microsoft Clarity may set or use
              cookies or similar identifiers for analytics.
            </p>
            <p>
              You can manage or block cookies through your browser settings.
              Blocking analytics cookies may reduce measurement, while blocking
              essential storage or cache may affect saved preferences or offline
              functionality.
            </p>
            <p>
              Where applicable law requires consent before non-essential
              analytics technologies are used, the Service should obtain that
              consent before enabling them.
            </p>
          </Section>

          <Section id="your-choices" title="7. Your choices and privacy rights">
            <p>
              Your rights depend on the laws that apply where you live.
              Depending on the applicable law, you may be able to request access
              to, correction of, deletion of, or restriction of certain personal
              information, or object to certain processing.
            </p>
            <p>You can:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Clear locally stored data through your browser or Android
                settings.
              </li>
              <li>Disable app notifications through Android settings.</li>
              <li>
                Use browser controls and any available Microsoft Clarity
                opt-out options to limit analytics.
              </li>
              <li>
                Contact the developer to ask what information is processed by a
                feature or to request help with information that can be
                associated with your request.
              </li>
            </ul>
            <p>
              Because some data may be stored locally and some may be processed
              by third-party providers, we may not be able to identify or delete
              a particular record without enough information to locate it. We
              will take reasonable steps to respond to valid requests and
              explain any legal or technical limits.
            </p>
            <p>
              For India, requests will be handled in accordance with applicable
              Indian data-protection law, including the Digital Personal Data
              Protection Act, 2023, to the extent its relevant provisions and
              rules apply. Users in other regions may have additional rights
              under laws such as the GDPR.
            </p>
            <p>
              You may also have the right to complain to the relevant
              data-protection authority or regulator.
            </p>
          </Section>

          <Section id="retention" title="8. Data retention and security">
            <p>
              Retention depends on the type of information and the feature
              involved:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Local device data:</strong>{" "}
                remains until you clear the relevant browser/app data or
                uninstall/reset the app.
              </li>
              <li>
                <strong className="text-foreground">Supabase records:</strong>{" "}
                retained only for as long as needed to provide the relevant
                feature, meet legitimate operational needs, or comply with
                applicable law. The reviewed code does not define a fixed
                automatic deletion period for these records; deletion and backup
                retention therefore depend on the configured database project,
                provider settings, and applicable law.
              </li>
              <li>
                <strong className="text-foreground">
                  FCM registration tokens and delivery data:
                </strong>{" "}
                retained by the relevant service for as long as needed for
                notification delivery and under Firebase&apos;s applicable
                retention practices.
              </li>
              <li>
                <strong className="text-foreground">Clarity analytics:</strong>{" "}
                retained according to the service settings and Microsoft&apos;s
                applicable terms and retention practices.
              </li>
              <li>
                <strong className="text-foreground">
                  AI requests and BYOK keys:
                </strong>{" "}
                AI requests are handled under the selected provider&apos;s
                terms, privacy policy, and retention settings. A BYOK key stored
                locally remains there until the user removes it or clears the
                relevant browser/app data, subject to the actual app
                implementation. We do not state a specific provider retention
                period because it depends on the selected provider and account
                configuration.
              </li>
            </ul>
            <p>
              We use reasonable technical and organizational measures intended
              to protect information. These may include access controls and
              security rules for backend services. No method of internet
              transmission or electronic storage is completely secure, and we
              cannot guarantee absolute security.
            </p>
            <p>
              If a security incident affects personal information, we will take
              steps required by applicable law.
            </p>
          </Section>

          <Section id="children" title="9. Children and age">
            <p>
              NextLecture is designed primarily for college students. It is not
              specifically directed at children. If you believe a child has
              provided personal information to the Service in circumstances
              where that is not permitted by applicable law, contact us so we
              can review the request.
            </p>
          </Section>

          <Section id="third-party" title="10. Third-party websites and services">
            <p>
              The Service may link to GNDEC websites, official documents,
              faculty information, external AI services, or other third-party
              websites. We do not control the privacy practices or content of
              those external services. Review their privacy policies before
              providing information to them.
            </p>
          </Section>

          <Section id="contact" title="11. Contact">
            <p>
              For privacy questions, data requests, or concerns, contact the
              developer:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Project:</strong>{" "}
                <a
                  href="https://github.com/lsgzt/nextlecture-webapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  NextLecture GitHub repository
                </a>
              </li>
              <li>
                <strong className="text-foreground">Android repository:</strong>{" "}
                <a
                  href="https://github.com/lsgzt/nextlecture-android"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline decoration-teal-400/60 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                >
                  NextLecture Android repository
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
              Please do not include passwords, authentication secrets, or
              unnecessary sensitive information in a privacy request.
            </p>
          </Section>

          <Section id="changes" title="12. Changes to this policy">
            <p>
              We may update this Privacy Policy when the Service, its features,
              its service providers, or applicable legal requirements change.
              The effective date at the top will be updated when a revised
              policy is published. We will make reasonable efforts to highlight
              material changes in the app or its repository.
            </p>
            <p>
              Your continued use of the Service does not replace any consent
              that applicable law requires us to obtain separately.
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
