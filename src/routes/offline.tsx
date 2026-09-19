import { createFileRoute } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/kemi-logo.png.asset.json";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Offline — KEMI" },
      { name: "description", content: "Anda sedang offline. / You are currently offline." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={logo.url} alt={t("app.name")} className="mx-auto h-14 w-14 rounded-xl" />
          <div className="mt-3 flex items-center gap-2 text-muted-foreground">
            <WifiOff className="h-5 w-5" />
          </div>
          <CardTitle className="mt-1 text-xl">{t("offline.title")}</CardTitle>
          <CardDescription>{t("offline.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="brand" className="w-full" onClick={() => window.location.reload()}>
            {t("offline.retry")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
