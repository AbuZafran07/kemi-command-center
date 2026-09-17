import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Obrolan — KEMI" },
      { name: "description", content: "Berdialog dengan KEMI untuk menjawab pertanyaan operasional." },
      { property: "og:title", content: "Obrolan — KEMI" },
      { property: "og:description", content: "Berdialog dengan asisten KEMI." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/chat" },
    ],
    links: [{ rel: "canonical", href: "/chat" }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("chat.placeholder")}
        </CardContent>
      </Card>
    </>
  );
}
