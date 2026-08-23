# Previous Year Papers Source Notes

The user-provided public Google Drive folder is titled **Question Papers of Previous Semesters**. Its top-level archive is organized by examination session: main May and November folders from 2013 through 2025, plus dedicated makeup-session folders from May 2022 onward. The application should preserve this source organization while offering a simpler student-facing session browser.

The visible archive includes 2013–2019 May/November sessions, November 2020, May/November 2021, and every main May/November session from 2022–2025. Makeup folders are present for May and November 2022, 2023, 2024, and 2025.

Source folder: <https://drive.google.com/drive/folders/11ywkOKyeixCPihsCzqZDyzy2msLXxx6w>

Implementation note: each session is represented by its public Drive folder identifier. The app fetches the selected public session server-side and derives a direct `drive.google.com/file/d/{id}/view` link and download link for every PDF in that folder. The May 2025 folder was inspected live and contains 50 readable PDF entries, including `BBA-631.pdf`, `BBA-632.pdf`, and `BBA101-18.pdf`.

The source can be localized by Google Drive (for example, the sharing label appears as `Partagé` in French). The catalog parser recognizes both English and localized Drive row labels while retaining direct PDF file identifiers.

Representative validation: live server-side discovery returned 50 direct PDFs for each checked session: regular May 2025 (`BBA-631.pdf` first), makeup May 2024 (`BBA201-18.pdf` first), regular November 2023 (`BBA101-18.pdf` first), and makeup November 2022 (`BBA301-18.pdf` first). This validates regular and makeup catalog parsing across multiple archive years.

Production validation: the deployed `/papers` page successfully loaded 50 direct PDFs for regular May 2025, with in-app open and download controls pointing to the original Google Drive files.
