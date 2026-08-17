/**
 * Product settings deliberately kept in one place.
 * Replace ANDROID_APP_URL when the downloadable Android APK is ready.
 */
export const ANDROID_APP_URL = "https://github.com/lsgzt/nextlecture-android/releases/latest/download/gndec-timetable.apk";

/** The single official source used by the server-side timetable fetcher. */
export const TIMETABLE_SOURCE_URL =
  "https://appsc.gndec.ac.in/sites/default/files/2026-08/09_08_2026%20FINAL_FILE_subgroups_days_horizontal.html";

/** Public API base path, retained as a clear configuration point for future API hosting changes. */
export const BACKEND_API_URL = "/api/trpc";

export const TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1000;
