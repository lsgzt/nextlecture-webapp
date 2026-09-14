import crypto from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { and, eq } from "drizzle-orm";
import { fcmTokens, notificationState } from "../drizzle/schema";
import { getDb } from "./db";
import { getOfficialTimetable } from "./timetable";
import { getNoticeFeed } from "./campusFeeds";

const ANNOUNCEMENTS_URL = "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/announcements.json";
const RELEASE_URL = "https://api.github.com/repos/lsgzt/nextlecture-android/releases/latest";

type PushEvent = { id: string; type: string; title: string; body: string; url?: string };

function hash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getFirebaseMessaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const credentials = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  const app = getApps()[0] ?? initializeApp({ credential: cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key.replace(/\\n/g, "\n"),
  }) });
  return getMessaging(app);
}

export async function registerFcmToken(input: { token: string; platform?: string; appVersion?: string }) {
  const token = input.token.trim();
  if (token.length < 50 || token.length > 4096) throw new Error("Invalid FCM token");
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(fcmTokens).values({
    token,
    platform: input.platform?.trim().slice(0, 32) || "android",
    appVersion: input.appVersion?.trim().slice(0, 64) || null,
    active: 1,
  }).onDuplicateKeyUpdate({ set: {
    platform: input.platform?.trim().slice(0, 32) || "android",
    appVersion: input.appVersion?.trim().slice(0, 64) || null,
    active: 1,
    lastSeenAt: new Date(),
  } });
}

async function getTokens() {
  const db = await getDb();
  if (!db) return [] as string[];
  const rows = await db.select({ token: fcmTokens.token }).from(fcmTokens).where(eq(fcmTokens.active, 1)).limit(10000);
  return rows.map(row => row.token);
}

async function wasAlreadySent(key: string, fingerprint: string) {
  const db = await getDb();
  if (!db) return true;
  const existing = await db.select({ fingerprint: notificationState.fingerprint }).from(notificationState).where(eq(notificationState.key, key)).limit(1);
  if (existing[0]?.fingerprint === fingerprint) return true;
  await db.insert(notificationState).values({ key, fingerprint }).onDuplicateKeyUpdate({ set: { fingerprint, updatedAt: new Date() } });
  return false;
}

async function sendEvent(event: PushEvent) {
  const tokens = await getTokens();
  if (!tokens.length) return { sent: false, reason: "no tokens" };
  if (await wasAlreadySent(event.type, hash(event.id))) return { sent: false, reason: "unchanged" };
  const messaging = getFirebaseMessaging();
  let sent = 0;
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batch = tokens.slice(offset, offset + 500);
    const response = await messaging.sendEach(batch.map(token => ({
      token,
      notification: { title: event.title, body: event.body },
      data: { type: event.type, id: event.id, title: event.title, body: event.body, ...(event.url ? { url: event.url } : {}) },
      android: { priority: "high", notification: { channelId: "timetable_updates_v2", clickAction: "OPEN_APP" } },
    })));
    sent += response.successCount;
    const db = await getDb();
    if (db) {
      for (let index = 0; index < response.responses.length; index += 1) {
        const failure = response.responses[index].error;
        if (failure?.code === "messaging/registration-token-not-registered" || failure?.code === "messaging/invalid-registration-token") {
          await db.update(fcmTokens).set({ active: 0 }).where(eq(fcmTokens.token, batch[index]));
        }
      }
    }
  }
  return { sent };
}

async function latestAnnouncement(): Promise<PushEvent | null> {
  const response = await fetch(ANNOUNCEMENTS_URL, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Announcements returned ${response.status}`);
  const feed = await response.json() as { announcements?: Array<{ id: string; title: string; message: string; active?: boolean }> };
  const item = (feed.announcements ?? []).filter(item => item.active !== false && item.id && item.title && item.message).at(-1);
  return item ? { id: item.id, type: "announcement", title: item.title, body: item.message } : null;
}

export async function runNotificationCheck() {
  const results: Record<string, unknown> = {};
  const [timetable, notices, announcement, release] = await Promise.all([
    getOfficialTimetable(true),
    getNoticeFeed(true),
    latestAnnouncement(),
    fetch(RELEASE_URL, { headers: { Accept: "application/vnd.github+json", "User-Agent": "NextLecture-notifier" }, signal: AbortSignal.timeout(15_000) }).then(async response => response.ok ? response.json() as Promise<{ tag_name?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean }> : null),
  ]);
  results.timetable = await sendEvent({ id: hash(timetable.cache.data), type: "timetable", title: "Timetable updated", body: "The official GNDEC timetable has changed. Open NextLecture to refresh your schedule." });
  const notice = notices.notices[0];
  if (notice) results.notice = await sendEvent({ id: notice.id, type: "notice", title: "New college notice", body: notice.title, url: notice.url });
  if (announcement) results.announcement = await sendEvent(announcement);
  if (release && release.tag_name && !release.draft && !release.prerelease) {
    results.release = await sendEvent({ id: release.tag_name, type: "app_update", title: release.name || `NextLecture ${release.tag_name}`, body: "A new app update is available. Tap to download it." });
  }
  return results;
}
