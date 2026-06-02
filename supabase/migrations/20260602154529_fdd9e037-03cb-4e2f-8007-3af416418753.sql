GRANT EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) TO service_role;