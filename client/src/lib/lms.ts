import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_LMS_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_LMS_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const lmsSupabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export type LmsRole = "student" | "teacher";
export type LoginLookup = { role: LmsRole; display_name: string };
export type Student = { email: string; name: string; crn: string; branch: string; section: string };
export type Teacher = { id: string; name: string; email: string; department: string | null; subject: string | null };
export type Course = { id: string; teacher_id: string; title: string; description: string; published: boolean; teacher?: Teacher; videos?: Video[] };
export type Video = { id: string; teacher_id: string; course_id: string; youtube_url: string; youtube_id: string; title: string; published: boolean; position: number; course?: Course; teacher?: Teacher };

export function requireLmsClient() {
  if (!lmsSupabase) throw new Error("LMS Supabase is not configured. Add VITE_LMS_SUPABASE_URL and VITE_LMS_SUPABASE_PUBLISHABLE_KEY.");
  return lmsSupabase;
}

export async function lookupLogin(email: string) {
  const { data, error } = await requireLmsClient().rpc("lms_login_lookup", { login_email: email.trim().toLowerCase() });
  if (error) throw error;
  return (data?.[0] ?? null) as LoginLookup | null;
}

export async function sendOtp(email: string) {
  const { error } = await requireLmsClient().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyOtp(email: string, token: string) {
  const { data, error } = await requireLmsClient().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
  if (error) throw error;
  return data.session;
}

export async function getSession() {
  const { data } = await requireLmsClient().auth.getSession();
  return data.session;
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  const client = requireLmsClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function getCurrentRole(email: string) {
  const lookup = await lookupLogin(email);
  return lookup?.role ?? null;
}

export async function getStudent(email: string) {
  const { data, error } = await requireLmsClient().from("lms_students").select("email,name,crn,branch,section").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

export async function getTeacher(email: string) {
  const { data, error } = await requireLmsClient().from("lms_teachers").select("id,name,email,department,subject").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data as Teacher | null;
}

export async function listTeachers() {
  const { data, error } = await requireLmsClient().from("lms_teachers").select("id,name,email,department,subject").order("name");
  if (error) throw error;
  return (data ?? []) as Teacher[];
}

export async function listCourses() {
  const { data, error } = await requireLmsClient().from("lms_courses").select("id,teacher_id,title,description,published,lms_teachers(id,name,email,department,subject),lms_videos(id,teacher_id,course_id,youtube_url,youtube_id,title,published,position)").eq("published", true).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((course: any) => ({ ...course, teacher: course.lms_teachers, videos: course.lms_videos ?? [] })) as Course[];
}

export async function listVideos(filters?: { teacherId?: string; courseId?: string }) {
  let query = requireLmsClient().from("lms_videos").select("id,teacher_id,course_id,youtube_url,youtube_id,title,published,position,lms_courses(id,teacher_id,title,description,published),lms_teachers(id,name,email,department,subject)").eq("published", true).order("position").order("created_at", { ascending: false });
  if (filters?.teacherId) query = query.eq("teacher_id", filters.teacherId);
  if (filters?.courseId) query = query.eq("course_id", filters.courseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((video: any) => ({ ...video, course: video.lms_courses, teacher: video.lms_teachers })) as Video[];
}

export async function getVideo(id: string) {
  const { data, error } = await requireLmsClient().from("lms_videos").select("id,teacher_id,course_id,youtube_url,youtube_id,title,published,position,lms_courses(id,teacher_id,title,description,published),lms_teachers(id,name,email,department,subject)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const video: any = data;
  return { ...video, course: video.lms_courses, teacher: video.lms_teachers } as Video;
}

export async function getProgress(email: string, videoId?: string) {
  let query = requireLmsClient().from("lms_video_progress").select("student_email,video_id,watched_seconds,completed,last_watched_at").eq("student_email", email.toLowerCase());
  if (videoId) query = query.eq("video_id", videoId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveProgress(email: string, videoId: string, watchedSeconds: number, completed: boolean) {
  const { error } = await requireLmsClient().from("lms_video_progress").upsert({ student_email: email.toLowerCase(), video_id: videoId, watched_seconds: Math.max(0, Math.round(watchedSeconds)), completed, last_watched_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getReactionCounts(videoId: string) {
  const { data, error } = await requireLmsClient().rpc("lms_reaction_counts", { target_video_id: videoId });
  if (error) throw error;
  return data?.[0] ?? { likes: 0, dislikes: 0 };
}

export async function setReaction(email: string, videoId: string, reaction: "like" | "dislike" | null) {
  const client = requireLmsClient();
  if (!reaction) {
    const { error } = await client.from("lms_video_reactions").delete().eq("student_email", email.toLowerCase()).eq("video_id", videoId);
    if (error) throw error;
  } else {
    const { error } = await client.from("lms_video_reactions").upsert({ student_email: email.toLowerCase(), video_id: videoId, reaction, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  return getReactionCounts(videoId);
}
