import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { useAuth, usePreferences, type AppRole } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAccount } from "@/lib/admin-users.functions";

const ROLES: AppRole[] = ["CEO", "Director", "Manager", "Supervisor", "Staff"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan — KEMI" },
      { name: "description", content: "Atur tema tampilan, bahasa, dan akun pengguna KEMI." },
      { property: "og:title", content: "Pengaturan — KEMI" },
      { property: "og:description", content: "Atur tema, bahasa, dan akun pengguna KEMI." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = usePreferences();
  const { role } = useAuth();

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

        {role === "CEO" ? <CreateUserCard /> : null}

        <p className="text-xs text-muted-foreground">{t("settings.note")}</p>
      </div>
    </>
  );
}

function CreateUserCard() {
  const { t } = useTranslation();
  const createUser = useServerFn(createUserAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [division, setDivision] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("Staff");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await createUser({ data: { email, password, fullName, division, role: newRole } });
      setStatus({ ok: true, message: t("users.created") });
      setEmail("");
      setPassword("");
      setFullName("");
      setDivision("");
    } catch (error) {
      setStatus({ ok: false, message: error instanceof Error ? error.message : t("users.failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("users.title")}</CardTitle>
        <CardDescription>{t("users.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">{t("users.fullName")}</Label>
            <Input id="new-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-division">{t("users.division")}</Label>
            <Input id="new-division" value={division} onChange={(e) => setDivision(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">{t("auth.email")}</Label>
            <Input id="new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t("auth.password")}</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role">{t("users.role")}</Label>
            <select
              id="new-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AppRole)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="brand" disabled={busy} className="w-full">
              {busy ? t("users.creating") : t("users.create")}
            </Button>
          </div>
          {status ? (
            <p className={`sm:col-span-2 text-sm ${status.ok ? "text-brand" : "text-destructive"}`}>
              {status.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
