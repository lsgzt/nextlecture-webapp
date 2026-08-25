# Attendance Profile-Switch Investigation

## Reproduction and cause

The web client previously stored one browser-wide attendance installation ID. The attendance API treats an existing installation as authoritative when it creates a session. Consequently, changing the saved student profile while retaining that installation could keep the prior server attendance owner active, even though the next profile produced a different fingerprint. The attendance page also retained unscoped history while an earlier request was in flight, and individual lecture controls held their own status state.

## Deterministic verification

The automated client test now performs the reported sequence with two distinct saved profiles: student A → student B → student A. It verifies that every profile transition rotates the installation and session, each history request uses its matching owner, and the visible record sequence is A, B, then A rather than a reused record. The UI additionally clears scoped history on profile changes, ignores older history responses and mutations, and resets each lecture control when its profile scope changes.

This verification uses mocked identifiers and record keys only. It neither reads nor logs student attendance data.
