
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  birthdate DATE,
  restricted_mode BOOLEAN NOT NULL DEFAULT false,
  consent_version TEXT,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Trigger to auto-create profile + compute restricted_mode from birthdate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_birthdate DATE;
  v_age INT;
  v_restricted BOOLEAN := false;
BEGIN
  v_birthdate := NULLIF(NEW.raw_user_meta_data->>'birthdate', '')::DATE;
  IF v_birthdate IS NOT NULL THEN
    v_age := DATE_PART('year', AGE(v_birthdate));
    IF v_age >= 13 AND v_age <= 15 THEN
      v_restricted := true;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, birthdate, restricted_mode, consent_version, consent_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_birthdate,
    v_restricted,
    'v1',
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'persistent' CHECK (type IN ('persistent','temporary')),
  ttl_expires_at TIMESTAMPTZ,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_code_idx ON public.sessions(code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Session members
CREATE TABLE public.session_members (
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_members TO authenticated;
GRANT ALL ON public.session_members TO service_role;
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;

-- Helper to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_session_member(_session_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.session_members
    WHERE session_id = _session_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_session_owner(_session_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.sessions WHERE id = _session_id AND owner_id = _user_id
  );
$$;

-- Sessions policies
CREATE POLICY "sessions_select_members" ON public.sessions FOR SELECT TO authenticated
  USING (public.is_session_member(id, auth.uid()));
CREATE POLICY "sessions_insert_self_owner" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "sessions_update_owner" ON public.sessions FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "sessions_delete_owner" ON public.sessions FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Session members policies
CREATE POLICY "members_select_in_session" ON public.session_members FOR SELECT TO authenticated
  USING (public.is_session_member(session_id, auth.uid()));
CREATE POLICY "members_insert_self" ON public.session_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_delete_self_or_owner" ON public.session_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_session_owner(session_id, auth.uid()));

-- Channels
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX channels_session_idx ON public.channels(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select_members" ON public.channels FOR SELECT TO authenticated
  USING (public.is_session_member(session_id, auth.uid()));
CREATE POLICY "channels_insert_owner" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (public.is_session_owner(session_id, auth.uid()));
CREATE POLICY "channels_update_owner" ON public.channels FOR UPDATE TO authenticated
  USING (public.is_session_owner(session_id, auth.uid()));
CREATE POLICY "channels_delete_owner" ON public.channels FOR DELETE TO authenticated
  USING (public.is_session_owner(session_id, auth.uid()));

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_channel_created_idx ON public.messages(channel_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_members" ON public.messages FOR SELECT TO authenticated
  USING (public.is_session_member(session_id, auth.uid()));
CREATE POLICY "messages_insert_self_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_session_member(session_id, auth.uid()));
CREATE POLICY "messages_delete_self_or_owner" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR public.is_session_owner(session_id, auth.uid()));

-- Consents
CREATE TABLE public.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX consents_user_idx ON public.consents(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_own_all" ON public.consents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_user_idx ON public.audit_log(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_own" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_insert_own" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own_all" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime for messages and members
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_members;
