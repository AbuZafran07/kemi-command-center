import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessagesSquare } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyAgents, type AgentCard } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({
    meta: [
      { title: "Pusat Agen — KEMI" },
      { name: "description", content: "Tim digital KEMI: agen yang berwenang untuk Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentsPage,
});

const CHAT_ENABLED = ["JOKO", "WAWAN", "ALDI"];

function AgentsPage() {
  const { t } = useTranslation();
  const fetchAgents = useServerFn(listMyAgents);
  const [selected, setSelected] = useState<AgentCard | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-agents"],
    queryFn: () => fetchAgents(),
  });

  const agents = data ?? [];

  return (
    <>
      <PageHeader title={t("agents.title")} subtitle={t("agents.subtitle")} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("agents.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.code} className="hover-glow flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                  <Badge variant="secondary" className="mt-1.5">
                    {agent.division}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-sm text-muted-foreground">{agent.description}</p>
                <div className="flex flex-wrap gap-2">
                  {CHAT_ENABLED.includes(agent.code) ? (
                    <Button asChild size="sm" variant="brand">
                      <Link to="/chat/$code" params={{ code: agent.code.toLowerCase() }}>
                        <MessagesSquare className="mr-1.5 h-4 w-4" />
                        {t("agents.chat")}
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="brand" disabled>
                      {t("common.soon")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSelected(agent)}>
                    {t("agents.profile")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <AgentAvatar name={selected.name} avatarUrl={selected.avatar_url} size="lg" />
                  <div>
                    <SheetTitle>{selected.name}</SheetTitle>
                    <SheetDescription>{selected.role}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t("agents.division")}
                  </p>
                  <p>{selected.division}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t("agents.scope")}
                  </p>
                  <p>{selected.description}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t("agents.knowledge")}
                  </p>
                  <p className="text-muted-foreground">
                    {CHAT_ENABLED.includes(selected.code)
                      ? t("agents.knowledgeDemo")
                      : t("agents.knowledgeNone")}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
