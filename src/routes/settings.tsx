import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { usePreferences } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan — KEMI" },
      { name: "description", content: "Atur tema tampilan dan bahasa antarmuka KEMI." },
      { property: "og:title", content: "Pengaturan — KEMI" },
      { property: "og:description", content: "Atur tema dan bahasa antarmuka KEMI." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = usePreferences();

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.appearance")}</CardTitle>
            <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={theme === "light" ? "brand" : "outline"} size="sm" onClick={() => setTheme("light")}>
              {t("header.themeLight")}
            </Button>
            <Button variant={theme === "dark" ? "brand" : "outline"} size="sm" onClick={() => setTheme("dark")}>
              {t("header.themeDark")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.language")}</CardTitle>
            <CardDescription>{t("settings.languageDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={language === "id" ? "brand" : "outline"} size="sm" onClick={() => setLanguage("id")}>
              Bahasa Indonesia
            </Button>
            <Button variant={language === "en" ? "brand" : "outline"} size="sm" onClick={() => setLanguage("en")}>
              English
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{t("settings.note")}</p>
      </div>
    </>
  );
}
