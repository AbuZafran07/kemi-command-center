import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowRight, ArrowUpRight, MessagesSquare, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { useAuth } from "@/components/providers/AppProviders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type AgentCard, listMyAgents } from "@/lib/agents.functions";
import {
  generateBriefingNarrative,
  getBriefingMetrics,
  type BriefingMetric,
} from "@/lib/briefing.functions";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dasbor KEMI — Kemika Enterprise Mind Intelligence" },
      {
        name: "description",
        content:
          "Command center KEMI: pantau agen, tugas, dan dokumen perusahaan dalam satu dasbor. Think. Act. Deliver.",
      },
      { property: "og:title", content: "Dasbor KEMI — Kemika Enterprise Mind Intelligence" },
      {
        property: "og:description",
        content: "Command center KEMI untuk agen, tugas, dan dokumen PT Kemika Karya Pratama.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
});

const CHAT_ENABLED = ["ARCA", "JOKO", "WAWAN", "ALDI", "SALLY", "PIA", "PURI"];
const KPI_KEYS = [
  "sales_amount_last_month",
  "cash_balance",
  "ar_overdue",
  "stock_expiry_risk_90d",
] as const;

function jakartaHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
}

function greetingKey(hour: number) {
  if (hour >= 4 && hour < 11) return "dashboard.greetingMorning";
  if (hour >= 11 && hour < 15) return "dashboard.greetingAfternoon";
  if (hour >= 15 && hour < 19) return "dashboard.greetingEvening";
  return "dashboard.greetingNight";
}

function formatValue(value: number, unit: string, locale: string) {
  if (unit === "IDR") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "IDR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `${new Intl.NumberFormat(locale).format(value)} ${unit}`.trim();
}

/** Two real points (previous -> current), never fabricated history. */
function Sparkline({
  previous,
  current,
  positiveIsGood,
}: {
  previous: number | null;
  current: number;
  positiveIsGood: boolean;
}) {
  const from = previous ?? current;
  const max = Math.max(from, current, 1);
  const min = Math.min(from, current, 0);
  const range = max - min || 1;
  const y = (value: number) => 24 - ((value - min) / range) * 20 - 2;
  const up = current >= from;
  const good = positiveIsGood ? up : !up;

  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16" aria-hidden>
      <polyline
        points={`0,${y(from)} 64,${y(current)}`}
        fill="none"
        stroke={good ? "var(--brand-light)" : "var(--destructive)"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Parses ARCA's narrative into paragraphs tagged Fakta/Analisis when the model labelled them. */
function parseNarrative(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const stripped = line.replace(/^[-*•]\s*/, "").replace(/^\*\*|\*\*$/g, "");
      const factMatch = /^(fakta|fact)\s*[:-]\s*/i.exec(stripped);
      const analysisMatch = /^(analisis|analysis)\s*[:-]\s*/i.exec(stripped);
      if (factMatch) return { tag: "fact" as const, text: stripped.slice(factMatch[0].length) };
      if (analysisMatch)
        return { tag: "analysis" as const, text: stripped.slice(analysisMatch[0].length) };
      return { tag: null, text: stripped };
    });
}

function KpiCard({
  metricKey,
  metric,
  locale,
}: {
  metricKey: string;
  metric: BriefingMetric | undefined;
  locale: string;
}) {
  const { t } = useTranslation();
  // A rise in overdue receivables or expiry risk is bad news, not good news.
  const positiveIsGood = metricKey !== "ar_overdue" && metricKey !== "stock_expiry_risk_90d";

  return (
    <Card className="hover-glow relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(`briefing.metric.${metricKey}`, metricKey)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metric ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <p className="font-display text-2xl font-semibold tracking-tight">
                {formatValue(metric.value, metric.unit, locale)}
              </p>
              <Sparkline
                previous={metric.previousValue}
                current={metric.value}
                positiveIsGood={positiveIsGood}
              />
            </div>
            <TrendLine metric={metric} locale={locale} positiveIsGood={positiveIsGood} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("dashboard.kpiUnavailable")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendLine({
  metric,
  locale,
  positiveIsGood,
}: {
  metric: BriefingMetric;
  locale: string;
  positiveIsGood: boolean;
}) {
  const { t } = useTranslation();
  const delta = metric.delta;
  if (delta === null) {
    return <p className="text-xs text-muted-foreground">{t("briefing.noPrevious")}</p>;
  }
  if (delta === 0) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="h-3.5 w-3.5" />
        {t("briefing.noChange")}
      </p>
    );
  }
  const up = delta > 0;
  const good = positiveIsGood ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={`flex items-center gap-1 text-xs font-medium ${good ? "text-brand" : "text-destructive"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {formatValue(Math.abs(delta), metric.unit, locale)} {t("briefing.vsPrevious")}
    </p>
  );
}

function DigitalTeamCard({ agent }: { agent: AgentCard }) {
  const { t } = useTranslation();
  return (
    <Card className="hover-glow flex items-center gap-3 p-3">
      <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{agent.name}</p>
        <p className="truncate text-xs text-muted-foreground">{agent.division}</p>
      </div>
      {CHAT_ENABLED.includes(agent.code) ? (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to="/chat/$code" params={{ code: agent.code.toLowerCase() }}>
            <MessagesSquare className="h-4 w-4" />
            <span className="sr-only">{t("agents.chat")}</span>
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { profile, user } = useAuth();
  const locale = i18n.language === "en" ? "en-US" : "id-ID";
  const displayName = profile?.full_name || user?.email || t("header.guest");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const dateLabel = `${new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)} · WIB`;

  const fetchMetrics = useServerFn(getBriefingMetrics);
  const runNarrative = useServerFn(generateBriefingNarrative);
  const fetchAgents = useServerFn(listMyAgents);

  const metricsQuery = useQuery({
    queryKey: ["briefing-metrics"],
    queryFn: () => fetchMetrics(),
    retry: false,
  });
  const narrative = useMutation({ mutationFn: () => runNarrative({ data: undefined }) });
  const agentsQuery = useQuery({ queryKey: ["my-agents"], queryFn: () => fetchAgents() });

  const byKey = new Map((metricsQuery.data?.metrics ?? []).map((m) => [m.key, m]));
  const hasBriefingAccess = !metricsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="text-gradient-brand">
            {t(greetingKey(jakartaHour(now)), { name: displayName })}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      {hasBriefingAccess ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricsQuery.isLoading
            ? KPI_KEYS.map((key) => <Skeleton key={key} className="h-32 rounded-2xl" />)
            : KPI_KEYS.map((key) => (
                <KpiCard key={key} metricKey={key} metric={byKey.get(key)} locale={locale} />
              ))}
        </div>
      ) : null}

      <Card className="hover-glow">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand" />
            {t("dashboard.arcaTitle")}
          </CardTitle>
          {hasBriefingAccess ? (
            <Button
              size="sm"
              variant="brand"
              onClick={() => narrative.mutate()}
              disabled={narrative.isPending}
            >
              {narrative.isPending ? t("briefing.generating") : t("briefing.generate")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasBriefingAccess ? (
            <p className="text-sm text-muted-foreground">{t("briefing.forbidden")}</p>
          ) : narrative.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : narrative.isError ? (
            <p className="text-sm text-destructive">{t("briefing.failed")}</p>
          ) : narrative.data ? (
            <>
              <div className="space-y-2 text-sm leading-relaxed">
                {parseNarrative(narrative.data.answer).map((line, index) => (
                  <p key={index} className="flex flex-wrap items-start gap-2">
                    {line.tag ? (
                      <Badge
                        variant={line.tag === "fact" ? "default" : "secondary"}
                        className={
                          line.tag === "fact"
                            ? "bg-brand text-brand-foreground shrink-0"
                            : "shrink-0"
                        }
                      >
                        {t(`dashboard.tag${line.tag === "fact" ? "Fact" : "Analysis"}`)}
                      </Badge>
                    ) : null}
                    <span>{line.text}</span>
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {narrative.data.reports
                  .filter((r) => r.ok && r.dataAsOf)
                  .map((r) => (
                    <Badge key={r.agentCode} variant="outline">
                      {t("chat.dataAsOf")}: {r.dataAsOf}
                    </Badge>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("briefing.emptyNarrative")}</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("dashboard.digitalTeam")}
        </h2>
        {agentsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (agentsQuery.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("agents.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(agentsQuery.data ?? []).map((agent) => (
              <DigitalTeamCard key={agent.code} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
