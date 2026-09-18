-- FASE 6: data layer lintas divisi (demo), snapshot harian, aktivasi agen pendukung ARCA

CREATE TABLE IF NOT EXISTS public.demo_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  order_date date NOT NULL,
  customer text NOT NULL,
  sales_person text NOT NULL DEFAULT '',
  product text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'invoiced',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_sales TO service_role;
ALTER TABLE public.demo_sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.demo_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  customer text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_receivables TO service_role;
ALTER TABLE public.demo_receivables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.demo_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text NOT NULL UNIQUE,
  supplier text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_payables TO service_role;
ALTER TABLE public.demo_payables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.demo_cash_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of_date date NOT NULL,
  account text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_cash_positions TO service_role;
ALTER TABLE public.demo_cash_positions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.demo_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no text NOT NULL UNIQUE,
  supplier text NOT NULL,
  order_date date NOT NULL,
  eta_date date,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'outstanding',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_purchase_orders TO service_role;
ALTER TABLE public.demo_purchase_orders ENABLE ROW LEVEL SECURITY;

INSERT INTO public.data_sources (code, name, system, classification, data_as_of) VALUES
  ('SALES_DEMO','Data Penjualan (contoh)','Sales/ERP','CONFIDENTIAL','30 Juni 2026'),
  ('ARAP_DEMO','Data Piutang & Utang (contoh)','ERP Finance','CONFIDENTIAL','30 Juni 2026'),
  ('CASH_DEMO','Posisi Kas (contoh)','ERP Finance','RESTRICTED','30 Juni 2026'),
  ('PURCHASING_DEMO','Data Pembelian / PO (contoh)','ERP Purchasing','CONFIDENTIAL','30 Juni 2026')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.demo_sales (invoice_no, order_date, customer, sales_person, product, amount, status) VALUES
  ('INV-2606-001','2026-06-03','PT Sinar Bersih','Dewi Lestari','Cairan Pembersih A 5L',48500000,'invoiced'),
  ('INV-2606-002','2026-06-09','PT Hotel Nusantara','Dewi Lestari','Desinfektan 5L',22750000,'invoiced'),
  ('INV-2606-003','2026-06-15','RS Medika Jaya','Dewi Lestari','Sabun Industri 1kg',15300000,'invoiced'),
  ('INV-2606-004','2026-06-22','PT Sinar Bersih','Dewi Lestari','Cairan Pembersih B 20L',61200000,'invoiced'),
  ('INV-2606-005','2026-06-29','PT Laundry Prima','Dewi Lestari','Cairan Pembersih A 5L',18900000,'invoiced'),
  ('INV-2605-011','2026-05-12','PT Hotel Nusantara','Dewi Lestari','Desinfektan 5L',31400000,'paid'),
  ('INV-2605-012','2026-05-26','RS Medika Jaya','Dewi Lestari','Sabun Industri 1kg',27650000,'paid')
ON CONFLICT (invoice_no) DO NOTHING;

INSERT INTO public.demo_receivables (invoice_no, customer, amount, due_date, status) VALUES
  ('INV-2606-001','PT Sinar Bersih',48500000,'2026-07-03','open'),
  ('INV-2606-002','PT Hotel Nusantara',22750000,'2026-06-24','overdue'),
  ('INV-2606-003','RS Medika Jaya',15300000,'2026-07-15','open'),
  ('INV-2606-004','PT Sinar Bersih',61200000,'2026-07-22','open'),
  ('INV-2606-005','PT Laundry Prima',18900000,'2026-06-28','overdue')
ON CONFLICT (invoice_no) DO NOTHING;

INSERT INTO public.demo_payables (bill_no, supplier, amount, due_date, status) VALUES
  ('BILL-2606-001','PT Kimia Utama',34200000,'2026-07-05','open'),
  ('BILL-2606-002','CV Kemas Mandiri',9800000,'2026-06-26','overdue'),
  ('BILL-2606-003','PT Logistik Cepat',5400000,'2026-07-12','open')
ON CONFLICT (bill_no) DO NOTHING;

INSERT INTO public.demo_cash_positions (as_of_date, account, balance) VALUES
  ('2026-06-30','Bank Operasional',187500000),
  ('2026-06-30','Bank Payroll',62300000),
  ('2026-06-30','Kas Kecil',7500000);

INSERT INTO public.demo_purchase_orders (po_no, supplier, order_date, eta_date, amount, status) VALUES
  ('PO-2606-001','PT Kimia Utama','2026-06-10','2026-07-08',34200000,'outstanding'),
  ('PO-2606-002','CV Kemas Mandiri','2026-06-18','2026-07-02',9800000,'outstanding'),
  ('PO-2606-003','PT Logistik Cepat','2026-06-25','2026-07-15',5400000,'outstanding'),
  ('PO-2605-014','PT Kimia Utama','2026-05-20','2026-06-12',28900000,'received')
ON CONFLICT (po_no) DO NOTHING;

UPDATE public.agents SET is_active = true WHERE code IN ('SALLY','PIA','PURI');

INSERT INTO public.agent_permissions (role, division, agent_code, allowed) VALUES
  ('CEO','*','SALLY', true),
  ('CEO','*','PIA', true),
  ('CEO','*','PURI', true),
  ('Director','*','SALLY', true),
  ('Director','*','PIA', true),
  ('Director','*','PURI', true),
  ('Director','*','ALDI', true),
  ('Manager','Sales','SALLY', true),
  ('Manager','Finance','PIA', true),
  ('Manager','Purchasing','PURI', true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  source_code text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, metric_key)
);
GRANT SELECT ON public.daily_snapshots TO authenticated;
GRANT ALL ON public.daily_snapshots TO service_role;
ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_snapshots_select_oversight ON public.daily_snapshots
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.build_daily_snapshot(p_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_rows integer := 0;
BEGIN
  INSERT INTO public.daily_snapshots (snapshot_date, metric_key, metric_value, unit, source_code)
  SELECT p_date, 'sales_amount_last_month', COALESCE(SUM(amount),0), 'IDR', 'SALES_DEMO'
    FROM public.demo_sales
   WHERE order_date >= date_trunc('month', (SELECT MAX(order_date) FROM public.demo_sales))
  UNION ALL
  SELECT p_date, 'sales_orders_last_month', COUNT(*), 'order', 'SALES_DEMO'
    FROM public.demo_sales
   WHERE order_date >= date_trunc('month', (SELECT MAX(order_date) FROM public.demo_sales))
  UNION ALL
  SELECT p_date, 'ar_outstanding', COALESCE(SUM(amount),0), 'IDR', 'ARAP_DEMO'
    FROM public.demo_receivables WHERE status <> 'paid'
  UNION ALL
  SELECT p_date, 'ar_overdue', COALESCE(SUM(amount),0), 'IDR', 'ARAP_DEMO'
    FROM public.demo_receivables WHERE status = 'overdue'
  UNION ALL
  SELECT p_date, 'ap_outstanding', COALESCE(SUM(amount),0), 'IDR', 'ARAP_DEMO'
    FROM public.demo_payables WHERE status <> 'paid'
  UNION ALL
  SELECT p_date, 'cash_balance', COALESCE(SUM(balance),0), 'IDR', 'CASH_DEMO'
    FROM public.demo_cash_positions
   WHERE as_of_date = (SELECT MAX(as_of_date) FROM public.demo_cash_positions)
  UNION ALL
  SELECT p_date, 'stock_qty_total', COALESCE(SUM(qty_on_hand),0), 'PCS', 'WMS_DEMO'
    FROM public.demo_stock
  UNION ALL
  SELECT p_date, 'stock_sku_empty', COUNT(*), 'SKU', 'WMS_DEMO'
    FROM public.demo_stock WHERE qty_on_hand <= 0
  UNION ALL
  SELECT p_date, 'stock_expiry_risk_90d', COUNT(*), 'SKU', 'WMS_DEMO'
    FROM public.demo_stock
   WHERE expiry_date IS NOT NULL AND expiry_date <= p_date + 90
  UNION ALL
  SELECT p_date, 'po_outstanding_amount', COALESCE(SUM(amount),0), 'IDR', 'PURCHASING_DEMO'
    FROM public.demo_purchase_orders WHERE status = 'outstanding'
  UNION ALL
  SELECT p_date, 'po_outstanding_count', COUNT(*), 'PO', 'PURCHASING_DEMO'
    FROM public.demo_purchase_orders WHERE status = 'outstanding'
  UNION ALL
  SELECT p_date, 'headcount_active', COUNT(*), 'orang', 'HRIS_DEMO'
    FROM public.demo_employees WHERE status <> 'resigned'
  UNION ALL
  SELECT p_date, 'attendance_issue_last_day', COUNT(*), 'kejadian', 'ATTENDANCE_DEMO'
    FROM public.demo_attendance
   WHERE work_date = (SELECT MAX(work_date) FROM public.demo_attendance)
     AND status IN ('late','absent')
  ON CONFLICT (snapshot_date, metric_key)
  DO UPDATE SET metric_value = EXCLUDED.metric_value,
                unit = EXCLUDED.unit,
                source_code = EXCLUDED.source_code;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.build_daily_snapshot(date) TO service_role;

SELECT public.build_daily_snapshot(current_date);

DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron tidak tersedia: %', SQLERRM;
    RETURN;
  END;
  BEGIN
    PERFORM cron.unschedule('kemi-daily-snapshot');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM cron.schedule('kemi-daily-snapshot', '5 21 * * *', 'SELECT public.build_daily_snapshot(current_date + 1);');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'gagal menjadwalkan cron: %', SQLERRM;
  END;
END;
$do$;