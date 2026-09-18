import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BriefingMetric = {
  key: string;
  value: number;
  unit: string;
  sourceCode: string;
  sourceName: string;
  dataAsOf: string;
  previousValue: number | null;
  delta: number | null;
};

export type BriefingMetrics = {
  snapshotDate: string | null;
  previousDate: string | null;
  metrics: BriefingMetric[];
};

type ArcaContext = {
  supabase: {
    rpc: (
      fn: "can_use_agent",
      args: { _user_id: string; _agent_code: string },
    ) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
};

async function assertArcaAccess(context: ArcaContext) {
  const { data: allowed } = await context.supabase.rpc("can_use_agent", {
    _user_id: context.userId,
    _agent_code: "ARCA",
  });
  if (allowed !== true) throw new Error("FORBIDDEN_BRIEFING");
}

/** Daily snapshot metrics + change vs the previous snapshot date. */
export const getBriefingMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BriefingMetrics> => {
    await assertArcaAccess(context);

    const { data: rows, error } = await context.supabase
      .from("daily_snapshots")
      .select("snapshot_date, metric_key, metric_value, unit, source_code")
      .order("snapshot_date", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);

    const all = rows ?? [];
    const dates = Array.from(new Set(all.map((r) => r.snapshot_date))).sort().reverse();
    const snapshotDate = dates[0] ?? null;
    const previousDate = dates[1] ?? null;
    if (!snapshotDate) return { snapshotDate: null, previousDate: null, metrics: [] };

    const { data: sources } = await context.supabase
      .from("data_sources")
      .select("code, name, data_as_of");
    const sourceByCode = new Map((sources ?? []).map((s) => [s.code, s]));

    const prev = new Map(
      all.filter((r) => r.snapshot_date === previousDate).map((r) => [r.metric_key, Number(r.metric_value)]),
    );

    const metrics = all
      .filter((r) => r.snapshot_date === snapshotDate)
      .map((r) => {
        const value = Number(r.metric_value);
        const previousValue = prev.has(r.metric_key) ? (prev.get(r.metric_key) as number) : null;
        const source = sourceByCode.get(r.source_code);
        return {
          key: r.metric_key,
          value,
          unit: r.unit,
          sourceCode: r.source_code,
          sourceName: source?.name ?? r.source_code,
          dataAsOf: source?.data_as_of ?? "",
          previousValue,
          delta: previousValue === null ? null : value - previousValue,
        };
      });

    return { snapshotDate, previousDate, metrics };
  });

export type BriefingNarrative = {
  answer: string;
  reports: {
    agentCode: string;
    agentName: string;
    ok: boolean;
    summary: string;
    reason?: string | undefined;
    dataAsOf: string;
  }[];
  sources: {
    code: string;
    name: string;
    system: string;
    classification: string;
    data_as_of: string;
    is_demo: boolean;
  }[];
  trace: {
    depth: number;
    calls: number;
    maxDepth: number;
    maxCalls: number;
    skipped: { agentCode: string; reason: string }[];
  };
};

/** ARCA builds the executive narrative by consulting the agents the user may use. */
export const generateBriefingNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BriefingNarrative> => {
    await assertArcaAccess(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runArcaOrchestration } = await import("@/lib/orchestrator.server");
    const { listSourceDetails } = await import("@/lib/agent-data.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, division, language_pref")
      .eq("id", context.userId)
      .maybeSingle();
    const language = profile?.language_pref === "en" ? "en" : "id";

    const question =
      language === "en"
        ? "Build today's executive daily briefing: business summary, sales, cash/AR/AP, stock and expiry risk, outstanding purchasing, people/attendance, and the most important exceptions that need a decision. Keep it short and concrete."
        : "Susun daily briefing eksekutif hari ini: ringkasan bisnis, penjualan, kas/AR/AP, stok & risiko expiry, purchasing outstanding, people/absensi, dan exception penting yang perlu keputusan. Ringkas dan konkret.";

    const result = await runArcaOrchestration({
      admin: supabaseAdmin,
      userClient: context.supabase as never,
      userId: context.userId,
      question,
      language,
      userLabel: `${profile?.full_name || "an executive"} (${profile?.division || "-"})`,
    });

    const sources = await listSourceDetails(supabaseAdmin, result.sourceCodes);

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      agent_code: "ARCA",
      action: "daily_briefing_generated",
      detail: {
        agents_consulted: result.reports.filter((r) => r.ok).map((r) => r.agentCode),
        agents_skipped: result.trace.skipped,
        model_calls: result.trace.calls,
        language,
      } as never,
      data_scope: "cross_division_briefing",
    });

    return {
      answer: result.answer,
      reports: result.reports.map((r) => ({
        agentCode: r.agentCode,
        agentName: r.agentName,
        ok: r.ok,
        summary: r.summary,
        reason: r.reason,
        dataAsOf: r.dataAsOf,
      })),
      sources: sources as BriefingNarrative["sources"],
      trace: result.trace,
    };
  });
