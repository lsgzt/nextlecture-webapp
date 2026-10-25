drop policy if exists lms_teachers_directory_read on public.lms_teachers;
create policy lms_teachers_directory_read on public.lms_teachers for select to authenticated using (
  exists (select 1 from public.lms_students s where lower(s.email) = lower(auth.jwt() ->> 'email'))
  or exists (select 1 from public.lms_teachers t where lower(t.email) = lower(auth.jwt() ->> 'email'))
);
