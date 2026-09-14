import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getOfficialTimetable } from "./timetable";
import { getNoticeFeed } from "./campusFeeds";

const ANNOUNCEMENTS_URL = "https://raw.githubusercontent.com/lsgzt/nextlecture-android/main/announcements.json";
const RELEASE_URL = "https://api.github.com/repos/lsgzt/nextlecture-android/releases/latest";

type PushEvent = { id: string; type: string; title: string; body: string; url?: string };
type NotificationDb = SupabaseClient;

function getNotificationDb(): NotificationDb {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase notification database is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

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
  const db = getNotificationDb();
  const { error } = await db.from("fcm_tokens").upsert({
    token,
    platform: input.platform?.trim().slice(0, 32) || "android",
    app_version: input.appVersion?.trim().slice(0, 64) || null,
    active: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "token" });
  if (error) throw new Error(`FCM token registration failed: ${error.message}`);
}

async function getTokens() {
  const db = getNotificationDb();
  const { data, error } = await db.from("fcm_tokens").select("token").eq("active", true).limit(10000);
  if (error) throw new Error(`FCM token lookup failed: ${error.message}`);
  return (data ?? []).map(row => row.token as string);
}

async function wasAlreadySent(key: string, fingerprint: string) {
  const db = getNotificationDb();
  const { data, error } = await db.from("notification_state").select("fingerprint").eq("key", key).maybeSingle();
  if (error) throw new Error(`Notification state lookup failed: ${error.message}`);
  if (!data) {
    const inserted = await db.from("notification_state").insert({ key, fingerprint });
    if (inserted.error) throw new Error(`Notification state insert failed: ${inserted.error.message}`);
    return true;
  }
  if (data.fingerprint === fingerprint) return true;
  const updated = await db.from("notification_state").update({ fingerprint, updated_at: new Date().toISOString() }).eq("key", key);
  if (updated.error) throw new Error(`Notification state update failed: ${updated.error.message}`);
  return false;
}

async function sendEvent(event: PushEvent) {
  const tokens = await getTokens();
  if (!tokens.length) return { sent: false, reason: "no tokens" };
  if (await wasAlreadySent(event.type, hash(event.id))) return { sent: false, reason: "unchanged" };
  const messaging = getFirebaseMessaging();
  const db = getNotificationDb();
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
    for (let index = 0; index < response.responses.length; index += 1) {
      const failure = response.responses[index].error;
      if (failure?.code === "messaging/registration-token-not-registered" || failure?.code === "messaging/invalid-registration-token") {
        await db.from("fcm_tokens").update({ active: false }).eq("token", batch[index]);
      }
    }
  }
  return { sent };
}

export async function sendCustomNotification(input: { id?: string; title: string; body: string; url?: string }) {
  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 2000);
  if (!title || !body) throw new Error("title and body are required");
  return sendEvent({ id: input.id?.trim() || hash({ title, body }), type: "custom", title, body, url: input.url?.trim().slice(0, 1000) });
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
    getOfficialTimetable(true), getNoticeFeed(true), latestAnnouncement(),
    fetch(RELEASE_URL, { headers: { Accept: "application/vnd.github+json", "User-Agent": "NextLecture-notifier" }, signal: AbortSignal.timeout(15_000) }).then(async response => response.ok ? response.json() as Promise<{ tag_name?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean }> : null),
  ]);
  results.timetable = await sendEvent({ id: hash(timetable.cache.data), type: "timetable", title: "Timetable updated", body: "The official GNDEC timetable has changed. Open NextLecture to refresh your schedule." });
  const notice = notices.notices[0];
  if (notice) results.notice = await sendEvent({ id: notice.id, type: "notice", title: "New college notice", body: notice.title, url: notice.url });
  if (announcement) results.announcement = await sendEvent(announcement);
  if (release && release.tag_name && !release.draft && !release.prerelease) results.release = await sendEvent({ id: release.tag_name, type: "app_update", title: release.name || `NextLecture ${release.tag_name}`, body: "A new app update is available. Tap to download it." });
  return results;
}
