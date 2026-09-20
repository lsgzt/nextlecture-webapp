/**
 * Keep work alive after the HTTP response on Vercel serverless.
 * Uses waitUntil when available so DB writes finish after the client response.
 */
import { waitUntil } from "@vercel/functions";

export function scheduleBackground(task: Promise<unknown>): void {
  const guarded = task.catch(error => {
    console.warn("[Background] Task failed:", error instanceof Error ? error.message : error);
  });
  try {
    waitUntil(guarded);
  } catch {
    void guarded;
  }
}
