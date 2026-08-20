# 2026 Temporary-Section Source Notes

The official GNDEC Applied Sciences timetable page at `https://appsc.gndec.ac.in/time_tables` now publishes revised 2026 **permanent-section** PDFs. The listed documents are branch-specific:

| Branch key | Official PDF |
|---|---|
| CE | `CE Permanent Sections 2026.pdf` |
| CS | `CS Permanent Sections 2026.pdf` |
| EC | `EC Permanent Sections 2026.pdf` |
| EE | `EE Permanent Sections 2026.pdf` |
| IT | `IT Permanent Sections 2026.pdf` |
| ME | `ME Permanent Sections 2026.pdf` |
| RAI | `RAI Permanent Sections 2026_0.pdf` |

The profile flow will discover these document URLs server-side from the official page rather than hard-coding a month-specific path. It must no longer extract or persist the serial-number column. The revised documents use **CRN** as the student roll number and provide student name, parent names, branch, section, subsection, mentoring group, mentor name, mentor mobile number, and venue. Name search will use normalized matching, and duplicate results will be labelled with the CRN. The UI will present every available official field and retain a manual entry path.

Visual inspection of the current official IT document at `https://appsc.gndec.ac.in/sites/default/files/2026-08/IT%20Permanent%20Sections%202026.pdf` confirmed the common schema: `S.No.`, `CRN`, `Student Name`, `Father Name`, `Mother Name`, `Branch`, `Section`, `Subsection`, `Mentoring Group`, `Mentor Name`, `Mentor's Mobile No.`, and `Venue`. The serial-number column is explicitly excluded from application records.

The GNDEC file host supports HTTP range requests but can respond slowly to full-document requests from the sandbox. The server therefore uses bounded range retrieval and caches validated branch payloads. The product must retain the manual profile path whenever no valid cache is available or the official document cannot be fetched within the request budget.

Live preparation verification completed for every supported branch. The validated source-derived record counts were CE 125, CS 376, EC (successful official lookup), EE 94, IT 188, ME 117, and RAI 61. Initial uncached preparation completed in roughly 21–53 seconds for the tested branches; subsequent reads were served from the server cache. The first-run UI therefore stages the branch preparation before enabling name search and keeps the manual-entry alternative visible.

Updated-format validation on August 20 completed for IT using the new permanent-section PDF. The CRN cache warmed in approximately 17 seconds and produced 189 current records. A representative CRN lookup returned every non-serial source field: student name, CRN, father name, mother name, branch, section, subsection, mentoring group, mentor name, mentor mobile number, and venue. The revised PDF is larger than the previous source; the server now uses 128 KiB bounded ranges with Axios’s default HTTPS transport, because the prior custom agent aborted valid source streams.

The mobile onboarding flow was also verified against the refreshed IT cache: searching `Aaditya` returned `Aaditya Koundal`, `ITA1`, mentoring group `ITAM1`, and `CRN 2621001`. No serial-number value is shown in search results.

Cold validation of every revised official branch PDF completed successfully: CE 126, CS 378, EC 126, EE 125, IT 189, ME 126, and RAI 63 student records. Each cold request completed in approximately 11–18 seconds locally; a warmed IT lookup completed in under one second.

Production verification on Vercel also succeeded for the new IT source: the `temporarySections.prepare` endpoint returned the official `IT Permanent Sections 2026.pdf` URL and `studentCount: 189` with a fresh cache result.

The live `temporarySections.profile` CRN lookup for `2621001` returned student name, CRN, both parent names, branch, section, subsection, mentoring group, mentor name, mentor mobile number, venue, source URL, and cache metadata. It did not return a serial-number field.
