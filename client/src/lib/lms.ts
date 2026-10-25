import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_LMS_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_LMS_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const lmsSupabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

/**
 * When the Supabase environment is not configured the portal falls back to a
 * read-only sample dataset so the interface can still be explored. Every
 * write path becomes a no-op and `useLmsIdentity` substitutes sample profiles.
 */
export const lmsDemo = !lmsSupabase;

export type LmsRole = "student" | "teacher";
export type LoginLookup = { role: LmsRole; display_name: string };
export type Student = { email: string; name: string; crn: string; branch: string; section: string };
export type Teacher = { id: string; name: string; email: string; department: string | null; subject: string | null };
export type Course = { id: string; teacher_id: string; title: string; description: string; published: boolean; teacher?: Teacher; videos?: Video[] };
export type Video = { id: string; teacher_id: string; course_id: string; youtube_url: string; youtube_id: string; title: string; published: boolean; position: number; course?: Course; teacher?: Teacher };
export type ProgressRow = { student_email: string; video_id: string; watched_seconds: number; completed: boolean; last_watched_at: string };

/** One record from the official first-year section list (matched by CRN). */
export type OfficialRecord = {
  crn: string;
  registrationNumber: string;
  candidateName: string;
  fatherName: string;
  motherName: string;
  branch: string;
  section: string;
  subsection: string;
  group: string;
  mentorName: string;
  mentorMobile: string;
  venue: string;
};

export function requireLmsClient() {
  if (!lmsSupabase) throw new Error("LMS Supabase is not configured. Add VITE_LMS_SUPABASE_URL and VITE_LMS_SUPABASE_PUBLISHABLE_KEY.");
  return lmsSupabase;
}

/* ------------------------------------------------------------------ */
/* Sample dataset (used only when lmsDemo is true)                     */
/* ------------------------------------------------------------------ */

export const demoStudent: Student = {
  email: "arjun.mehta@gndec.ac.in",
  name: "Arjun Mehta",
  crn: "23102847",
  branch: "Computer Science & Engineering",
  section: "CSE-B",
};

/** Sample section-list record that matches the demo student's CRN. */
export const demoOfficialRecord: OfficialRecord = {
  crn: "23102847",
  registrationNumber: "23104016",
  candidateName: "Arjun Mehta",
  fatherName: "Harjeet Mehta",
  motherName: "Simran Mehta",
  branch: "CS",
  section: "CSA",
  subsection: "CSA2",
  group: "CSAM2",
  mentorName: "Dr. Navjot Kaur",
  mentorMobile: "9815500123",
  venue: "Data Structures Lab",
};

export const demoTeachers: Teacher[] = [
  { id: "t-hk", name: "Dr. Harpreet Kaur", email: "harpreet.kaur@gndec.ac.in", department: "Applied Sciences", subject: "Chemistry" },
  { id: "t-ms", name: "Prof. Manjit Singh", email: "manjit.singh@gndec.ac.in", department: "Mechanical Engineering", subject: "Engineering Mechanics" },
  { id: "t-as", name: "Prof. Arvind Sharma", email: "arvind.sharma@gndec.ac.in", department: "Mathematics", subject: "Calculus" },
  { id: "t-sk", name: "Dr. Simranjeet Kaur", email: "simranjeet.kaur@gndec.ac.in", department: "Computer Science", subject: "Programming Fundamentals" },
  { id: "t-rb", name: "Dr. Rajni Bala", email: "rajni.bala@gndec.ac.in", department: "Humanities", subject: "Communication Skills" },
  { id: "t-gs", name: "Prof. Gurpreet Singh", email: "gurpreet.singh@gndec.ac.in", department: "Electronics & Communication", subject: "Basic Electrical" },
];

export const demoTeacher = demoTeachers[1];

const rawDemoCourses: Omit<Course, "teacher" | "videos">[] = [
  { id: "c-em", teacher_id: "t-ms", title: "Engineering Mechanics — Statics & Dynamics", description: "Free-body diagrams to friction — the full first-year mechanics run, worked example by example.", published: true },
  { id: "c-chem", teacher_id: "t-hk", title: "Applied Chemistry for First Years", description: "Structure, bonding and thermodynamics, with the lab concepts that show up on every sessional.", published: true },
  { id: "c-calc", teacher_id: "t-as", title: "Calculus I — Limits & Derivatives", description: "From epsilon–delta to applications of derivatives, drawn out the way it was taught in class.", published: true },
  { id: "c-py", teacher_id: "t-sk", title: "Programming Fundamentals — Python & Beyond", description: "From your first print statement to a second language — the programming base every branch needs.", published: true },
  { id: "c-comm", teacher_id: "t-rb", title: "Communication Skills", description: "Technical writing, seminars and the presentation practice that carries into every viva.", published: true },
];

type RawVideo = Omit<Video, "course" | "teacher">;

/* Sample lessons point at real, public educational videos so the catalogue
   looks alive. Titles are written the way a teacher would name a session. */
const rawDemoVideos: RawVideo[] = [
  { id: "v-em-01", teacher_id: "t-ms", course_id: "c-em", youtube_url: "https://www.youtube.com/watch?v=wWnfJ0-xXRE", youtube_id: "wWnfJ0-xXRE", title: "Lecture 01 — Introduction: The Language of Physics", published: true, position: 1 },
  { id: "v-em-02", teacher_id: "t-ms", course_id: "c-em", youtube_url: "https://www.youtube.com/watch?v=ZM8ECpBuQYE", youtube_id: "ZM8ECpBuQYE", title: "Lecture 02 — Motion in a Straight Line", published: true, position: 2 },
  { id: "v-em-03", teacher_id: "t-ms", course_id: "c-em", youtube_url: "https://www.youtube.com/watch?v=HEfHFsfGXjs", youtube_id: "HEfHFsfGXjs", title: "Lecture 03 — Collisions, Energy & a Surprise from π", published: true, position: 3 },
  { id: "v-em-04", teacher_id: "t-ms", course_id: "c-em", youtube_url: "https://www.youtube.com/watch?v=kYIS7d0oQyw", youtube_id: "kYIS7d0oQyw", title: "Lecture 04 — Equilibrium of Rigid Bodies", published: true, position: 4 },
  { id: "v-calc-01", teacher_id: "t-as", course_id: "c-calc", youtube_url: "https://www.youtube.com/watch?v=WUvTyaaNkzM", youtube_id: "WUvTyaaNkzM", title: "Lecture 01 — The Essence of Calculus", published: true, position: 1 },
  { id: "v-calc-02", teacher_id: "t-as", course_id: "c-calc", youtube_url: "https://www.youtube.com/watch?v=9vKqVkMQHKk", youtube_id: "9vKqVkMQHKk", title: "Lecture 02 — The Paradox of the Derivative", published: true, position: 2 },
  { id: "v-calc-03", teacher_id: "t-as", course_id: "c-calc", youtube_url: "https://www.youtube.com/watch?v=S0_qX4VJhMQ", youtube_id: "S0_qX4VJhMQ", title: "Lecture 03 — Derivative Formulas Through Geometry", published: true, position: 3 },
  { id: "v-py-01", teacher_id: "t-sk", course_id: "c-py", youtube_url: "https://www.youtube.com/watch?v=rfscVS0vtbw", youtube_id: "rfscVS0vtbw", title: "Lecture 01 — Python: The Full Beginner's Run", published: true, position: 1 },
  { id: "v-py-02", teacher_id: "t-sk", course_id: "c-py", youtube_url: "https://www.youtube.com/watch?v=8mAITcNt710", youtube_id: "8mAITcNt710", title: "Lecture 02 — A Taste of Harvard's CS50", published: true, position: 2 },
  { id: "v-py-03", teacher_id: "t-sk", course_id: "c-py", youtube_url: "https://www.youtube.com/watch?v=PkZNo7MFNFg", youtube_id: "PkZNo7MFNFg", title: "Lecture 03 — JavaScript, a Second Language", published: true, position: 3 },
  { id: "v-chem-01", teacher_id: "t-hk", course_id: "c-chem", youtube_url: "https://www.youtube.com/watch?v=FSyAehMdpyI", youtube_id: "FSyAehMdpyI", title: "Lecture 01 — The Nucleus", published: true, position: 1 },
  { id: "v-chem-02", teacher_id: "t-hk", course_id: "c-chem", youtube_url: "https://www.youtube.com/watch?v=1k02pZmQCFU", youtube_id: "1k02pZmQCFU", title: "Lecture 02 — Atomic Structure & Orbitals", published: true, position: 2 },
  { id: "v-comm-01", teacher_id: "t-rb", course_id: "c-comm", youtube_url: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc", youtube_id: "Ks-_Mh1QhMc", title: "Guest Session — Body Language & Presence", published: true, position: 1 },
  { id: "v-comm-02", teacher_id: "t-rb", course_id: "c-comm", youtube_url: "https://www.youtube.com/watch?v=arj7oStGLkU", youtube_id: "arj7oStGLkU", title: "Guest Session — Inside the Procrastinating Mind", published: true, position: 2 },
  { id: "v-comm-03", teacher_id: "t-rb", course_id: "c-comm", youtube_url: "https://www.youtube.com/watch?v=iCvmsMzlF7o", youtube_id: "iCvmsMzlF7o", title: "Guest Session — The Power of Vulnerability", published: true, position: 3 },
  { id: "v-comm-04", teacher_id: "t-rb", course_id: "c-comm", youtube_url: "https://www.youtube.com/watch?v=iG9CE55wbtY", youtube_id: "iG9CE55wbtY", title: "Guest Session — Do Schools Kill Creativity?", published: true, position: 4 },
];

export const demoCourses: Course[] = rawDemoCourses.map((course) => {
  const full: Course = { ...course, teacher: demoTeachers.find((t) => t.id === course.teacher_id), videos: [] };
  full.videos = rawDemoVideos
    .filter((video) => video.course_id === course.id)
    .map((video) => ({ ...video, course: full, teacher: demoTeachers.find((t) => t.id === video.teacher_id) }));
  return full;
});

export const demoVideos: Video[] = demoCourses.flatMap((course) => course.videos ?? []);

export const demoProgress: ProgressRow[] = [
  { student_email: demoStudent.email, video_id: "v-em-01", watched_seconds: 9999, completed: true, last_watched_at: new Date(Date.now() - 30 * 36e5).toISOString() },
  { student_email: demoStudent.email, video_id: "v-em-02", watched_seconds: 1420, completed: false, last_watched_at: new Date(Date.now() - 4 * 36e5).toISOString() },
  { student_email: demoStudent.email, video_id: "v-calc-01", watched_seconds: 9999, completed: true, last_watched_at: new Date(Date.now() - 76 * 36e5).toISOString() },
];

function demoHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

let demoMyReaction: "like" | "dislike" | null = null;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function lookupLogin(email: string) {
  if (lmsDemo) return { role: "student" as LmsRole, display_name: "Sample Student" };
  const { data, error } = await requireLmsClient().rpc("lms_login_lookup", { login_email: email.trim().toLowerCase() });
  if (error) throw error;
  return (data?.[0] ?? null) as LoginLookup | null;
}

export async function sendMagicLink(email: string) {
  if (lmsDemo) return;
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/learn/login` : undefined;
  const { error } = await requireLmsClient().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* TEMPORARY no-email dev login                                        */
/* ------------------------------------------------------------------ */

/**
 * TEMPORARY DEV SWITCH — set to false once a real email provider is wired
 * up. While true the login form skips the magic-link email entirely: the
 * address is checked against the student/teacher roster and, on a match,
 * the caller is signed straight in with a shared dev password. The account
 * is provisioned/confirmed SERVER-SIDE (POST /api/lms/dev-login, which needs
 * LMS_SUPABASE_SERVICE_KEY in the server environment) so Supabase never
 * sends a verification email for these sign-ins.
 */
export const LMS_DEV_LOGIN = true;

/** Shared password used by the temporary no-email dev login. */
const LMS_DEV_PASSWORD = "nextlecture-dev-2026";

export async function devSignIn(email: string) {
  const client = requireLmsClient();
  const clean = email.trim().toLowerCase();

  // 1) The account may already carry the dev password — the happy path.
  const { data: signIn } = await client.auth.signInWithPassword({ email: clean, password: LMS_DEV_PASSWORD });
  if (signIn?.session) return;

  // 2) Ask the backend to provision/confirm the account with the dev
  //    password (email_confirm: true) — no email is ever sent.
  const response = await fetch("/api/lms/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: clean }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Could not prepare your sign-in. Try again shortly.");
  }

  // 3) Sign in with the password the backend just set.
  const { data: retry, error: retryError } = await client.auth.signInWithPassword({
    email: clean,
    password: LMS_DEV_PASSWORD,
  });
  if (retryError || !retry?.session) {
    throw new Error(retryError?.message ?? "Could not sign you in right now.");
  }
}

export async function getSession() {
  if (lmsDemo) return null;
  const { data } = await requireLmsClient().auth.getSession();
  return data.session;
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  if (lmsDemo) return () => undefined;
  const client = requireLmsClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function getCurrentRole(email: string) {
  if (lmsDemo) return "student" as const;
  const [student, teacher] = await Promise.all([getStudent(email), getTeacher(email)]);
  if (student) return "student" as const;
  if (teacher) return "teacher" as const;
  return null;
}

/* ------------------------------------------------------------------ */
/* Directory                                                           */
/* ------------------------------------------------------------------ */

export async function getStudent(email: string) {
  if (lmsDemo) return email.trim().toLowerCase() === demoStudent.email ? demoStudent : demoStudent;
  const { data, error } = await requireLmsClient().from("lms_students").select("email,name,crn,branch,section").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

export async function getTeacher(email: string) {
  if (lmsDemo) return email.trim().toLowerCase() === demoTeacher.email ? demoTeacher : null;
  const { data, error } = await requireLmsClient().from("lms_teachers").select("id,name,email,department,subject").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data as Teacher | null;
}

/**
 * The student's record from the official first-year section list, matched by
 * CRN through our server (which caches the public directory). Returns null when
 * the list is unreachable or the CRN has no match — callers degrade quietly.
 */
export async function getOfficialRecord(crn: string) {
  if (lmsDemo) return crn.trim() === demoOfficialRecord.crn ? demoOfficialRecord : null;
  const response = await fetch(`/api/lms/directory?crn=${encodeURIComponent(crn.trim())}`);
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as OfficialRecord | null;
  return data && typeof data.crn === "string" ? data : null;
}

export async function listTeachers() {
  if (lmsDemo) return demoTeachers;
  const { data, error } = await requireLmsClient().from("lms_teachers").select("id,name,email,department,subject").order("name");
  if (error) throw error;
  return (data ?? []) as Teacher[];
}

export async function listCourses() {
  if (lmsDemo) return demoCourses;
  const { data, error } = await requireLmsClient().from("lms_courses").select("id,teacher_id,title,description,published,lms_teachers(id,name,email,department,subject),lms_videos(id,teacher_id,course_id,youtube_url,youtube_id,title,published,position)").eq("published", true).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((course: any) => ({ ...course, teacher: course.lms_teachers, videos: course.lms_videos ?? [] })) as Course[];
}

export async function listVideos(filters?: { teacherId?: string; courseId?: string }) {
  if (lmsDemo) {
    let rows = demoVideos;
    if (filters?.teacherId) rows = rows.filter((video) => video.teacher_id === filters.teacherId);
    if (filters?.courseId) rows = rows.filter((video) => video.course_id === filters.courseId);
    return rows;
  }
  let query = requireLmsClient().from("lms_videos").select("id,teacher_id,course_id,youtube_url,youtube_id,title,published,position,lms_courses(id,teacher_id,title,description,published),lms_teachers(id,name,email,department,subject)").eq("published", true).order("position").order("created_at", { ascending: false });
  if (filters?.teacherId) query = query.eq("teacher_id", filters.teacherId);
  if (filters?.courseId) query = query.eq("course_id", filters.courseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((video: any) => ({ ...video, course: video.lms_courses, teacher: video.lms_teachers })) as Video[];
}

export async function getVideo(id: string) {
  if (lmsDemo) return demoVideos.find((video) => video.id === id) ?? null;
  const { data, error } = await requireLmsClient().from("lms_videos").select("id,teacher_id,course_id,youtube_url,youtube_id,title,published,position,lms_courses(id,teacher_id,title,description,published),lms_teachers(id,name,email,department,subject)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const video: any = data;
  return { ...video, course: video.lms_courses, teacher: video.lms_teachers } as Video;
}

/* ------------------------------------------------------------------ */
/* Teacher studio — publishing & deleting                              */
/* ------------------------------------------------------------------ */

export async function deleteVideo(videoId: string) {
  if (lmsDemo) {
    for (const course of demoCourses) {
      const videos = course.videos ?? [];
      const index = videos.findIndex((video) => video.id === videoId);
      if (index >= 0) videos.splice(index, 1);
    }
    return;
  }
  const { error } = await requireLmsClient().from("lms_videos").delete().eq("id", videoId);
  if (error) throw error;
}

export async function deleteCourse(courseId: string) {
  if (lmsDemo) {
    const index = demoCourses.findIndex((course) => course.id === courseId);
    if (index >= 0) demoCourses.splice(index, 1);
    return;
  }
  // lms_videos (and its progress/reactions) cascade from the course delete.
  const { error } = await requireLmsClient().from("lms_courses").delete().eq("id", courseId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Progress & reactions                                                */
/* ------------------------------------------------------------------ */

export async function getProgress(email: string, videoId?: string) {
  if (lmsDemo) {
    let rows = demoProgress.filter((row) => row.student_email === email.toLowerCase());
    if (videoId) rows = rows.filter((row) => row.video_id === videoId);
    return rows;
  }
  let query = requireLmsClient().from("lms_video_progress").select("student_email,video_id,watched_seconds,completed,last_watched_at").eq("student_email", email.toLowerCase());
  if (videoId) query = query.eq("video_id", videoId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProgressRow[];
}

export async function saveProgress(email: string, videoId: string, watchedSeconds: number, completed: boolean) {
  if (lmsDemo) {
    const row = demoProgress.find((item) => item.video_id === videoId);
    if (row) {
      row.watched_seconds = Math.max(0, Math.round(watchedSeconds));
      row.completed = completed;
      row.last_watched_at = new Date().toISOString();
    }
    return;
  }
  const { error } = await requireLmsClient().from("lms_video_progress").upsert({ student_email: email.toLowerCase(), video_id: videoId, watched_seconds: Math.max(0, Math.round(watchedSeconds)), completed, last_watched_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getReactionCounts(videoId: string) {
  if (lmsDemo) {
    const counts = { likes: 10 + (demoHash(videoId) % 38), dislikes: demoHash("d" + videoId) % 3 };
    if (demoMyReaction === "like") counts.likes += 1;
    if (demoMyReaction === "dislike") counts.dislikes += 1;
    return counts;
  }
  const { data, error } = await requireLmsClient().rpc("lms_reaction_counts", { target_video_id: videoId });
  if (error) throw error;
  return data?.[0] ?? { likes: 0, dislikes: 0 };
}

export async function setReaction(email: string, videoId: string, reaction: "like" | "dislike" | null) {
  if (lmsDemo) {
    demoMyReaction = reaction;
    return getReactionCounts(videoId);
  }
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
