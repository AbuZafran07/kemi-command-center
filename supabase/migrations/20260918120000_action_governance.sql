-- Approval & Action Governance for sensitive write actions (built ahead of the real
-- data integration phase; scheduled for "Nanti" in the KEMI roadmap, not a numbered Fase).
-- Flow: AI/human prepares a DRAFT -> permission check -> a human approver decides
-- -> execution runs through a controlled path -> everything is written to audit_log.
-- No AI/agent code path may execute a sensitive action directly (segregation of duties:
-- the requester can never be the approver, and can never execute their own draft).

-- 1. Explicit registry of actions that require approval. Rows here are curated by
--    admins/migrations only -- an agent can never invent a new sensitive action code.
CREATE TABLE public.sensitive_actions (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  approver_role public.app_role NOT NULL DEFAULT 'Manager',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sensitive_actions TO authenticated;
GRANT ALL ON public.sensitive_actions TO service_role;
ALTER TABLE public.sensitive_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensitive_actions_select_authenticated ON public.sensitive_actions
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER sensitive_actions_set_updated_at BEFORE UPDATE ON public.sensitive_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sensitive_actions (code, name, description, approver_role) VALUES
  ('DISCIPLINARY_LETTER_DRAFT', 'Draf Surat Disiplin',
   'Menerbitkan surat peringatan (SP1/SP2/SP3) untuk seorang karyawan.', 'Manager'),
  ('MASTER_DATA_CHANGE', 'Perubahan Master Data Karyawan',
   'Mengubah data master karyawan (divisi, posisi, atau status).', 'Director'),
  ('PO_APPROVAL', 'Persetujuan Purchase Order',
   'Menyetujui purchase order yang masih berstatus outstanding.', 'Manager');

-- 2. Drafts: pending_approval -> approved/rejected -> executed/execution_failed.
CREATE TABLE public.action_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code text NOT NULL REFERENCES public.sensitive_actions(code),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code text REFERENCES public.agents(code),
  title text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_approval',
  approver_role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  executed_at timestamptz,
  executed_by uuid REFERENCES auth.users(id),
  execution_result jsonb,
  CONSTRAINT action_drafts_status_check
    CHECK (status IN ('pending_approval','approved','rejected','executed','execution_failed','cancelled'))
);
GRANT SELECT, INSERT, UPDATE ON public.action_drafts TO authenticated;
GRANT ALL ON public.action_drafts TO service_role;
ALTER TABLE public.action_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX action_drafts_status_idx ON public.action_drafts (status);
CREATE INDEX action_drafts_requested_by_idx ON public.action_drafts (requested_by);
CREATE TRIGGER action_drafts_set_updated_at BEFORE UPDATE ON public.action_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY action_drafts_select_own ON public.action_drafts
  FOR SELECT TO authenticated USING (requested_by = auth.uid());

-- Segregation of duties: an approver can never see/decide their own draft.
CREATE POLICY action_drafts_select_approver ON public.action_drafts
  FOR SELECT TO authenticated
  USING (
    requested_by <> auth.uid()
    AND (public.has_role(auth.uid(), 'CEO'::public.app_role) OR public.has_role(auth.uid(), approver_role))
  );

CREATE POLICY action_drafts_insert_own ON public.action_drafts
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'pending_approval');

-- Approvers may only flip a pending draft to approved/rejected here. The
-- approved -> executed transition is never exposed to the client policy; it is
-- only performed by the server-side execution path (service role), which
-- independently re-checks status, role and segregation of duties in code.
CREATE POLICY action_drafts_update_approver ON public.action_drafts
  FOR UPDATE TO authenticated
  USING (
    requested_by <> auth.uid()
    AND status = 'pending_approval'
    AND (public.has_role(auth.uid(), 'CEO'::public.app_role) OR public.has_role(auth.uid(), approver_role))
  )
  WITH CHECK (
    requested_by <> auth.uid()
    AND status IN ('approved','rejected')
    AND (public.has_role(auth.uid(), 'CEO'::public.app_role) OR public.has_role(auth.uid(), approver_role))
  );

-- 3. Approval decisions: append-only trail, distinct from the Fase 6 access approvals.
CREATE TABLE public.action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_draft_id uuid NOT NULL REFERENCES public.action_drafts(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_approvals_decision_check CHECK (decision IN ('approved','rejected'))
);
GRANT SELECT, INSERT ON public.action_approvals TO authenticated;
GRANT ALL ON public.action_approvals TO service_role;
ALTER TABLE public.action_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_approvals_select_requester ON public.action_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.action_drafts d
    WHERE d.id = action_draft_id AND d.requested_by = auth.uid()
  ));

CREATE POLICY action_approvals_select_approver ON public.action_approvals
  FOR SELECT TO authenticated
  USING (approver_id = auth.uid() OR public.has_role(auth.uid(), 'CEO'::public.app_role));

CREATE POLICY action_approvals_insert_approver ON public.action_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.action_drafts d
      WHERE d.id = action_draft_id
        AND d.requested_by <> auth.uid()
        AND (public.has_role(auth.uid(), 'CEO'::public.app_role) OR public.has_role(auth.uid(), d.approver_role))
    )
  );

-- 4. Execution target for the disciplinary-letter demo action. Deny-by-default:
--    service_role only, no client policies at all (same pattern as demo_employees /
--    demo_stock) -- a real integration replaces this table later.
CREATE TABLE public.disciplinary_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_draft_id uuid NOT NULL REFERENCES public.action_drafts(id) ON DELETE CASCADE,
  employee_no text NOT NULL,
  letter_type text NOT NULL,
  reason text NOT NULL DEFAULT '',
  issued_by uuid NOT NULL REFERENCES auth.users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_letters_type_check CHECK (letter_type IN ('SP1','SP2','SP3'))
);
GRANT ALL ON public.disciplinary_letters TO service_role;
ALTER TABLE public.disciplinary_letters ENABLE ROW LEVEL SECURITY;
