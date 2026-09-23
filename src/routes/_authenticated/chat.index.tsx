import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { listMyAgents } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "Obrolan — KEMI" },
      { name: "description", content: "Pilih agen KEMI untuk mulai berdialog." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatIndexPage,
});

function ChatIndexPage() {
  const { t } = useTranslation();
  const fetchAgents = useServerFn(listMyAgents);
  const { data, isLoading } = useQuery({ queryKey: ["my-agents"], queryFn: () => fetchAgents() });
  const agents = data ?? [];

  return (
    <>
      <PageHeader title={t("chat.title")} subtitle={t("chat.pickAgent")} />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("agents.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.code} to="/chat/$code" params={{ code: agent.code.toLowerCase() }}>
              <Card className="transition-colors hover:border-brand">
                <CardContent className="flex items-center gap-3 py-4">
                  <AgentAvatar
                    name={agent.name}
                    avatarUrl={agent.avatar_url}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{agent.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.role} · {agent.division}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
