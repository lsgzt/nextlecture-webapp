create extension if not exists pgcrypto;

create table if not exists public.lms_students (
  email text primary key check (email = lower(email)),
  name text not null,
  crn text not null,
  branch text not null,
  section text not null,
  auth_user_id uuid unique,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique check (email = lower(email)),
  department text,
  subject text,
  auth_user_id uuid unique,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.lms_teachers(id) on delete cascade,
  title text not null,
  description text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_videos (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.lms_teachers(id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  youtube_url text not null,
  youtube_id text not null,
  title text not null,
  published boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, youtube_id)
);

create table if not exists public.lms_video_progress (
  student_email text not null references public.lms_students(email) on delete cascade,
  video_id uuid not null references public.lms_videos(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  primary key (student_email, video_id)
);

create table if not exists public.lms_video_reactions (
  student_email text not null references public.lms_students(email) on delete cascade,
  video_id uuid not null references public.lms_videos(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_email, video_id)
);

create index if not exists lms_courses_teacher_idx on public.lms_courses (teacher_id, published);
create index if not exists lms_videos_course_idx on public.lms_videos (course_id, published, position);
create index if not exists lms_progress_student_idx on public.lms_video_progress (student_email, completed);
create index if not exists lms_reactions_video_idx on public.lms_video_reactions (video_id, reaction);

alter table public.lms_students enable row level security;
alter table public.lms_teachers enable row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_videos enable row level security;
alter table public.lms_video_progress enable row level security;
alter table public.lms_video_reactions enable row level security;

drop policy if exists lms_students_self_read on public.lms_students;
create policy lms_students_self_read on public.lms_students for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists lms_teachers_self_read on public.lms_teachers;
create policy lms_teachers_self_read on public.lms_teachers for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists lms_courses_student_or_teacher_read on public.lms_courses;
create policy lms_courses_student_or_teacher_read on public.lms_courses for select to authenticated using (
  published = true
  and (
    exists (select 1 from public.lms_students s where lower(s.email) = lower(auth.jwt() ->> 'email'))
    or exists (select 1 from public.lms_teachers t where lower(t.email) = lower(auth.jwt() ->> 'email'))
  )
);

drop policy if exists lms_courses_teacher_insert on public.lms_courses;
create policy lms_courses_teacher_insert on public.lms_courses for insert to authenticated with check (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
);

drop policy if exists lms_courses_teacher_update on public.lms_courses;
create policy lms_courses_teacher_update on public.lms_courses for update to authenticated using (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
) with check (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
);

drop policy if exists lms_videos_student_or_teacher_read on public.lms_videos;
create policy lms_videos_student_or_teacher_read on public.lms_videos for select to authenticated using (
  published = true
  and (
    exists (select 1 from public.lms_students s where lower(s.email) = lower(auth.jwt() ->> 'email'))
    or exists (select 1 from public.lms_teachers t where lower(t.email) = lower(auth.jwt() ->> 'email'))
  )
);

drop policy if exists lms_videos_teacher_insert on public.lms_videos;
create policy lms_videos_teacher_insert on public.lms_videos for insert to authenticated with check (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
  and exists (select 1 from public.lms_courses c where c.id = course_id and c.teacher_id = teacher_id)
);

drop policy if exists lms_videos_teacher_update on public.lms_videos;
create policy lms_videos_teacher_update on public.lms_videos for update to authenticated using (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
) with check (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
);

drop policy if exists lms_progress_self_all on public.lms_video_progress;
create policy lms_progress_self_all on public.lms_video_progress for all to authenticated using (
  lower(student_email) = lower(auth.jwt() ->> 'email')
) with check (
  lower(student_email) = lower(auth.jwt() ->> 'email')
  and exists (select 1 from public.lms_students s where lower(s.email) = lower(auth.jwt() ->> 'email'))
);

drop policy if exists lms_reactions_self_all on public.lms_video_reactions;
create policy lms_reactions_self_all on public.lms_video_reactions for all to authenticated using (
  lower(student_email) = lower(auth.jwt() ->> 'email')
) with check (
  lower(student_email) = lower(auth.jwt() ->> 'email')
  and exists (select 1 from public.lms_students s where lower(s.email) = lower(auth.jwt() ->> 'email'))
);

create or replace function public.lms_reaction_counts(target_video_id uuid)
returns table (likes bigint, dislikes bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where reaction = 'like'),
    count(*) filter (where reaction = 'dislike')
  from public.lms_video_reactions
  where video_id = target_video_id;
$$;

grant execute on function public.lms_reaction_counts(uuid) to authenticated;

alter table public.lms_video_reactions replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lms_video_reactions'
  ) THEN
    alter publication supabase_realtime add table public.lms_video_reactions;
  END IF;
END $$;
