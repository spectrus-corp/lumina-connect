
GRANT EXECUTE ON FUNCTION public.is_session_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
