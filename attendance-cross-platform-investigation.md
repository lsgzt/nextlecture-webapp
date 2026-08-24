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

## Planned web-only correction

The web profile will persist a registration-number compatibility field and allow a student to supply the same registration number used by Android. The attendance session will then use the Android-compatible fingerprint and preserve the saved subsection. Attendance controls will remain only on `/attendance`; the timetable dashboard will retain its existing View attendance link and return to a timetable-first layout.

## Local UI verification

With a test-only saved profile, the local `/app` dashboard showed the profile card, a single `View attendance` action, the next-lecture card, and the day schedule. It no longer rendered the expanded quick-mark attendance card or any present/absent/clear controls. The local `/attendance` route showed the Android-link registration-number field, the existing attendance summary, date picker, and backfill controls.

## Production API compatibility smoke test

A token-safe synthetic test created an Android-style attendance session with a generated profile fingerprint, saved a present record, created a separate web-style installation session with that exact fingerprint, and confirmed that the second session recovered the same server owner and read the Android-created record. It then deleted the generated record and verified it was absent from a final history read. No real student profile, bearer token, or persistent test data was used.
