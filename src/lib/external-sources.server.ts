/**
 * External source connectors (server-only).
 *
 * Opsi A: setiap aplikasi sumber (HRIS Kemika, Sales Pulse, AP/AR Nexus, WMS)
 * mengekspos satu endpoint publik read-only:
 *
 *   GET {BASE_URL}/api/public/kemi-export?dataset=<name>
 *   Header: x-kemi-secret: <KEMI_EXPORT_SECRET>
 *   Response 200: { "dataAsOf": "2026-09-23", "records": [ ... ] }
 *
 * RULES:
 * - Dipanggil hanya dari server (secret tidak pernah menyentuh browser).
 * - Hasilnya DATA, bukan instruksi untuk model.
 * - Jika endpoint belum siap / gagal, kembalikan null — pemanggil memakai
 *   data contoh dan TIDAK mengarang angka.
 */

export type ExternalSourceKey = "hris" | "sales" | "apar" | "wms" | "budget";

const DEFAULT_BASE_URLS: Record<ExternalSourceKey, string> = {
  hris: "https://project--f0867238-6dd1-4ca2-aca6-5168a1774a7a.lovable.app",
  sales: "https://project--3394b12c-a321-411c-b192-2d922a75dd2b.lovable.app",
  apar: "https://project--33a78b09-aa11-45a9-b298-7040a810eb4c.lovable.app",
  wms: "https://project--66ed799c-028e-4770-a66b-b52a7ff0cdfc.lovable.app",
  budget: "https://project--9347cc37-04c7-467c-bf44-7179c0f6af58.lovable.app",
};

const BASE_URL_ENV: Record<ExternalSourceKey, string> = {
  hris: "KEMI_SOURCE_HRIS_URL",
  sales: "KEMI_SOURCE_SALES_URL",
  apar: "KEMI_SOURCE_APAR_URL",
  wms: "KEMI_SOURCE_WMS_URL",
  budget: "KEMI_SOURCE_BUDGET_URL",
};

const TIMEOUT_MS = 10_000;

export type ExternalDataset = {
  dataAsOf: string;
  records: Record<string, unknown>[];
};

function baseUrlOf(source: ExternalSourceKey): string {
  return (process.env[BASE_URL_ENV[source]] || DEFAULT_BASE_URLS[source]).replace(/\/+$/, "");
}

/** True when the shared secret is configured; otherwise live reads are skipped. */
export function externalSourcesEnabled(): boolean {
  return Boolean(process.env["KEMI_EXPORT_SECRET"]);
}

/**
 * Fetch one dataset from a source app. Returns null on any failure
 * (secret missing, network error, non-200, bad payload).
 */
export async function fetchExternalDataset(
  source: ExternalSourceKey,
  dataset: string,
): Promise<ExternalDataset | null> {
  const secret = process.env["KEMI_EXPORT_SECRET"];
  if (!secret) return null;

  const url = `${baseUrlOf(source)}/api/public/kemi-export?dataset=${encodeURIComponent(dataset)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "x-kemi-secret": secret, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[kemi-export] ${source}/${dataset} failed [${response.status}]: ${body.slice(0, 500)}`);
      return null;
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") return null;

    const { dataAsOf, records } = payload as { dataAsOf?: unknown; records?: unknown };
    if (!Array.isArray(records)) return null;

    return {
      dataAsOf: typeof dataAsOf === "string" ? dataAsOf : "",
      records: records.filter(
        (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
      ),
    };
  } catch (error) {
    console.error(`[kemi-export] ${source}/${dataset} error:`, error);
    return null;
  }
}
