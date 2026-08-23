/**
 * Product settings deliberately kept in one place.
 * Replace ANDROID_APP_URL when the downloadable Android APK is ready.
 */
export const ANDROID_APP_URL = "https://github.com/lsgzt/nextlecture-android/releases/latest/download/gndec-timetable.apk";

/** Publicly served logo assets used by deployed headers and device icon metadata. */
export const BRAND_LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663345189289/xrndoJiVzCLAnaSr.png";

/** The single official source used by the server-side timetable fetcher. */
export const TIMETABLE_SOURCE_URL =
  "https://appsc.gndec.ac.in/sites/default/files/2026-08/09_08_2026%20FINAL_FILE_subgroups_days_horizontal.html";

/** Official index of the temporary-section documents used for first-run student profiles. */
export const TEMPORARY_SECTION_SOURCE_PAGE_URL = "https://appsc.gndec.ac.in/time_tables";

/** Official first-year syllabus PDF used only as Gemini document grounding for the Syllabus AI feature. */
export const SYLLABUS_SOURCE_URL = "https://appsc.gndec.ac.in/sites/default/files/2026-03/ss%20and%20Syllabus%20sem1%2C2%20Dec%202025%20unsigned.pdf";

/** Public Google Drive archive containing GNDEC previous-year examination papers. */
export const PREVIOUS_YEAR_PAPERS_SOURCE_URL = "https://drive.google.com/drive/folders/11ywkOKyeixCPihsCzqZDyzy2msLXxx6w";

/** Public API base path, retained as a clear configuration point for future API hosting changes. */
export const BACKEND_API_URL = "/api/trpc";

export const TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1000;
export const TEMPORARY_SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const SYLLABUS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
