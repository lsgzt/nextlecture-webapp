import { ANDROID_APP_URL } from "@shared/config";

/**
 * Send the user to the hosted Android APK download page (MediaFire).
 */
export function startAndroidApkDownload() {
  if (typeof window === "undefined") return;
  window.location.assign(ANDROID_APP_URL);
}
