import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  generateBriefingNarrative,
  getBriefingMetrics,
  type BriefingMetric,
} from "@/lib/briefing.functions";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({
    meta: [
      { title: "Daily Briefing — KEMI" },
      {
        name: "description",
        content:
          "Briefing eksekutif harian KEMI: penjualan, kas & piutang, stok, pembelian, dan people dalam satu halaman.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BriefingPage,
});

const SECTIONS: { key: string; metrics: string[] }[] = [
  { key: "sales", metrics: ["sales_amount_last_month", "sales_orders_last_month"] },
  { key: "cash", metrics: ["cash_balance", "ar_outstanding", "ar_overdue", "ap_outstanding"] },
  { key: "stock", metrics: ["stock_qty_total", "stock_sku_empty", "stock_expiry_risk_90d"] },
  { key: "purchasing", metrics: ["po_outstanding_amount", "po_outstanding_count"] },
  { key: "people", metrics: ["headcount_active", "attendance_issue_last_day"] },
];

function formatValue(metric: BriefingMetric, locale: string) {
  if (metric.unit === "IDR") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(metric.value);
  }
  return `${new Intl.NumberFormat(locale).format(metric.value)} ${metric.unit}`.trim();
}

function MetricCard({ metric, locale }: { metric: BriefingMetric; locale: string }) {
  const { t } = useTranslation();
  const delta = metric.delta;
  const Icon = delta === null || delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(`briefing.metric.${metric.key}`, metric.key)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xl font-semibold text-brand">{formatValue(metric, locale)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {delta === null
            ? t("briefing.noPrevious")
            : delta === 0
              ? t("briefing.noChange")
              : `${delta > 0 ? "+" : ""}${formatValue({ ...metric, value: delta }, locale)} ${t("briefing.vsPrevious")}`}
        </p>
        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("briefing.source")}: {metric.sourceName}
          {metric.dataAsOf ? ` · ${t("briefing.period")}: ${metric.dataAsOf}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function BriefingPage() {
  const { t, i18n } = useTranslation();
  const fetchMetrics = useServerFn(getBriefingMetrics);
  const runNarrative = useServerFn(generateBriefingNarrative);

  const metricsQuery = useQuery({ queryKey: ["briefing-metrics"], queryFn: () => fetchMetrics() });
  const narrative = useMutation({ mutationFn: () => runNarrative({ data: undefined }) });

  const metrics = metricsQuery.data?.metrics ?? [];
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const locale = i18n.language === "en" ? "en-US" : "id-ID";

  if (metricsQuery.isError) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("briefing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("briefing.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("briefing.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("briefing.subtitle")}
            {metricsQuery.data?.snapshotDate ? ` · ${metricsQuery.data.snapshotDate}` : ""}
          </p>
        </div>
        <Button onClick={() => narrative.mutate()} disabled={narrative.isPending}>
          <Sparkles className="mr-2 h-4 w-4" />
          {narrative.isPending ? t("briefing.generating") : t("briefing.generate")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("briefing.summaryTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {narrative.isPending ? (
            <p className="text-sm text-muted-foreground">{t("briefing.generatingHint")}</p>
          ) : narrative.isError ? (
            <p className="text-sm text-destructive">{t("briefing.failed")}</p>
          ) : narrative.data ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{narrative.data.answer}</p>
              <Separator />
              <div className="space-y-3">
                {narrative.data.reports.map((report) => (
                  <div key={report.agentCode} className="rounded-md border border-border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium">{report.agentName}</span>
                      <Badge variant={report.ok ? "secondary" : "outline"}>
                        {report.ok ? report.dataAsOf || report.agentCode : t(`briefing.reason.${report.reason}`, report.reason ?? "")}
                      </Badge>
                    </div>
                    {report.ok ? (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                        {report.summary}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("briefing.limits", {
                  calls: narrative.data.trace.calls,
                  maxCalls: narrative.data.trace.maxCalls,
                  depth: narrative.data.trace.depth,
                  maxDepth: narrative.data.trace.maxDepth,
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("briefing.emptyNarrative")}</p>
          )}
        </CardContent>
      </Card>

      {metricsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("briefing.noSnapshot")}</p>
      ) : (
        SECTIONS.map((section) => {
          const cards = section.metrics
            .map((key) => byKey.get(key))
            .filter((m): m is BriefingMetric => Boolean(m));
          if (cards.length === 0) return null;
          return (
            <section key={section.key} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`briefing.section.${section.key}`)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} locale={locale} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
