-- Fase 9 (part B): super_admin governance. Deny-by-default: only super_admin can
-- read every profile, edit any profile, or change user_roles. super_admin is an
-- ADDITIONAL row in user_roles (users keep their organisational role too).

-- 1. Bootstrap email list (single source of truth for both the migration and the trigger).
CREATE OR REPLACE FUNCTION public.is_bootstrap_super_admin_email(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(_email, '')) = ANY (ARRAY['ferry@kemika.co.id'])
$$;

-- 2. RLS ---------------------------------------------------------------------
CREATE POLICY profiles_select_super_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY profiles_update_super_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Writes were never granted to authenticated before; RLS below still denies everyone
-- except super_admin.
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY user_roles_select_super_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY user_roles_insert_super_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY user_roles_update_super_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY user_roles_delete_super_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3. Safeguards on user_roles --------------------------------------------------
-- Never allow the last super_admin to disappear, and never let a super_admin
-- revoke their own super_admin (auth.uid() is NULL for service-role/cascades).
CREATE OR REPLACE FUNCTION public.guard_super_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  IF OLD.role = 'super_admin'::public.app_role
     AND (
       TG_OP = 'DELETE'
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
     )
  THEN
    IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'SUPER_ADMIN_SELF_REVOKE';
    END IF;

    -- Serialise concurrent revocations so two admins cannot both remove "the other one".
    PERFORM 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role FOR UPDATE;

    SELECT count(*) INTO remaining
    FROM public.user_roles
    WHERE role = 'super_admin'::public.app_role AND id <> OLD.id;

    IF remaining < 1 THEN
      RAISE EXCEPTION 'LAST_SUPER_ADMIN';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_guard_super_admin
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_super_admin_roles();

-- Every role change is written to audit_log (actor = auth.uid(), NULL for system/bootstrap).
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, agent_code, action, detail, data_scope)
    VALUES (
      auth.uid(), NULL, 'user_role_granted',
      jsonb_build_object('target_user_id', NEW.user_id, 'before', NULL::text, 'after', NEW.role::text),
      'admin'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, agent_code, action, detail, data_scope)
    VALUES (
      auth.uid(), NULL, 'user_role_changed',
      jsonb_build_object('target_user_id', NEW.user_id, 'before', OLD.role::text, 'after', NEW.role::text),
      'admin'
    );
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_log (user_id, agent_code, action, detail, data_scope)
    VALUES (
      auth.uid(), NULL, 'user_role_revoked',
      jsonb_build_object('target_user_id', OLD.user_id, 'before', OLD.role::text, 'after', NULL::text),
      'admin'
    );
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER user_roles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

-- 4. Safeguards on profiles ----------------------------------------------------
-- division drives agent access (can_use_agent), so only super_admin may change it.
-- Before this, any user could PATCH their own division through the API.
CREATE OR REPLACE FUNCTION public.guard_profile_division()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.division IS DISTINCT FROM OLD.division
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'DIVISION_ADMIN_ONLY';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_division
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_division();

-- Audit edits made on someone else's profile, and any division change.
-- (A user editing their own name/photo is audited by the updateMyProfile server function.)
CREATE OR REPLACE FUNCTION public.audit_profile_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (auth.uid() <> NEW.id OR NEW.division IS DISTINCT FROM OLD.division)
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.division IS DISTINCT FROM OLD.division
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     )
  THEN
    INSERT INTO public.audit_log (user_id, agent_code, action, detail, data_scope)
    VALUES (
      auth.uid(), NULL, 'admin_profile_updated',
      jsonb_build_object(
        'target_user_id', NEW.id,
        'before', jsonb_build_object('full_name', OLD.full_name, 'division', OLD.division, 'avatar_url', OLD.avatar_url),
        'after', jsonb_build_object('full_name', NEW.full_name, 'division', NEW.division, 'avatar_url', NEW.avatar_url)
      ),
      'admin'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_audit_admin_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_admin_change();

-- 5. New-user hardening + bootstrap --------------------------------------------
-- handle_new_user reads the role from signup metadata; never let that grant super_admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, division, language_pref, theme_pref)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'division', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'language_pref', 'id'),
    COALESCE(NEW.raw_user_meta_data ->> 'theme_pref', 'light')
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'Staff')::public.app_role;
  EXCEPTION WHEN others THEN
    _role := 'Staff';
  END;

  IF _role = 'super_admin'::public.app_role THEN
    _role := 'Staff';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Grant super_admin to the bootstrap account, but only once its email is confirmed
-- (so nobody can claim the address by signing up with it unconfirmed).
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND public.is_bootstrap_super_admin_email(NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_bootstrap_super_admin
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_super_admin();

-- Existing account (created earlier): grant now. Triggers above are already in place,
-- so this grant is audit-logged (actor NULL = system bootstrap).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE public.is_bootstrap_super_admin_email(email) AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
