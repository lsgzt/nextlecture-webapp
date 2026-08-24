# Attendance integration notes

The production attendance API is `https://gndec-pyq-rag-api.vercel.app`. An unauthenticated history request returned an attendance-authentication error, confirming that history requires the opaque bearer session rather than an administrator credential.

The API rejected a browser-style cross-origin `DELETE` preflight from `https://nextlecture.vercel.app` with HTTP 403. NextLecture will therefore use its own same-origin server proxy for the four documented attendance routes. The proxy will forward only the student-issued opaque bearer token; it will not receive, store, or expose `PYQ_ADMIN_TOKEN`, Supabase credentials, or any other backend secret.

On the implementation date, a synthetic production smoke test successfully created a session, wrote a present mark, idempotently updated it to absent, read the updated history, deleted the temporary record, and verified cleanup. The smoke test used generated installation, fingerprint, and lecture values only, and did not print its opaque session token.

A second smoke test hosted the NextLecture Express app on a local ephemeral port with `ATTENDANCE_API_BASE` set for that process. It exercised the same-origin `/api/attendance/*` proxy end to end: session creation, present write, absent update, authenticated history read, clear/delete, and post-clear absence. The generated test record was removed successfully, and no opaque token or identity value was logged.

## Implementation contracts

The browser will generate a stable installation ID locally. Its attendance owner fingerprint is SHA-256 over `""|crn|branch|subsection|studentName`, because the existing GNDEC profile model does not expose a separate registration-number field and CRN is its documented roll-number value. The browser sends only that digest plus branch, subsection, and timetable group to the session endpoint.

Opaque session tokens and the selected target percentage remain device-local under versioned `nextlecture:attendance:*` keys. Targets default to 75% and are clamped to 50–100%; target changes recalculate guidance locally without reloading history. Lecture keys hash the selected local date, saved subsection, start and end minutes, subject, teacher, and venue in the Android-compatible order.
