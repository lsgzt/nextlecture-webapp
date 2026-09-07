import { ANDROID_APP_URL } from "@shared/config";

/**
 * Start the Android APK download without opening a new tab or leaving the page.
 * A hidden iframe loads the release asset URL; GitHub responds with
 * Content-Disposition: attachment so the browser saves the file in place.
 */
export function startAndroidApkDownload() {
  if (typeof document === "undefined") return;

  // Remove any previous download frame.
  document.getElementById("nextlecture-apk-download-frame")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "nextlecture-apk-download-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px";
  iframe.src = ANDROID_APP_URL;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    iframe.remove();
  }, 120_000);
}
