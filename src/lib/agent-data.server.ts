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

const FETCHERS: Record<string, (admin: AdminClient) => Promise<AgentDataset>> = {
  JOKO: fetchHrDataset,
  ALDI: fetchAttendanceDataset,
  WAWAN: fetchWarehouseDataset,
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
