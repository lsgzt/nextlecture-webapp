# Android and web attendance compatibility investigation

## Source inspected

The Android backend and client were read from the user-authorized repository at `https://github.com/lsgzt/nextlecture-android/tree/main/backend/pyq-rag` on the `main` branch. This investigation is read-only; no Android, API, database, or Supabase source was changed.

## Verified Android contract

The Android app creates the attendance owner fingerprint as the lower-case SHA-256 hash of this exact UTF-8 string:

```text
registrationNumber|rollNumber|branch|studentSubsection|studentName
```

It uses the permanent 2026 student-directory record’s `registrationNumber`, `crn` as the roll number, `branch`, `subsection`, and `candidateName`. Its lecture key hashes `date|lecture.groupName|startMinutes|endMinutes|subject|teacher|venue`, all joined with `|`. The API recovers a reinstalled device by matching the exact profile fingerprint, then choosing the owner with the most records and the most recent activity.

The deployed API accepts session creation at `POST /api/attendance/session`, history at `GET /api/attendance`, upserts at `POST /api/attendance/records`, and deletion at `DELETE /api/attendance/records`. Upsert responses are wrapped as `{ "record": ... }`, while delete returns HTTP 204.

## Web mismatch identified

The current web profile persists CRN but not registration number. Its attendance fingerprint begins with an empty registration component, so it cannot equal the Android owner fingerprint for the same student. This causes the API to create a second attendance owner, leaving Android-created records outside the web history. The web client also needs to normalize the API’s `{ record }` write envelope.

## CRN-based web linking

The web app now links attendance through the saved **CRN**: CRN, branch, subsection, and name define its local profile scope, session rotation, and the user-facing sync state. The attendance screen no longer asks students to enter a registration number. For profiles found in the verified directory, the existing server-compatible fingerprint is assembled internally with the directory’s verified registration value because the unchanged Android/API contract requires that opaque value to recover Android-created records. This preserves Android sync while making CRN the only attendance identity input or choice on web.

## Local UI verification

With a test-only saved profile, the local `/app` dashboard showed the profile card, a single `View attendance` action, the next-lecture card, and the day schedule. It no longer rendered the expanded quick-mark attendance card or any present/absent/clear controls. The local `/attendance` route showed CRN-based Android sync status, the existing attendance summary, date picker, and backfill controls without a registration-number input.

## Production API compatibility smoke test

A token-safe synthetic test created an Android-style attendance session with a generated profile fingerprint, saved a present record, created a separate web-style installation session with that exact fingerprint, and confirmed that the second session recovered the same server owner and read the Android-created record. It then deleted the generated record and verified it was absent from a final history read. No real student profile, bearer token, or persistent test data was used.

## Automatic recovery verification

The web profile recovery route uses the exact CRN, branch, name, and subsection from a saved official web profile to find its matching Android registration number in the published permanent student directory. In a local end-to-end UI check, an existing official profile was automatically matched, its local attendance installation and session were rotated, and the page reported that it was loading shared server history. The deployed Vercel tRPC route for the same synthetic lookup returned HTTP 200. Together with the production API owner-recovery smoke test, this verifies the web path now creates the same attendance owner identity as Android without re-marking records.

The live `nextlecture.vercel.app` proxy was also verified with generated identities only. An Android-style installation created a present record through the deployed NextLecture proxy; a second web-style installation with the same profile fingerprint recovered that owner and read the record through the same proxy. The record was then updated, deleted, and confirmed absent from a final read. No bearer token, real attendance record, or personal student data was displayed.

## Owner verification

The account owner subsequently confirmed that the deployed web flow worked correctly with their own Android attendance records. No individual attendance details were accessed, displayed, or retained during that confirmation.

## CRN-link deployment

The CRN-linked web interface and expanded timetable navigation deployed to `nextlecture.vercel.app` in Vercel deployment `dpl_9Hq72WW6DtjwTxee6waJbhHZ26Pn`, which reached `READY` for commit `198b6acb28d881d51b9b8216645b883409c87500`. A production dashboard request loaded the current application shell and selected timetable group; timetable data continued to resolve through the existing official-first flow.

After the production timetable settled, the dashboard displayed the new **Today**, **Tomorrow**, and **Full week** controls. Selecting **Tomorrow** showed the next calendar day’s date and its ITB2 lecture schedule through the live official-first timetable response.

Selecting **Full week** rendered the deployed Monday-to-Friday timetable, including each weekday’s lecture count and schedule. The production attendance route correctly showed the profile prerequisite in a clean browser without a saved student profile; the CRN-linked sync panel is intentionally shown only after a profile has been set up.

The production ITB2 dashboard then settled with the official timetable, the profile setup entry point, and all three schedule controls available. A synthetic profile is used only for the following UI-surface check and is not connected to any real student attendance record.

The final CRN-only manual-profile correction deployed in ready Vercel deployment `dpl_2jS1qn5SwYweGB5C6PgwRE6rZ7sh` for commit `05a46c7290fee34b86f1680412f851570c42d87c`. A refreshed production dashboard continued to show the official ITB2 timetable and all three schedule controls.

In the live manual-profile form, a synthetic profile was accepted with a name, CRN, section, and subsection. The form requested **Class Roll Number (CRN)** and no longer displayed a registration-number field or Android-link wording.

The saved synthetic profile opened the live attendance route, where the sync panel read **Linked by your CRN** and contained no registration-number input. Its unmatched synthetic CRN correctly produced a private empty attendance record, while the existing server-backed flow remains available for verified official profiles through the unchanged internal compatibility lookup.

For the post-change synthetic mark check, the initial live page state remained empty after selecting a Present action; no success or failure message was yet visible in the rendered view. The verification therefore remains in progress until the asynchronous request and cleanup state are confirmed.

After waiting for the request state, the rendered summary still showed no marks and the browser console contained no client-side error. The synthetic post-change mark behavior is being inspected further before this check is considered complete.

The first browser-automation click did not await the asynchronous mutation. A controlled follow-up in the live page waited for completion and confirmed the enabled control changed to `aria-pressed=true` with the visible `Marked present` state and no alert. This verifies that the deployed CRN-linked attendance page completed the synthetic server-backed Present write; reload and cleanup are being verified next.

After reloading the live attendance page, the synthetic record was read back as `1 present · 0 absent` with a 100% summary and `Marked present` on the correct lecture. This confirms the deployed CRN-linked flow performed a server-backed write and subsequent history read.

The synthetic Clear request was followed by a fresh reload that returned to `No lectures marked yet`, confirming cleanup of the temporary record. The final live sequence therefore verified CRN-linked page UI, server-backed write, persisted history read, and record removal without using real student data or displaying a bearer token.
