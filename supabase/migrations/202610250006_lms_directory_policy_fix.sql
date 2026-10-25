-- Avoid recursive evaluation of lms_teachers RLS when checking directory access.
create or replace function public.lms_can_browse_directory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lms_students s
    where lower(s.email) = lower(auth.jwt() ->> 'email')
  )
  or exists (
    select 1 from public.lms_teachers t
    where lower(t.email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.lms_can_browse_directory() from public;
grant execute on function public.lms_can_browse_directory() to authenticated;

drop policy if exists lms_teachers_directory_read on public.lms_teachers;
create policy lms_teachers_directory_read
on public.lms_teachers
for select to authenticated
using (public.lms_can_browse_directory());
