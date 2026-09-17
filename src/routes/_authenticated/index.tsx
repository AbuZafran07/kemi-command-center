import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function DashboardPage() {
  const { t } = useTranslation();
  const cards = ["cardAgents", "cardTasks", "cardDocs", "cardAudit"] as const;

  return (
    <>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`dashboard.${key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-brand">—</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("common.soon")}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t("dashboard.placeholder")}</p>
    </>
  );
}
