CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_session_member(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.session_members
    WHERE session_id = _session_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_session_owner(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.sessions
    WHERE id = _session_id
      AND owner_id = _user_id
  );
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_session_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_session_owner(uuid, uuid) TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.is_session_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_session_owner(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS sessions_select_members ON public.sessions;
CREATE POLICY sessions_select_members
ON public.sessions
FOR SELECT
TO authenticated
USING (private.is_session_member(id, auth.uid()));

DROP POLICY IF EXISTS members_select_in_session ON public.session_members;
CREATE POLICY members_select_in_session
ON public.session_members
FOR SELECT
TO authenticated
USING (private.is_session_member(session_id, auth.uid()));

DROP POLICY IF EXISTS members_delete_self_or_owner ON public.session_members;
CREATE POLICY members_delete_self_or_owner
ON public.session_members
FOR DELETE
TO authenticated
USING ((auth.uid() = user_id) OR private.is_session_owner(session_id, auth.uid()));

DROP POLICY IF EXISTS channels_select_members ON public.channels;
CREATE POLICY channels_select_members
ON public.channels
FOR SELECT
TO authenticated
USING (private.is_session_member(session_id, auth.uid()));

DROP POLICY IF EXISTS channels_insert_owner ON public.channels;
CREATE POLICY channels_insert_owner
ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (private.is_session_owner(session_id, auth.uid()));

DROP POLICY IF EXISTS channels_update_owner ON public.channels;
CREATE POLICY channels_update_owner
ON public.channels
FOR UPDATE
TO authenticated
USING (private.is_session_owner(session_id, auth.uid()));

DROP POLICY IF EXISTS channels_delete_owner ON public.channels;
CREATE POLICY channels_delete_owner
ON public.channels
FOR DELETE
TO authenticated
USING (private.is_session_owner(session_id, auth.uid()));

DROP POLICY IF EXISTS messages_select_members ON public.messages;
CREATE POLICY messages_select_members
ON public.messages
FOR SELECT
TO authenticated
USING (private.is_session_member(session_id, auth.uid()));

DROP POLICY IF EXISTS messages_insert_self_member ON public.messages;
CREATE POLICY messages_insert_self_member
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = sender_id) AND private.is_session_member(session_id, auth.uid()));

DROP POLICY IF EXISTS messages_delete_self_or_owner ON public.messages;
CREATE POLICY messages_delete_self_or_owner
ON public.messages
FOR DELETE
TO authenticated
USING ((auth.uid() = sender_id) OR private.is_session_owner(session_id, auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_session_owner(uuid, uuid) FROM PUBLIC;