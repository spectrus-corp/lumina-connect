-- Calls table for tracking video/audio calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX calls_session_idx ON public.calls(session_id);
CREATE INDEX calls_initiator_idx ON public.calls(initiator_id);

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select_session_member" ON public.calls FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.session_members
      WHERE session_id = calls.session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "calls_insert_own" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (
    initiator_id = auth.uid() AND
    EXISTS(
      SELECT 1 FROM public.session_members
      WHERE session_id = calls.session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "calls_update_own" ON public.calls FOR UPDATE TO authenticated
  USING (initiator_id = auth.uid())
  WITH CHECK (initiator_id = auth.uid());

-- Call participants (who joined the call)
CREATE TABLE public.call_participants (
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (call_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.call_participants TO authenticated;
GRANT ALL ON public.call_participants TO service_role;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_participants_select_session_member" ON public.call_participants FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.session_members sm
      JOIN public.calls c ON c.session_id = sm.session_id
      WHERE c.id = call_participants.call_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "call_participants_insert" ON public.call_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS(
      SELECT 1 FROM public.session_members sm
      JOIN public.calls c ON c.session_id = sm.session_id
      WHERE c.id = call_participants.call_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "call_participants_update" ON public.call_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Deleted messages (for recovery/audit)
CREATE TABLE public.deleted_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  channel_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  original_content TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deleted_messages_session_idx ON public.deleted_messages(session_id);
CREATE INDEX deleted_messages_channel_idx ON public.deleted_messages(channel_id);

GRANT SELECT, INSERT ON public.deleted_messages TO authenticated;
GRANT ALL ON public.deleted_messages TO service_role;
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deleted_messages_select_session_member" ON public.deleted_messages FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.session_members
      WHERE session_id = deleted_messages.session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "deleted_messages_insert_own" ON public.deleted_messages FOR INSERT TO authenticated
  WITH CHECK (
    deleted_by_id = auth.uid() AND
    EXISTS(
      SELECT 1 FROM public.session_members
      WHERE session_id = deleted_messages.session_id AND user_id = auth.uid()
    )
  );
