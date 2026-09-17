import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({
    meta: [
      { title: "Pusat Agen — KEMI" },
      { name: "description", content: "Kelola dan jalankan agen cerdas KEMI untuk tugas perusahaan." },
      { property: "og:title", content: "Pusat Agen — KEMI" },
      { property: "og:description", content: "Kelola dan jalankan agen cerdas KEMI." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("agents.title")} subtitle={t("agents.subtitle")} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("agents.placeholder")}
        </CardContent>
      </Card>
    </>
  );
}
