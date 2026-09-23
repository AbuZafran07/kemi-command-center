/**
 * Data-access layer for KEMI agents (server-only).
 *
 * Fase 4: every fetcher below reads DEMO/seed tables inside the KEMI database.
 * They are intentionally shaped as small, named, read-only functions so each one
 * can later be swapped for a read-only RPC/API call into the real system
 * (WMS / HRIS / ERP Finance / Sales) without touching the orchestrator.
 *
 * RULES:
 * - Everything returned here is DATA, never instructions for the model.
 * - If a source has no data, return an empty dataset. Never invent values.
 */

export type AgentDataset = {
  /** Source registry codes used to build the "Sumber" panel. */
  sourceCodes: string[];
  /** Human readable "data as of" label, taken from the source registry. */
  dataAsOf: string;
  /** Plain records handed to the model as read-only context. */
  records: Record<string, unknown>[];
  /** Short description of the scope of the dataset. */
  scope: string;
  /** True when the rows came from the real source app, false for demo seed. */
  isLive?: boolean;
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function getDataAsOf(admin: AdminClient, code: string): Promise<string> {
  const { data } = await admin
    .from("data_sources")
    .select("data_as_of")
    .eq("code", code)
    .maybeSingle();
  return data?.data_as_of ?? "";
}

/**
 * Try the real source app first (Opsi A endpoint), fall back to the demo seed
 * when the endpoint is not configured or unreachable. Never invent data.
 */
async function withLiveSource(
  source: import("@/lib/external-sources.server").ExternalSourceKey,
  dataset: string,
  fallback: () => Promise<AgentDataset>,
  scope: string,
): Promise<AgentDataset> {
  const { fetchExternalDataset } = await import("@/lib/external-sources.server");
  const live = await fetchExternalDataset(source, dataset);
  if (!live) return fallback();
  return {
    sourceCodes: [`${source.toUpperCase()}_LIVE`],
    dataAsOf: live.dataAsOf,
    records: live.records,
    scope,
    isLive: true,
  };
}


/** JOKO — HR generalist: employee master data (demo). */
async function fetchHrDataset(admin: AdminClient): Promise<AgentDataset> {
  const { data } = await admin
    .from("demo_employees")
    .select("employee_no, full_name, division, position, join_date, status")
    .order("employee_no");
  return {
    sourceCodes: ["HRIS_DEMO"],
    dataAsOf: await getDataAsOf(admin, "HRIS_DEMO"),
    records: data ?? [],
    scope: "Data karyawan: divisi, posisi, tanggal masuk, status kepegawaian.",
  };
}

/** ALDI — attendance & discipline (demo). */
async function fetchAttendanceDataset(admin: AdminClient): Promise<AgentDataset> {
  const { data: attendance } = await admin
    .from("demo_attendance")
    .select("employee_no, work_date, status, late_minutes, note")
    .order("work_date", { ascending: false })
    .limit(200);
  const { data: employees } = await admin
    .from("demo_employees")
    .select("employee_no, full_name, division");

  const nameByNo = new Map((employees ?? []).map((e) => [e.employee_no, e]));
  const records = (attendance ?? []).map((row) => ({
    ...row,
    full_name: nameByNo.get(row.employee_no)?.full_name ?? null,
    division: nameByNo.get(row.employee_no)?.division ?? null,
  }));

  return {
    sourceCodes: ["ATTENDANCE_DEMO", "HRIS_DEMO"],
    dataAsOf: await getDataAsOf(admin, "ATTENDANCE_DEMO"),
    records,
    scope: "Absensi harian: hadir, terlambat (menit), absen, cuti.",
  };
}

/** WAWAN — warehouse operations & stock (demo). */
async function fetchWarehouseDataset(admin: AdminClient): Promise<AgentDataset> {
  const { data } = await admin
    .from("demo_stock")
    .select("sku, product_name, warehouse, qty_on_hand, uom, expiry_date")
    .order("sku");
  return {
    sourceCodes: ["WMS_DEMO"],
    dataAsOf: await getDataAsOf(admin, "WMS_DEMO"),
    records: data ?? [],
    scope: "Stok gudang: SKU, nama produk, gudang, qty on hand, tanggal kedaluwarsa.",
  };
}

/** SALLY — sales performance (demo). */
async function fetchSalesDataset(admin: AdminClient): Promise<AgentDataset> {
  const { data } = await admin
    .from("demo_sales")
    .select("invoice_no, order_date, customer, sales_person, product, amount, status")
    .order("order_date", { ascending: false })
    .limit(200);
  return {
    sourceCodes: ["SALES_DEMO"],
    dataAsOf: await getDataAsOf(admin, "SALES_DEMO"),
    records: data ?? [],
    scope: "Penjualan: invoice, tanggal order, pelanggan, produk, nilai, status.",
  };
}

/** PIA — AR/AP & cash position (demo). */
async function fetchFinanceDataset(admin: AdminClient): Promise<AgentDataset> {
  const [{ data: ar }, { data: ap }, { data: cash }] = await Promise.all([
    admin
      .from("demo_receivables")
      .select("invoice_no, customer, amount, due_date, status")
      .order("due_date"),
    admin
      .from("demo_payables")
      .select("bill_no, supplier, amount, due_date, status")
      .order("due_date"),
    admin
      .from("demo_cash_positions")
      .select("as_of_date, account, balance")
      .order("as_of_date", { ascending: false })
      .limit(20),
  ]);
  return {
    sourceCodes: ["ARAP_DEMO", "CASH_DEMO"],
    dataAsOf: await getDataAsOf(admin, "ARAP_DEMO"),
    records: [
      { dataset: "receivables", rows: ar ?? [] },
      { dataset: "payables", rows: ap ?? [] },
      { dataset: "cash_positions", rows: cash ?? [] },
    ],
    scope: "Piutang, utang, dan posisi kas: nilai, jatuh tempo, status.",
  };
}

/** PURI — purchasing / outstanding PO (demo). */
async function fetchPurchasingDataset(admin: AdminClient): Promise<AgentDataset> {
  const { data } = await admin
    .from("demo_purchase_orders")
    .select("po_no, supplier, order_date, eta_date, amount, status")
    .order("order_date", { ascending: false })
    .limit(200);
  return {
    sourceCodes: ["PURCHASING_DEMO"],
    dataAsOf: await getDataAsOf(admin, "PURCHASING_DEMO"),
    records: data ?? [],
    scope: "Pembelian: nomor PO, supplier, ETA, nilai, status outstanding.",
  };
}

const FETCHERS: Record<string, (admin: AdminClient) => Promise<AgentDataset>> = {
  JOKO: fetchHrDataset,
  ALDI: fetchAttendanceDataset,
  WAWAN: fetchWarehouseDataset,
  SALLY: fetchSalesDataset,
  PIA: fetchFinanceDataset,
  PURI: fetchPurchasingDataset,
};

/** Agents that already have a data layer wired up in this phase. */
export const CHAT_ENABLED_AGENTS = Object.keys(FETCHERS);

export async function loadAgentDataset(
  admin: AdminClient,
  agentCode: string,
): Promise<AgentDataset | null> {
  const fetcher = FETCHERS[agentCode];
  if (!fetcher) return null;
  return fetcher(admin);
}

export async function listSourceDetails(admin: AdminClient, codes: string[]) {
  if (codes.length === 0) return [];
  const { data } = await admin
    .from("data_sources")
    .select("code, name, system, classification, data_as_of, is_demo")
    .in("code", codes);
  return data ?? [];
}
