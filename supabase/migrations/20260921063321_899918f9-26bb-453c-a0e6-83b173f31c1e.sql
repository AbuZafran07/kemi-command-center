CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION private.can_use_agent(_user_id uuid, _agent_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_permissions p
    JOIN public.user_roles ur ON ur.role = p.role AND ur.user_id = _user_id
    JOIN public.agents a ON a.code = p.agent_code
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE p.agent_code = _agent_code
      AND p.allowed = true
      AND a.is_active = true
      AND (p.division = '*' OR p.division = COALESCE(pr.division, ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.agent_user_grants g
    JOIN public.agents a2 ON a2.code = g.agent_code
    WHERE g.user_id = _user_id
      AND g.agent_code = _agent_code
      AND g.revoked_at IS NULL
      AND a2.is_active = true
  )
$function$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_use_agent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_use_agent(uuid, text) TO authenticated, service_role;

-- Repoint policies to the private helper
DROP POLICY profiles_select_ceo ON public.profiles;
CREATE POLICY profiles_select_ceo ON public.profiles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role));

DROP POLICY user_roles_select_ceo ON public.user_roles;
CREATE POLICY user_roles_select_ceo ON public.user_roles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role));

DROP POLICY agent_permissions_select_own_role ON public.agent_permissions;
CREATE POLICY agent_permissions_select_own_role ON public.agent_permissions FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), role));

DROP POLICY agent_permissions_select_ceo ON public.agent_permissions;
CREATE POLICY agent_permissions_select_ceo ON public.agent_permissions FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role));

DROP POLICY audit_log_select_oversight ON public.audit_log;
CREATE POLICY audit_log_select_oversight ON public.audit_log FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), 'Director'::public.app_role));

DROP POLICY agent_user_grants_select_oversight ON public.agent_user_grants;
CREATE POLICY agent_user_grants_select_oversight ON public.agent_user_grants FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), 'Director'::public.app_role));

DROP POLICY approvals_select_approver ON public.approvals;
CREATE POLICY approvals_select_approver ON public.approvals FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), 'Director'::public.app_role) OR private.has_role(auth.uid(), 'Manager'::public.app_role));

DROP POLICY access_requests_select_approver ON public.access_requests;
CREATE POLICY access_requests_select_approver ON public.access_requests FOR SELECT TO authenticated
USING (user_id <> auth.uid() AND (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), approver_role)));

DROP POLICY access_requests_update_approver ON public.access_requests;
CREATE POLICY access_requests_update_approver ON public.access_requests FOR UPDATE TO authenticated
USING (user_id <> auth.uid() AND status = 'pending' AND (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), approver_role)))
WITH CHECK (user_id <> auth.uid() AND (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), approver_role)));

DROP POLICY approvals_insert_approver ON public.approvals;
CREATE POLICY approvals_insert_approver ON public.approvals FOR INSERT TO authenticated
WITH CHECK (approver_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.access_requests r
  WHERE r.id = approvals.access_request_id
    AND r.user_id <> auth.uid()
    AND (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), r.approver_role))
));

DROP POLICY daily_snapshots_select_oversight ON public.daily_snapshots;
CREATE POLICY daily_snapshots_select_oversight ON public.daily_snapshots FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'CEO'::public.app_role) OR private.has_role(auth.uid(), 'Director'::public.app_role) OR private.has_role(auth.uid(), 'Manager'::public.app_role));

-- Replace the exposed SECURITY DEFINER helpers with SECURITY INVOKER wrappers
DROP FUNCTION public.has_role(uuid, public.app_role);
DROP FUNCTION public.can_use_agent(uuid, text);

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT private.has_role(_user_id, _role)
$function$;

CREATE FUNCTION public.can_use_agent(_user_id uuid, _agent_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT private.can_use_agent(_user_id, _agent_code)
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_use_agent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_use_agent(uuid, text) TO authenticated, service_role;