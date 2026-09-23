import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";

import { RequestAccessDialog } from "@/components/agents/RequestAccessDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listMyAccessRequests } from "@/lib/access.functions";
import { listAllAgents } from "@/lib/agents.functions";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Permohonan Akses — KEMI" },
      { name: "description", content: "Ajukan dan pantau permohonan akses agen KEMI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

function statusVariant(status: string) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
}

function RequestsPage() {
  const { t, i18n } = useTranslation();
  const fetchRequests = useServerFn(listMyAccessRequests);
  const fetchAgents = useServerFn(listAllAgents);
  const [selected, setSelected] = useState<string>("");

  const requestsQuery = useQuery({
    queryKey: ["my-access-requests"],
    queryFn: () => fetchRequests(),
  });
  const agentsQuery = useQuery({ queryKey: ["all-agents"], queryFn: () => fetchAgents() });

  const requests = requestsQuery.data ?? [];
  const agents = (agentsQuery.data ?? []).filter((agent) => !agent.allowed);
  const selectedAgent = agents.find((agent) => agent.code === selected) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("access.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("access.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("access.newTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t("access.pickAgent")} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.code} value={agent.code}>
                  {agent.name} · {agent.division}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAgent ? (
            <RequestAccessDialog
              agentCode={selectedAgent.code}
              agentName={selectedAgent.name}
              trigger={<Button variant="brand">{t("access.requestAccess")}</Button>}
            />
          ) : (
            <Button variant="brand" disabled>
              {t("access.requestAccess")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("access.myTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requestsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("access.myEmpty")}</p>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{request.agent_name}</p>
                  <p className="text-sm text-muted-foreground">{request.purpose}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(request.created_at).toLocaleString(i18n.language)} ·{" "}
                    {t("access.approverRole", { role: request.approver_role })}
                  </p>
                </div>
                <Badge variant={statusVariant(request.status)}>
                  {t(`access.status.${request.status}`)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
