import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAuditLog } from "@/lib/access.functions";
import { listAllAgents } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Catatan Audit — KEMI" },
      { name: "description", content: "Jejak audit akses data dan aksi penting di KEMI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

const ALL = "__all__";

function AuditPage() {
  const { t, i18n } = useTranslation();
  const fetchAudit = useServerFn(listAuditLog);
  const fetchAgents = useServerFn(listAllAgents);

  const [agentCode, setAgentCode] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const agentsQuery = useQuery({ queryKey: ["all-agents"], queryFn: () => fetchAgents() });
  const auditQuery = useQuery({
    queryKey: ["audit-log", agentCode, from, to],
    queryFn: () =>
      fetchAudit({
        data: {
          ...(agentCode !== ALL ? { agentCode } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          limit: 200,
        },
      }),
  });

  const rows = (auditQuery.data ?? []).filter((row) =>
    userFilter.trim()
      ? row.user_name.toLowerCase().includes(userFilter.trim().toLowerCase())
      : true,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("audit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("audit.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>{t("audit.filterUser")}</Label>
            <Input value={userFilter} onChange={(event) => setUserFilter(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("audit.filterAgent")}</Label>
            <Select value={agentCode} onValueChange={setAgentCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("audit.allAgents")}</SelectItem>
                {(agentsQuery.data ?? []).map((agent) => (
                  <SelectItem key={agent.code} value={agent.code}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("audit.filterFrom")}</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("audit.filterTo")}</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {auditQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("audit.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">{t("audit.colTime")}</th>
                    <th className="px-4 py-2">{t("audit.colUser")}</th>
                    <th className="px-4 py-2">{t("audit.colAgent")}</th>
                    <th className="px-4 py-2">{t("audit.colAction")}</th>
                    <th className="px-4 py-2">{t("audit.colScope")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString(i18n.language)}
                      </td>
                      <td className="px-4 py-2">{row.user_name}</td>
                      <td className="px-4 py-2">{row.agent_code ?? "—"}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{row.action}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{row.data_scope || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
