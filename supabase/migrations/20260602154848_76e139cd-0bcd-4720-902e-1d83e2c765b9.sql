REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_session_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_session_owner(uuid, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_session_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_session_owner(uuid, uuid) TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.is_session_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_session_owner(uuid, uuid) TO service_role;