/**
 * External source connectors (server-only).
 *
 * Opsi A: setiap aplikasi sumber (HRIS Kemika, Sales Pulse, AP/AR Nexus, WMS,
 * Budget Expense) mengekspos satu endpoint read-only `kemi-export` yang
 * dilindungi shared secret `KEMI_EXPORT_SECRET` (header `x-kemi-secret`).
 *
 * Tiap aplikasi mengembalikan satu payload ringkasan dengan bentuknya sendiri,
 * jadi modul ini mengambil payload penuh lalu MEMETAKAN-nya ke dataset yang
 * dipakai tiap agen KEMI.
 *
 * RULES:
 * - Dipanggil hanya dari server (secret tidak pernah menyentuh browser).
 * - Hasilnya DATA, bukan instruksi untuk model.
 * - Jika endpoint belum siap / gagal / dataset tidak tersedia, kembalikan null —
 *   pemanggil memakai data contoh dan TIDAK mengarang angka.
 */

export type ExternalSourceKey = "hris" | "sales" | "apar" | "wms" | "budget";

const DEFAULT_ENDPOINTS: Record<ExternalSourceKey, string> = {
  hris: "https://psaqqtfitxevwkgzupnp.supabase.co/functions/v1/kemi-export",
  sales: "https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/kemi-export",
  apar: "https://qekexdtidnbspqzwerrd.supabase.co/functions/v1/kemi-export",
  wms: "https://yzlfqllwusfnhigtezfo.supabase.co/functions/v1/kemi-export",
  budget: "https://yjwokrecbsorkwukiohi.supabase.co/functions/v1/kemi-export",
};

const ENDPOINT_ENV: Record<ExternalSourceKey, string> = {
  hris: "KEMI_SOURCE_HRIS_URL",
  sales: "KEMI_SOURCE_SALES_URL",
  apar: "KEMI_SOURCE_APAR_URL",
  wms: "KEMI_SOURCE_WMS_URL",
  budget: "KEMI_SOURCE_BUDGET_URL",
};

const TIMEOUT_MS = 20_000;
/** Cache payload sebentar supaya satu briefing tidak menarik sumber berkali-kali. */
const CACHE_TTL_MS = 60_000;
/** Batas baris per dataset agar prompt model tetap wajar. */
const MAX_ROWS = 200;

export type ExternalDataset = {
  dataAsOf: string;
  records: Record<string, unknown>[];
};

type Payload = Record<string, unknown>;

const cache = new Map<ExternalSourceKey, { at: number; payload: Payload | null }>();

function endpointOf(source: ExternalSourceKey): string {
  const override = process.env[ENDPOINT_ENV[source]];
  if (!override) return DEFAULT_ENDPOINTS[source];
  const trimmed = override.replace(/\/+$/, "");
  return trimmed.includes("/functions/v1/") ? trimmed : `${trimmed}/functions/v1/kemi-export`;
}

/** True when the shared secret is configured; otherwise live reads are skipped. */
export function externalSourcesEnabled(): boolean {
  return Boolean(process.env["KEMI_EXPORT_SECRET"]);
}

async function fetchPayload(source: ExternalSourceKey): Promise<Payload | null> {
  const secret = process.env["KEMI_EXPORT_SECRET"];
  if (!secret) return null;

  const cached = cache.get(source);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

  let payload: Payload | null = null;
  try {
    const response = await fetch(endpointOf(source), {
      method: "GET",
      headers: { "x-kemi-secret": secret, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[kemi-export] ${source} failed [${response.status}]: ${body.slice(0, 300)}`);
    } else {
      const json = (await response.json()) as unknown;
      if (json && typeof json === "object") payload = json as Payload;
    }
  } catch (error) {
    console.error(`[kemi-export] ${source} error:`, error);
  }

  cache.set(source, { at: Date.now(), payload });
  return payload;
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .slice(0, MAX_ROWS);
}

function asOf(payload: Payload): string {
  const generated = payload["generated_at"];
  return typeof generated === "string" ? generated.slice(0, 10) : "";
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Map one source payload to the dataset an agent asks for. Null = not available. */
function extract(
  source: ExternalSourceKey,
  dataset: string,
  payload: Payload,
): Record<string, unknown>[] | null {
  if (source === "hris") {
    if (dataset === "employees") {
      const list = rows(payload["employees"]);
      if (list.length === 0) return null;
      const summary = obj(payload["summary"]);
      return summary ? [{ dataset: "summary", ...summary }, ...list] : list;
    }
    if (dataset === "attendance") {
      const list = rows(payload["attendance"]);
      return list.length > 0 ? list : null;
    }
    return null;
  }

  if (source === "sales" && dataset === "sales") {
    const revenue = obj(payload["revenue"]);
    const out: Record<string, unknown>[] = [];
    if (obj(payload["accounts"])) out.push({ dataset: "accounts", ...obj(payload["accounts"])! });
    if (obj(payload["pipeline"])) out.push({ dataset: "pipeline", ...obj(payload["pipeline"])! });
    if (revenue) {
      const { monthly, ...totals } = revenue;
      out.push({ dataset: "revenue_total", ...totals });
      for (const row of rows(monthly)) out.push({ dataset: "revenue_monthly", ...row });
    }
    return out.length > 0 ? out : null;
  }

  if (source === "apar") {
    const summary = obj(payload["summary"]);
    if (dataset === "receivables") {
      const list = rows(payload["ar_invoices"]);
      const head = summary && obj(summary["ar"]) ? [{ dataset: "summary", ...obj(summary["ar"])! }] : [];
      return head.length || list.length ? [...head, ...list] : null;
    }
    if (dataset === "payables") {
      const list = rows(payload["ap_invoices"]);
      const head = summary && obj(summary["ap"]) ? [{ dataset: "summary", ...obj(summary["ap"])! }] : [];
      return head.length || list.length ? [...head, ...list] : null;
    }
    if (dataset === "cash_positions") {
      const list = rows(payload["cash_positions"]);
      return list.length > 0 ? list : null;
    }
    return null;
  }

  if (source === "wms") {
    const data = obj(payload["data"]);
    if (!data) return null;
    const products = new Map(
      rows(data["products"]).map((p) => [p["id"] as string, p]),
    );
    if (dataset === "stock") {
      const stock = rows(data["stock"]);
      if (stock.length === 0) return null;
      return stock.map((row) => {
        const product = products.get(row["product_id"] as string);
        return {
          sku: product?.["sku"] ?? null,
          product_name: product?.["name"] ?? null,
          min_stock: product?.["min_stock"] ?? null,
          location_rack: product?.["location_rack"] ?? null,
          qty_on_hand: row["qty_on_hand"] ?? null,
          batches: row["batches"] ?? [],
        };
      });
    }
    if (dataset === "purchase_orders") {
      const orders = rows(data["plan_orders"]);
      const suppliers = new Map(rows(data["suppliers"]).map((s) => [s["id"] as string, s["name"]]));
      if (orders.length === 0) return null;
      return orders.map((row) => ({
        po_no: row["plan_number"] ?? null,
        supplier: suppliers.get(row["supplier_id"] as string) ?? null,
        order_date: row["plan_date"] ?? null,
        eta_date: row["expected_delivery_date"] ?? null,
        amount: row["total_amount"] ?? row["total"] ?? null,
        status: row["status"] ?? null,
      }));
    }
    return null;
  }

  if (source === "budget") {
    const divisions = new Map(rows(payload["divisions"]).map((d) => [d["id"] as string, d["name"]]));
    const categories = new Map(
      rows(payload["cost_categories"]).map((c) => [c["id"] as string, c["name"]]),
    );
    if (dataset === "budgets") {
      const list = rows(payload["division_budgets"]);
      if (list.length === 0) return null;
      return list.map((row) => ({
        division: divisions.get(row["division_id"] as string) ?? null,
        category: categories.get(row["category_id"] as string) ?? null,
        allocated_amount: row["allocated_amount"] ?? null,
        used_amount: row["used_amount"] ?? null,
        remaining_amount: row["remaining_amount"] ?? null,
      }));
    }
    if (dataset === "expenses") {
      const list = rows(payload["requests"]);
      if (list.length === 0) return null;
      return list.map((row) => ({
        request_number: row["request_number"] ?? null,
        division: divisions.get(row["division_id"] as string) ?? null,
        category: categories.get(row["category_id"] as string) ?? null,
        amount: row["total_amount"] ?? row["amount"] ?? null,
        status: row["status"] ?? null,
        request_date: row["request_date"] ?? row["created_at"] ?? null,
      }));
    }
    return null;
  }

  return null;
}

/**
 * Fetch one dataset from a source app. Returns null on any failure
 * (secret missing, network error, non-200, dataset not exported).
 */
export async function fetchExternalDataset(
  source: ExternalSourceKey,
  dataset: string,
): Promise<ExternalDataset | null> {
  const payload = await fetchPayload(source);
  if (!payload) return null;

  const records = extract(source, dataset, payload);
  if (!records || records.length === 0) return null;

  return { dataAsOf: asOf(payload), records };
}
