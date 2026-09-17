-- 1. agents
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  division text NOT NULL DEFAULT '',
  avatar_color text NOT NULL DEFAULT '#006837',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY agents_select_authenticated ON public.agents
  FOR SELECT TO authenticated USING (true);

-- 2. data_classifications
CREATE TABLE public.data_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_classifications_code_check
    CHECK (code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'))
);
GRANT SELECT ON public.data_classifications TO authenticated;
GRANT ALL ON public.data_classifications TO service_role;
ALTER TABLE public.data_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_classifications_select_authenticated ON public.data_classifications
  FOR SELECT TO authenticated USING (true);

-- 3. agent_permissions (deny-by-default: no allowed=true row means denied)
CREATE TABLE public.agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  division text NOT NULL DEFAULT '*',
  agent_code text NOT NULL REFERENCES public.agents(code) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, division, agent_code)
);
GRANT SELECT ON public.agent_permissions TO authenticated;
GRANT ALL ON public.agent_permissions TO service_role;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_permissions_select_own_role ON public.agent_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), role));
CREATE POLICY agent_permissions_select_ceo ON public.agent_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'CEO'::public.app_role));

-- 4. audit_log (server-side insert only)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_code text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_scope text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select_own ON public.audit_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY audit_log_select_oversight ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
  );
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_user_id_idx ON public.audit_log (user_id);

-- 5. access_requests
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code text NOT NULL REFERENCES public.agents(code) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check
    CHECK (status IN ('pending','approved','rejected'))
);
GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY access_requests_select_own ON public.access_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY access_requests_select_approver ON public.access_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
  );
CREATE POLICY access_requests_insert_own ON public.access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY access_requests_update_approver ON public.access_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
  );

-- 6. approvals
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_id uuid NOT NULL REFERENCES public.access_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approvals_decision_check CHECK (decision IN ('approved','rejected'))
);
GRANT SELECT, INSERT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approvals_select_requester ON public.approvals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_requests r
    WHERE r.id = access_request_id AND r.user_id = auth.uid()
  ));
CREATE POLICY approvals_select_approver ON public.approvals
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
  );
CREATE POLICY approvals_insert_approver ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'CEO'::public.app_role)
      OR public.has_role(auth.uid(), 'Director'::public.app_role)
      OR public.has_role(auth.uid(), 'Manager'::public.app_role)
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER agents_set_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_permissions_set_updated_at BEFORE UPDATE ON public.agent_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER access_requests_set_updated_at BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permission helper: deny-by-default
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
$$;
GRANT EXECUTE ON FUNCTION public.can_use_agent(uuid, text) TO authenticated, service_role;

-- SEED: classifications
INSERT INTO public.data_classifications (code, description) VALUES
  ('PUBLIC', 'Informasi umum perusahaan, dapat diakses luas secara internal.'),
  ('INTERNAL', 'Ringkasan operasional dan status kerja, akses berbasis peran.'),
  ('CONFIDENTIAL', 'Gaji, harga, margin, harga vendor. Akses terbatas / perlu persetujuan.'),
  ('RESTRICTED', 'Data bank, kompensasi eksekutif, data legal/strategis sensitif.');

-- SEED: 18 agents
INSERT INTO public.agents (code, name, role, division, avatar_color, description, is_active) VALUES
  ('ARCA','Arca','Executive Agent','Executive','#006837','Executive briefing, orkestrasi, sintesis lintas fungsi.', true),
  ('JOKO','Joko','HR Generalist Agent','HRGA','#2563EB','Data karyawan, administrasi HR, pelaporan & kebijakan HR.', true),
  ('JUDI','Judi','Recruitment Agent','HRGA','#2563EB','Manpower request, lowongan, pipeline kandidat, status interview.', false),
  ('KIKI','Kiki','KPI & Performance Agent','HRGA','#2563EB','Status KPI, target, review, SLA dan ringkasan performa.', false),
  ('ALDI','Aldi','Attendance & Discipline Agent','HRGA','#2563EB','Absensi, keterlambatan, pelanggaran, monitoring surat peringatan.', true),
  ('TARA','Tara','Training & Development Agent','HRGA','#2563EB','Rencana & realisasi pelatihan, kebutuhan kompetensi, evaluasi.', false),
  ('FINA','Fina','Finance Agent','Finance','#7C3AED','Ringkasan kas/keuangan, budget, monitoring dan analisis finance.', false),
  ('RAKA','Raka','Accounting & Reporting Agent','Finance','#7C3AED','General ledger, jurnal, laporan keuangan, tutup buku.', false),
  ('PIA','Pia','AR/AP Agent','Finance','#7C3AED','Monitoring piutang & utang, aging, jatuh tempo, status pembayaran.', false),
  ('SALLY','Sally','Sales Agent','Sales','#EA580C','Pencapaian penjualan, tren, analisis pelanggan/order.', false),
  ('CACA','Caca','Customer Intelligence Agent','Sales','#EA580C','Profil pelanggan, segmentasi, riwayat order, indikasi churn.', false),
  ('DONI','Doni','Sales Performance Agent','Sales','#EA580C','Pipeline, target vs realisasi per sales, forecasting sederhana.', false),
  ('WAWAN','Wawan','Warehouse Agent','Warehouse','#0D9488','Stok, inbound/outbound, isu gudang, monitoring operasional.', true),
  ('BIMA','Bima','Inventory Intelligence Agent','Warehouse','#0D9488','Akurasi stok, slow/fast moving, nilai persediaan, level stok.', false),
  ('FELO','Felo','FEFO & Expiry Agent','Warehouse','#0D9488','Monitoring FEFO, kedaluwarsa, risiko stok mendekati expiry.', false),
  ('PURI','Puri','Purchasing Agent','Purchasing','#C026D3','PO, supplier, status pembelian dan outstanding procurement.', false),
  ('VINA','Vina','Vendor & Procurement Agent','Purchasing','#C026D3','Evaluasi vendor, harga vendor sesuai klasifikasi, kepatuhan pengadaan.', false),
  ('TIKO','Tiko','IT/System Agent','IT/System','#475569','Kesehatan aplikasi/sistem, bantuan teknis, status integrasi.', false);

-- SEED: contoh izin (deny-by-default; hanya baris allowed=true yang memberi akses)
INSERT INTO public.agent_permissions (role, division, agent_code, allowed) VALUES
  -- Executive
  ('CEO','*','ARCA', true),
  ('Director','*','ARCA', true),
  ('CEO','*','JOKO', true),
  ('CEO','*','ALDI', true),
  ('CEO','*','WAWAN', true),
  ('Director','*','JOKO', true),
  ('Director','*','WAWAN', true),
  -- HRGA
  ('Manager','HRGA','JOKO', true),
  ('Manager','HRGA','ALDI', true),
  ('Supervisor','HRGA','JOKO', true),
  ('Supervisor','HRGA','ALDI', true),
  ('Staff','HRGA','JOKO', true),
  ('Staff','HRGA','ALDI', true),
  -- Warehouse
  ('Manager','Warehouse','WAWAN', true),
  ('Supervisor','Warehouse','WAWAN', true),
  ('Staff','Warehouse','WAWAN', true),
  -- contoh penolakan eksplisit
  ('Staff','Warehouse','JOKO', false),
  ('Staff','HRGA','WAWAN', false);