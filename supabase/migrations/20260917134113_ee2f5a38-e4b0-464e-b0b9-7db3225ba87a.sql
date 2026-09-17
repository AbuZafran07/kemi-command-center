-- Conversations & messages (per user)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code text NOT NULL REFERENCES public.agents(code) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY conversations_insert_own ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY conversations_update_own ON public.conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY conversations_delete_own ON public.conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_as_of text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_role_check CHECK (role IN ('user','assistant','system'))
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select_own ON public.messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);

-- Data source registry (metadata only, safe to read)
CREATE TABLE public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  system text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'INTERNAL',
  data_as_of text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_sources TO authenticated;
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_sources_select_authenticated ON public.data_sources
  FOR SELECT TO authenticated USING (true);

-- Demo business data: server-side (agent) access only, no client policies at all
CREATE TABLE public.demo_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  division text NOT NULL,
  position text NOT NULL,
  join_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_employees TO service_role;
ALTER TABLE public.demo_employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demo_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL,
  work_date date NOT NULL,
  status text NOT NULL,
  late_minutes integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_attendance TO service_role;
ALTER TABLE public.demo_attendance ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demo_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  product_name text NOT NULL,
  warehouse text NOT NULL,
  qty_on_hand numeric NOT NULL DEFAULT 0,
  uom text NOT NULL DEFAULT 'PCS',
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_stock TO service_role;
ALTER TABLE public.demo_stock ENABLE ROW LEVEL SECURITY;

-- Seeds
INSERT INTO public.data_sources (code, name, system, classification, data_as_of) VALUES
  ('HRIS_DEMO','Data Karyawan (contoh)','HRIS','INTERNAL','30 Juni 2026'),
  ('ATTENDANCE_DEMO','Data Absensi (contoh)','Mesin Absensi','INTERNAL','30 Juni 2026'),
  ('WMS_DEMO','Data Stok Gudang (contoh)','WMS','INTERNAL','30 Juni 2026');

INSERT INTO public.demo_employees (employee_no, full_name, division, position, join_date, status) VALUES
  ('EMP-001','Andi Prasetyo','HRGA','HR Officer','2021-03-01','active'),
  ('EMP-002','Siti Rahayu','Finance','Accounting Staff','2020-07-15','active'),
  ('EMP-003','Budi Santoso','Warehouse','Warehouse Supervisor','2019-01-20','active'),
  ('EMP-004','Dewi Lestari','Sales','Sales Executive','2022-09-05','active'),
  ('EMP-005','Rizky Maulana','Warehouse','Picker','2023-02-13','active'),
  ('EMP-006','Nur Aisyah','HRGA','GA Staff','2024-05-02','probation');

INSERT INTO public.demo_attendance (employee_no, work_date, status, late_minutes, note) VALUES
  ('EMP-001','2026-06-29','present',0,''),
  ('EMP-001','2026-06-30','late',18,'Macet'),
  ('EMP-003','2026-06-29','present',0,''),
  ('EMP-003','2026-06-30','present',0,''),
  ('EMP-005','2026-06-29','late',35,'Tanpa keterangan'),
  ('EMP-005','2026-06-30','absent',0,'Tanpa keterangan'),
  ('EMP-004','2026-06-30','leave',0,'Cuti tahunan'),
  ('EMP-006','2026-06-30','present',0,'');

INSERT INTO public.demo_stock (sku, product_name, warehouse, qty_on_hand, uom, expiry_date) VALUES
  ('SKU-1001','Cairan Pembersih A 5L','GUDANG JAKARTA',420,'PCS','2027-01-31'),
  ('SKU-1002','Cairan Pembersih B 20L','GUDANG JAKARTA',85,'PCS','2026-10-15'),
  ('SKU-1003','Sabun Industri 1kg','GUDANG SURABAYA',12,'PCS','2026-08-20'),
  ('SKU-1004','Desinfektan 5L','GUDANG JAKARTA',0,'PCS','2026-12-01'),
  ('SKU-1005','Kemasan Botol 1L','GUDANG SURABAYA',9600,'PCS',NULL);