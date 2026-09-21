/**
 * Keep work alive after the HTTP response when possible (Vercel waitUntil).
 * Falls back to a detached promise elsewhere.
 */
export function scheduleBackground(task: Promise<unknown>): void {
  const guarded = task.catch(error => {
    console.warn("[Background] Task failed:", error instanceof Error ? error.message : error);
  });

  try {
    // Optional: only present on Vercel runtime / if the package is installed.
    // Avoid a hard dependency so CI lockfiles stay consistent on Hobby builds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeWaitUntil = (globalThis as any).waitUntil as undefined | ((p: Promise<unknown>) => void);
    if (typeof maybeWaitUntil === "function") {
      maybeWaitUntil(guarded);
      return;
    }
  } catch {
    // ignore
  }

  void guarded;
}
