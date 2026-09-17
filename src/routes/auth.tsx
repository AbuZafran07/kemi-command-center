import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/kemi-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — KEMI Kemika Enterprise Mind Intelligence" },
      { name: "description", content: "Masuk ke KEMI, command center PT Kemika Karya Pratama." },
      { property: "og:title", content: "Masuk — KEMI" },
      { property: "og:description", content: "Masuk ke command center KEMI." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={logo.url} alt={t("app.name")} className="mx-auto h-14 w-14 rounded-xl" />
          <CardTitle className="mt-3 text-xl">{t("auth.title")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" variant="brand" className="w-full" disabled={busy}>
              {busy ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("auth.noSelfSignup")}</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
