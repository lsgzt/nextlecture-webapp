import { ANDROID_APP_URL, ANDROID_RELEASES_API_URL } from "@shared/config";

const APK_FILENAME_FALLBACK = "NextLecture.apk";

/**
 * Resolve the current APK asset from GitHub Releases (asset names change per version).
 * Falls back to ANDROID_APP_URL when the API is unreachable.
 */
async function resolveApkDownloadUrl(): Promise<string> {
  try {
    const response = await fetch(ANDROID_RELEASES_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!response.ok) return ANDROID_APP_URL;
    const payload = (await response.json()) as {
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
    const asset = (payload.assets ?? []).find(
      item => typeof item.name === "string" && item.name.toLowerCase().endsWith(".apk") && typeof item.browser_download_url === "string",
    );
    return asset?.browser_download_url || ANDROID_APP_URL;
  } catch {
    return ANDROID_APP_URL;
  }
}

/**
 * Start the Android APK download in the current tab.
 * Hidden iframes are blocked by GitHub (X-Frame-Options) and fail silently on mobile.
 */
export async function startAndroidApkDownload() {
  if (typeof window === "undefined") return;

  const url = await resolveApkDownloadUrl();

  // Same-tab navigation reliably triggers the browser download for APK assets.
  // Cross-origin `download` attributes are ignored; location assign is the robust path.
  window.location.assign(url);
}

export function getAndroidApkFallbackUrl() {
  return ANDROID_APP_URL;
}

export { APK_FILENAME_FALLBACK };
