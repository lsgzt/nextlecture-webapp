# Attendance Profile-Switch Investigation

## Reproduction and cause

The web client previously stored one browser-wide attendance installation ID. The attendance API treats an existing installation as authoritative when it creates a session. Consequently, changing the saved student profile while retaining that installation could keep the prior server attendance owner active, even though the next profile produced a different fingerprint. The attendance page also retained unscoped history while an earlier request was in flight, and individual lecture controls held their own status state.

## Deterministic verification

The automated client test now performs the reported sequence with two distinct saved profiles: student A → student B → student A. It verifies that every profile transition rotates the installation and session, each history request uses its matching owner, and the visible record sequence is A, B, then A rather than a reused record. The UI additionally clears scoped history on profile changes, ignores older history responses and mutations, and resets each lecture control when its profile scope changes.

This verification uses mocked identifiers and record keys only. It neither reads nor logs student attendance data.

## Deployment verification

Vercel production deployment `dpl_AYgkx5xNv3bHKjZMxk1MpDw9WB9J` reached `READY` for commit `5cf7f8ff131de065c8dd88dbddd1b07a9058144e` (`fix: isolate attendance when profiles switch`). The deployment serves `nextlecture.vercel.app` from the configured production Lambda runtime.

## Live two-profile isolation check

A token-safe production smoke test used two generated profile fingerprints and simulated the browser sequence profile A → profile B → profile A with distinct installations. While profile B was active, its live proxy history contained its generated record and not profile A’s. On returning to profile A, the live proxy history contained profile A’s record and not profile B’s. Both temporary records were deleted and their cleanup completed successfully. No bearer token, real profile, or personal attendance data was read or output.
