import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { decideAccessRequest, listPendingApprovals } from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Kotak Persetujuan — KEMI" },
      { name: "description", content: "Tinjau dan putuskan permohonan akses agen KEMI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fetchPending = useServerFn(listPendingApprovals);
  const decide = useServerFn(decideAccessRequest);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const pendingQuery = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => fetchPending(),
  });

  const mutation = useMutation({
    mutationFn: (input: { requestId: string; decision: "approved" | "rejected" }) =>
      decide({
        data: {
          requestId: input.requestId,
          decision: input.decision,
          note: notes[input.requestId] ?? "",
        },
      }),
    onSuccess: (_result, variables) => {
      toast.success(
        t(variables.decision === "approved" ? "approvals.approved" : "approvals.rejected"),
      );
      void queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["my-agents"] });
    },
    onError: (error: Error) => {
      toast.error(
        t(error.message.includes("NOT_DECIDABLE") ? "approvals.notAllowed" : "approvals.failed"),
      );
    },
  });

  const requests = pendingQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("approvals.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("approvals.subtitle")}</p>
      </div>

      {pendingQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("approvals.empty")}
          </CardContent>
        </Card>
      ) : (
        requests.map((request) => (
          <Card key={request.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {request.requester_name}
                {request.requester_email ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {request.requester_email}
                  </span>
                ) : null}
                <Badge variant="secondary">{request.agent_name}</Badge>
                <span className="text-xs font-normal text-muted-foreground">
                  {new Date(request.created_at).toLocaleString(i18n.language)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {t("approvals.purpose")}
                </p>
                <p className="text-sm">{request.purpose}</p>
              </div>
              <Textarea
                rows={2}
                value={notes[request.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                }
                placeholder={t("approvals.notePlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ requestId: request.id, decision: "approved" })}
                >
                  {t("approvals.approve")}
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ requestId: request.id, decision: "rejected" })}
                >
                  {t("approvals.reject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
