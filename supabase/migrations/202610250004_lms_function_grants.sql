revoke all on function public.lms_reaction_counts(uuid) from public;
grant execute on function public.lms_reaction_counts(uuid) to authenticated;

revoke all on function public.lms_login_lookup(text) from public;
grant execute on function public.lms_login_lookup(text) to anon;
