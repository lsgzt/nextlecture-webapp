-- Teacher studio: allow owners to delete their own courses and videos.
-- Deleting a course cascades to its videos (and their progress/reactions rows).

drop policy if exists lms_videos_teacher_delete on public.lms_videos;
create policy lms_videos_teacher_delete on public.lms_videos for delete to authenticated using (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
);

drop policy if exists lms_courses_teacher_delete on public.lms_courses;
create policy lms_courses_teacher_delete on public.lms_courses for delete to authenticated using (
  exists (select 1 from public.lms_teachers t where t.id = teacher_id and lower(t.email) = lower(auth.jwt() ->> 'email'))
);
