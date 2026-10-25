create or replace function public.lms_login_lookup(login_email text)
returns table (role text, display_name text)
language sql
security definer
set search_path = public
as $$
  select 'student'::text, s.name
  from public.lms_students s
  where lower(s.email) = lower(trim(login_email))
  union all
  select 'teacher'::text, t.name
  from public.lms_teachers t
  where lower(t.email) = lower(trim(login_email));
$$;

grant execute on function public.lms_login_lookup(text) to anon, authenticated;
