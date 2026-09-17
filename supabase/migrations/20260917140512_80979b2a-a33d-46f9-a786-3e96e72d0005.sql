-- Per-user agent grants (least privilege: approving one request grants only that user)
CREATE TABLE IF NOT EXISTS public.agent_user_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code text NOT NULL REFERENCES public.agents(code),
  granted_by uuid REFERENCES auth.users(id),
  access_request_id uuid REFERENCES public.access_requests(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_code)
);

GRANT SELECT ON public.agent_user_grants TO authenticated;
GRANT ALL ON public.agent_user_grants TO service_role;
ALTER TABLE public.agent_user_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_user_grants_select_own ON public.agent_user_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY agent_user_grants_select_oversight ON public.agent_user_grants
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'CEO'::app_role) OR has_role(auth.uid(), 'Director'::app_role));

-- Deny-by-default check now also honours an approved per-user grant
CREATE OR REPLACE FUNCTION public.can_use_agent(_user_id uuid, _agent_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
REVOKE ALL ON FUNCTION public.can_use_agent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_agent(uuid, text) TO authenticated, service_role;

-- Access requests: routing + decision metadata
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS approver_role app_role NOT NULL DEFAULT 'Manager',
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending
  ON public.access_requests (user_id, agent_code)
  WHERE status = 'pending';

-- Segregation of duties: an approver can never see or decide their own request
DROP POLICY IF EXISTS access_requests_select_approver ON public.access_requests;
DROP POLICY IF EXISTS access_requests_update_approver ON public.access_requests;

CREATE POLICY access_requests_select_approver ON public.access_requests
  FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND (has_role(auth.uid(), 'CEO'::app_role) OR has_role(auth.uid(), approver_role))
  );

CREATE POLICY access_requests_update_approver ON public.access_requests
  FOR UPDATE TO authenticated
  USING (
    user_id <> auth.uid()
    AND status = 'pending'
    AND (has_role(auth.uid(), 'CEO'::app_role) OR has_role(auth.uid(), approver_role))
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND (has_role(auth.uid(), 'CEO'::app_role) OR has_role(auth.uid(), approver_role))
  );

DROP POLICY IF EXISTS approvals_insert_approver ON public.approvals;
CREATE POLICY approvals_insert_approver ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.access_requests r
      WHERE r.id = access_request_id
        AND r.user_id <> auth.uid()
        AND (has_role(auth.uid(), 'CEO'::app_role) OR has_role(auth.uid(), r.approver_role))
    )
  );