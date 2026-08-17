# 2026 Temporary-Section Source Notes

The official GNDEC Applied Sciences timetable page at `https://appsc.gndec.ac.in/time_tables` currently publishes the required 2026 temporary-section PDFs. The listed documents are branch-specific:

| Branch key | Official PDF |
|---|---|
| CE | `CE Branch Temporary Sections 2026_0.pdf` |
| CS | `CS Branch Temporary Sections 2026_0.pdf` |
| EC | `EC Branch Temporary Sections 2026_0.pdf` |
| EE | `EE Branch Temporary Sections 2026_0.pdf` |
| IT | `IT Branch Temporary Sections 2026_0.pdf` |
| ME | `ME Branch Temporary Sections 2026_0.pdf` |
| RAI | `RAI Branch Temporary Sections 2026_0.pdf` |

The profile flow will discover these document URLs server-side from the official page rather than hard-coding a month-specific path. It will extract source-provided serial number (used by the document as roll number), registration number, student name, temporary section, and mentor when present. Name search will use normalized matching, and duplicate results will be labelled with the registration number. The UI will label all source-derived data as temporary-section information and retain a manual entry path.

Direct document extraction validated the common text schema on both the IT and CS documents: `Sr. No.`, `Candidate Name`, `Registration No.`, `Branch`, `T-Section`, `T-Subsection`, and `Mentor Name`. The IT document contains distinct same-name entries such as `KOMALPREET KAUR` under registration numbers `26011555` and `26014150`, both in `ITB2`, which confirms the need for registration-number result labels.

The GNDEC file host supports HTTP range requests but can respond slowly to full-document requests from the sandbox. The server therefore uses bounded range retrieval and caches validated branch payloads. The product must retain the manual profile path whenever no valid cache is available or the official document cannot be fetched within the request budget.

Live preparation verification completed for every supported branch. The validated source-derived record counts were CE 125, CS 376, EC (successful official lookup), EE 94, IT 188, ME 117, and RAI 61. Initial uncached preparation completed in roughly 21–53 seconds for the tested branches; subsequent reads were served from the server cache. The first-run UI therefore stages the branch preparation before enabling name search and keeps the manual-entry alternative visible.
