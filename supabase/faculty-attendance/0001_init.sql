-- =============================================================================
-- NextLecture Faculty Attendance — attendance_record project
-- Migration 0001: schema, RLS, and server-verified functions
-- =============================================================================
-- Apply this ONCE in the "attendance_record" Supabase project
-- (SQL Editor → paste → Run). It is fully idempotent: re-running is safe.
--
-- It creates ONLY public.faculty_* tables. It never touches auth.*, storage.*
-- or any other schema beyond its own functions/policies/triggers.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. Tables
-- =============================================================================

-- Teacher profiles, linked 1:1 to the project's Supabase Auth users.
create table if not exists public.faculty_teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique check (email = lower(email)),
  department text,
  designation text,
  profile_id text,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faculty_teachers is
  'Faculty attendance teacher directory. id IS the Supabase Auth user id (attendance_record project only).';

-- Independent copy of the official student roster needed for attendance.
create table if not exists public.faculty_students (
  id uuid primary key default gen_random_uuid(),
  roll_number text not null unique,
  crn text,
  full_name text not null check (full_name <> ''),
  branch text not null,
  year integer not null default 1 check (year between 1 and 6),
  section text not null,
  subsection text,
  timetable_group text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faculty_students is
  'Read-only copy of the official student roster (synced from the public first-year directory). roll_number = university registration number.';

create index if not exists faculty_students_group_idx on public.faculty_students (timetable_group, is_active);
create index if not exists faculty_students_section_idx on public.faculty_students (branch, year, section);
create index if not exists faculty_students_name_idx on public.faculty_students (full_name);

-- Which teacher may mark attendance for which subject and group.
create table if not exists public.faculty_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.faculty_teachers(id) on delete cascade,
  subject_name text not null,
  branch text,
  year integer,
  section text,
  timetable_group text not null,
  lecture_types text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, subject_name, timetable_group)
);

create index if not exists faculty_assignments_teacher_idx on public.faculty_teaching_assignments (teacher_id, is_active);
create index if not exists faculty_assignments_group_idx on public.faculty_teaching_assignments (timetable_group);

comment on table public.faculty_teaching_assignments is
  'Authorization matrix: one row per (teacher, subject, timetable group). Populated only by the admin sync process.';

-- Weekly timetable slots per teacher (copied from the official GNDEC timetable).
create table if not exists public.faculty_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.faculty_teachers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 4),
  start_time time not null,
  end_time time not null,
  subject_name text not null,
  branch text,
  year integer,
  section text,
  timetable_group text not null,
  lecture_type text check (lecture_type in ('L', 'T', 'P')),
  venue text,
  source_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, day_of_week, start_time, timetable_group, subject_name)
);

create index if not exists faculty_slots_day_idx on public.faculty_timetable_slots (teacher_id, day_of_week, start_time);

comment on table public.faculty_timetable_slots is
  'Per-teacher weekly schedule. timetable_group may be composite ("CSF1+CSF2") for jointly-attended lectures.';

-- One submitted attendance session for one held class.
create table if not exists public.faculty_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.faculty_teachers(id) on delete cascade,
  subject_name text not null,
  attendance_date date not null,
  start_time time not null,
  end_time time not null,
  branch text,
  year integer,
  section text,
  timetable_group text not null,
  lecture_type text check (lecture_type in ('L', 'T', 'P')),
  venue text,
  status text not null default 'submitted' check (status in ('submitted')),
  total_students integer not null default 0 check (total_students >= 0),
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, attendance_date, start_time, timetable_group)
);

create index if not exists faculty_sessions_teacher_date_idx on public.faculty_attendance_sessions (teacher_id, attendance_date desc);
create index if not exists faculty_sessions_group_idx on public.faculty_attendance_sessions (timetable_group, attendance_date desc);

comment on table public.faculty_attendance_sessions is
  'Submitted attendance sessions. The unique constraint prevents duplicate submissions of the same class.';

-- Per-student attendance status inside one session.
create table if not exists public.faculty_attendance_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.faculty_attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.faculty_students(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  marked_by uuid references public.faculty_teachers(id) on delete set null,
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists faculty_entries_session_idx on public.faculty_attendance_entries (session_id);
create index if not exists faculty_entries_student_idx on public.faculty_attendance_entries (student_id);

comment on table public.faculty_attendance_entries is
  'One attendance mark per (session, student). Written only by faculty_submit_attendance / faculty_correct_attendance.';

-- Audit trail for submissions and corrections.
create table if not exists public.faculty_attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.faculty_attendance_sessions(id) on delete cascade,
  student_id uuid references public.faculty_students(id) on delete set null,
  actor_id uuid references public.faculty_teachers(id) on delete set null,
  action text not null check (action in ('submit', 'correct')),
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists faculty_audit_session_idx on public.faculty_attendance_audit_log (session_id, created_at desc);
create index if not exists faculty_audit_actor_idx on public.faculty_attendance_audit_log (actor_id, created_at desc);

comment on table public.faculty_attendance_audit_log is
  'Immutable trail: one row per submission (student_id null) and one row per correction (with reason).';

-- Sync run history + validation reports.
create table if not exists public.faculty_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  report jsonb not null default '{}'::jsonb
);

-- =============================================================================
-- 2. updated_at maintenance
-- =============================================================================

create or replace function public.faculty_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'faculty_teachers', 'faculty_students', 'faculty_teaching_assignments',
    'faculty_timetable_slots', 'faculty_attendance_sessions', 'faculty_attendance_entries'
  ]
  loop
    execute format('drop trigger if exists faculty_touch_%s on public.%I', t, t);
    execute format('create trigger faculty_touch_%s before update on public.%I
                    for each row execute function public.faculty_touch_updated_at()', t, t);
  end loop;
end;
$$;

-- =============================================================================
-- 3. Helper functions
-- =============================================================================

-- Resolves the calling Auth user to an ACTIVE teacher id (or null).
create or replace function public.faculty_current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.faculty_teachers t
  where t.id = auth.uid()
    and t.is_active = true
  limit 1
$$;

-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

alter table public.faculty_teachers enable row level security;
alter table public.faculty_students enable row level security;
alter table public.faculty_teaching_assignments enable row level security;
alter table public.faculty_timetable_slots enable row level security;
alter table public.faculty_attendance_sessions enable row level security;
alter table public.faculty_attendance_entries enable row level security;
alter table public.faculty_attendance_audit_log enable row level security;
alter table public.faculty_sync_runs enable row level security;

-- ---- faculty_teachers: a teacher reads ONLY their own profile ---------------
drop policy if exists faculty_teachers_self_read on public.faculty_teachers;
create policy faculty_teachers_self_read on public.faculty_teachers
  for select to authenticated
  using (id = auth.uid() and is_active = true);
-- No insert/update/delete policies: provisioning and any profile edits are
-- admin (service-role) only, so teachers can never change their own state,
-- activation, or identity.

-- ---- faculty_students: teachers see ONLY students in their assigned groups --
drop policy if exists faculty_students_assigned_read on public.faculty_students;
create policy faculty_students_assigned_read on public.faculty_students
  for select to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.faculty_teaching_assignments a
      where a.teacher_id = public.faculty_current_teacher_id()
        and a.is_active = true
        and a.timetable_group = faculty_students.timetable_group
    )
  );
-- No write policies: roster maintenance is admin (service-role) only.

-- ---- faculty_teaching_assignments: teachers read their own ------------------
drop policy if exists faculty_assignments_self_read on public.faculty_teaching_assignments;
create policy faculty_assignments_self_read on public.faculty_teaching_assignments
  for select to authenticated
  using (
    teacher_id = public.faculty_current_teacher_id()
    and is_active = true
  );
-- No write policies: assignment management is admin (service-role) only.

-- ---- faculty_timetable_slots: teachers read their own schedule --------------
drop policy if exists faculty_slots_self_read on public.faculty_timetable_slots;
create policy faculty_slots_self_read on public.faculty_timetable_slots
  for select to authenticated
  using (
    teacher_id = public.faculty_current_teacher_id()
    and is_active = true
  );

-- ---- faculty_attendance_sessions: teachers read their own sessions ---------
drop policy if exists faculty_sessions_self_read on public.faculty_attendance_sessions;
create policy faculty_sessions_self_read on public.faculty_attendance_sessions
  for select to authenticated
  using (teacher_id = public.faculty_current_teacher_id());
-- No direct write policies: sessions are created ONLY by
-- faculty_submit_attendance (which re-verifies authorization server-side).

-- ---- faculty_attendance_entries: teachers read entries of their sessions ---
drop policy if exists faculty_entries_self_read on public.faculty_attendance_entries;
create policy faculty_entries_self_read on public.faculty_attendance_entries
  for select to authenticated
  using (
    exists (
      select 1
      from public.faculty_attendance_sessions s
      where s.id = faculty_attendance_entries.session_id
        and s.teacher_id = public.faculty_current_teacher_id()
    )
  );
-- No direct write policies: entries are written ONLY by the two RPCs.

-- ---- faculty_attendance_audit_log: teachers read their own trail -----------
drop policy if exists faculty_audit_self_read on public.faculty_attendance_audit_log;
create policy faculty_audit_self_read on public.faculty_attendance_audit_log
  for select to authenticated
  using (
    actor_id = public.faculty_current_teacher_id()
    or exists (
      select 1
      from public.faculty_attendance_sessions s
      where s.id = faculty_attendance_audit_log.session_id
        and s.teacher_id = public.faculty_current_teacher_id()
    )
  );
-- No write policies: the trail is append-only from the two RPCs.

-- ---- faculty_sync_runs: no client access (service-role only) --------------
-- (no policies defined = fully blocked for anon/authenticated)

-- =============================================================================
-- 5. Atomic attendance submission (single transaction, server-verified)
-- =============================================================================

create or replace function public.faculty_submit_attendance(
  p_subject_name text,
  p_attendance_date date,
  p_start_time time,
  p_end_time time,
  p_timetable_group text,
  p_lecture_type text,
  p_branch text,
  p_year integer,
  p_section text,
  p_venue text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_session_id uuid;
  v_groups text[];
  v_group text;
  v_expected_count integer;
  v_received_count integer;
  v_distinct_count integer;
  v_present integer;
  v_absent integer;
  v_total integer;
  v_bad_status boolean;
begin
  -- 1) The caller must be an active teacher (re-verified server-side;
  --    browser-supplied identity is never trusted).
  select t.id into v_teacher_id
  from public.faculty_teachers t
  where t.id = auth.uid() and t.is_active = true
  limit 1;
  if v_teacher_id is null then
    raise exception 'NOT_AUTHORIZED: Your account is not an active teacher in this portal.';
  end if;

  -- 2) Basic payload validation.
  if coalesce(p_subject_name, '') = '' then
    raise exception 'INVALID_SUBJECT: A subject name is required.';
  end if;
  if p_attendance_date is null or p_start_time is null or p_end_time is null then
    raise exception 'INVALID_TIMES: Date and times are required.';
  end if;
  if p_end_time <= p_start_time then
    raise exception 'INVALID_TIMES: The end time must be after the start time.';
  end if;
  if p_attendance_date > (current_date + 1) then
    raise exception 'INVALID_DATE: Attendance cannot be submitted for future dates.';
  end if;
  if p_lecture_type is not null and p_lecture_type not in ('L', 'T', 'P') then
    raise exception 'INVALID_LECTURE_TYPE: Must be L, T or P.';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'INVALID_ENTRIES: At least one attendance mark is required.';
  end if;

  -- 3) Every group in the session label must match an active assignment of
  --    THIS teacher for THIS subject.
  v_groups := array(select g from unnest(string_to_array(p_timetable_group, '+')) g where g <> '');
  if v_groups is null or array_length(v_groups, 1) = 0 then
    raise exception 'INVALID_GROUP: A timetable group is required.';
  end if;
  foreach v_group in array v_groups loop
    if not exists (
      select 1 from public.faculty_teaching_assignments a
      where a.teacher_id = v_teacher_id
        and a.is_active = true
        and a.subject_name = p_subject_name
        and a.timetable_group = v_group
    ) then
      raise exception 'NOT_ASSIGNED: You are not assigned to teach % to group %.', p_subject_name, v_group;
    end if;
  end loop;

  -- 4) Duplicate submission prevention (explicit check for a friendly error;
  --    the unique constraint is the hard backstop).
  if exists (
    select 1 from public.faculty_attendance_sessions s
    where s.teacher_id = v_teacher_id
      and s.attendance_date = p_attendance_date
      and s.start_time = p_start_time
      and s.timetable_group = p_timetable_group
  ) then
    raise exception 'DUPLICATE_SESSION: Attendance for this class has already been submitted.';
  end if;

  -- 5) Roster validation: the entries must cover EXACTLY the active students
  --    of the session's groups, each student exactly once, valid status only.
  select count(*) into v_expected_count
  from public.faculty_students st
  where st.is_active = true
    and st.timetable_group = any(v_groups);

  if v_expected_count = 0 then
    raise exception 'NO_ROSTER: No student roster exists for group(s) %. Ask the administrator to import it.', p_timetable_group;
  end if;

  v_received_count := jsonb_array_length(p_entries);
  select count(distinct (e->>'student_id')) into v_distinct_count
  from jsonb_array_elements(p_entries) e;

  if v_distinct_count <> v_received_count then
    raise exception 'DUPLICATE_STUDENTS: The submission contains repeated students.';
  end if;
  if v_received_count <> v_expected_count then
    raise exception 'ROSTER_MISMATCH: Expected % student(s) for group(s) % but received %. Every student must be marked.', v_expected_count, p_timetable_group, v_received_count;
  end if;

  -- every submitted student must belong to the session's groups
  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    where not exists (
      select 1 from public.faculty_students st
      where st.id = (e->>'student_id')::uuid
        and st.is_active = true
        and st.timetable_group = any(v_groups)
    )
  ) then
    raise exception 'ROSTER_MISMATCH: Some submitted students do not belong to group(s) %.', p_timetable_group;
  end if;

  -- every status must be valid
  select bool_or(e->>'status' not in ('present', 'absent')) into v_bad_status
  from jsonb_array_elements(p_entries) e;
  if v_bad_status then
    raise exception 'INVALID_STATUS: Every mark must be either "present" or "absent".';
  end if;

  -- 6) Tallies.
  select
    count(*) filter (where e->>'status' = 'present'),
    count(*) filter (where e->>'status' = 'absent'),
    count(*)
  into v_present, v_absent, v_total
  from jsonb_array_elements(p_entries) e;

  if v_present + v_absent <> v_total then
    raise exception 'INVALID_STATUS: Unrecognized marks found.';
  end if;

  -- 7) Atomic write: session + entries + audit row in ONE transaction.
  insert into public.faculty_attendance_sessions (
    teacher_id, subject_name, attendance_date, start_time, end_time,
    branch, year, section, timetable_group, lecture_type, venue,
    status, total_students, present_count, absent_count, submitted_at
  ) values (
    v_teacher_id, p_subject_name, p_attendance_date, p_start_time, p_end_time,
    p_branch, p_year, p_section, p_timetable_group, p_lecture_type, p_venue,
    'submitted', v_total, v_present, v_absent, now()
  )
  returning id into v_session_id;

  insert into public.faculty_attendance_entries (session_id, student_id, status, marked_by, marked_at)
  select v_session_id, (e->>'student_id')::uuid, e->>'status', v_teacher_id, now()
  from jsonb_array_elements(p_entries) e;

  insert into public.faculty_attendance_audit_log (session_id, actor_id, action, new_status, reason)
  values (
    v_session_id, v_teacher_id, 'submit', 'submitted',
    format('Initial submission for %s (%s): %s present, %s absent of %s.',
           p_subject_name, p_timetable_group, v_present, v_absent, v_total)
  );

  return v_session_id;
end;
$$;

-- =============================================================================
-- 6. Audited corrections (requires a reason; never silently overwrites)
-- =============================================================================

create or replace function public.faculty_correct_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_new_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_old_status text;
  v_old_present integer;
  v_old_absent integer;
begin
  select t.id into v_teacher_id
  from public.faculty_teachers t
  where t.id = auth.uid() and t.is_active = true
  limit 1;
  if v_teacher_id is null then
    raise exception 'NOT_AUTHORIZED: Your account is not an active teacher in this portal.';
  end if;

  if length(regexp_replace(coalesce(p_reason, ''), '\s', '', 'g')) < 10 then
    raise exception 'REASON_REQUIRED: A correction reason of at least 10 characters is required.';
  end if;
  if p_new_status not in ('present', 'absent') then
    raise exception 'INVALID_STATUS: A correction must set "present" or "absent".';
  end if;

  -- the session must belong to the calling teacher
  select s.present_count, s.absent_count into v_old_present, v_old_absent
  from public.faculty_attendance_sessions s
  where s.id = p_session_id
    and s.teacher_id = v_teacher_id;
  if not found then
    raise exception 'NOT_AUTHORIZED: That attendance session was not found for your account.';
  end if;

  select e.status into v_old_status
  from public.faculty_attendance_entries e
  where e.session_id = p_session_id
    and e.student_id = p_student_id;
  if not found then
    raise exception 'ENTRY_NOT_FOUND: That student has no mark in this session.';
  end if;
  if v_old_status = p_new_status then
    raise exception 'NO_CHANGE: The student is already marked %.', p_new_status;
  end if;

  update public.faculty_attendance_entries
  set status = p_new_status, updated_at = now()
  where session_id = p_session_id and student_id = p_student_id;

  update public.faculty_attendance_sessions
  set present_count = case when p_new_status = 'present' then v_old_present + 1 else v_old_present - 1 end,
      absent_count = case when p_new_status = 'absent' then v_old_absent + 1 else v_old_absent - 1 end,
      updated_at = now()
  where id = p_session_id;

  insert into public.faculty_attendance_audit_log (session_id, student_id, actor_id, action, old_status, new_status, reason)
  values (p_session_id, p_student_id, v_teacher_id, 'correct', v_old_status, p_new_status, p_reason);
end;
$$;

-- =============================================================================
-- 7. Password-change flag (called after Supabase Auth updateUser succeeds)
-- =============================================================================

create or replace function public.faculty_mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.faculty_teachers
  set must_change_password = false, updated_at = now()
  where id = auth.uid() and is_active = true;
$$;

-- =============================================================================
-- 8. Grants for PostgREST (authenticated role)
-- =============================================================================

revoke all on function public.faculty_submit_attendance(text, date, time, time, text, text, text, integer, text, text, jsonb) from public, anon;
revoke all on function public.faculty_correct_attendance(uuid, uuid, text, text) from public, anon;
revoke all on function public.faculty_mark_password_changed() from public, anon;
grant execute on function public.faculty_submit_attendance(text, date, time, time, text, text, text, integer, text, text, jsonb) to authenticated;
grant execute on function public.faculty_correct_attendance(uuid, uuid, text, text) to authenticated;
grant execute on function public.faculty_mark_password_changed() to authenticated;
-- faculty_current_teacher_id stays callable by authenticated (policies rely on it)
grant execute on function public.faculty_current_teacher_id() to authenticated;
