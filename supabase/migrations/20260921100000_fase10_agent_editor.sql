-- Fase 10: agent editor (name/description/colour/photo/active) for super_admin only.

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar_url text;

-- avatar_color is rendered into a style attribute: keep it a plain #RRGGBB value.
-- NOT VALID: enforced for every new/updated row without re-scanning existing ones.
ALTER TABLE public.agents
  ADD CONSTRAINT agents_avatar_color_hex CHECK (avatar_color ~ '^#[0-9A-Fa-f]{6}$') NOT VALID;

-- RLS: agents were read-only for everyone; only super_admin may update now.
GRANT UPDATE ON public.agents TO authenticated;

CREATE POLICY agents_update_super_admin ON public.agents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- `code` is the identifier used by permissions, grants, conversations and audit: immutable.
CREATE OR REPLACE FUNCTION public.guard_agent_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'AGENT_CODE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_guard_code
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_agent_code();

-- Audit every change to the editable fields (actor = auth.uid(); NULL = system).
CREATE OR REPLACE FUNCTION public.audit_agent_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.avatar_color IS DISTINCT FROM OLD.avatar_color
     OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
  THEN
    INSERT INTO public.audit_log (user_id, agent_code, action, detail, data_scope)
    VALUES (
      auth.uid(), NEW.code, 'admin_agent_updated',
      jsonb_build_object(
        'before', jsonb_build_object(
          'name', OLD.name, 'description', OLD.description, 'avatar_color', OLD.avatar_color,
          'avatar_url', OLD.avatar_url, 'is_active', OLD.is_active),
        'after', jsonb_build_object(
          'name', NEW.name, 'description', NEW.description, 'avatar_color', NEW.avatar_color,
          'avatar_url', NEW.avatar_url, 'is_active', NEW.is_active)
      ),
      'admin'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_audit_change
  AFTER UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.audit_agent_change();

-- Storage: public-read bucket, but only super_admin may write. Storage itself also
-- rejects anything outside these types / 2MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agent-avatars', 'agent-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "agent_avatars_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'agent-avatars');

CREATE POLICY "agent_avatars_insert_super_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-avatars'
    AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "agent_avatars_update_super_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'agent-avatars' AND public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (bucket_id = 'agent-avatars' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "agent_avatars_delete_super_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'agent-avatars' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
