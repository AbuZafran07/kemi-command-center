import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { CreateActionDraftDialog } from "@/components/actions/CreateActionDraftDialog";
import { useAuth } from "@/components/providers/AppProviders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  type ActionDraftRow,
  decideActionDraft,
  executeActionDraft,
  listExecutableActionDrafts,
  listMyActionDrafts,
  listPendingActionApprovals,
} from "@/lib/actions.functions";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Aksi Sensitif — KEMI" },
      {
        name: "description",
        content: "Draf, persetujuan, dan eksekusi terkontrol untuk aksi yang mengubah data.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActionsPage,
});

const APPROVER_ROLES = ["CEO", "Director", "Manager"];

function statusVariant(status: ActionDraftRow["status"]) {
  if (status === "executed") return "default" as const;
  if (status === "rejected" || status === "execution_failed") return "destructive" as const;
  if (status === "approved") return "outline" as const;
  return "secondary" as const;
}

function DraftMeta({ draft, language }: { draft: ActionDraftRow; language: string }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <p className="font-medium">{draft.title}</p>
      <p className="text-sm text-muted-foreground">
        {draft.action_name}
        {draft.agent_code ? ` · ${draft.agent_code}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("actions.byUser", { name: draft.requester_name })} ·{" "}
        {new Date(draft.created_at).toLocaleString(language)}
      </p>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
        {JSON.stringify(draft.payload, null, 2)}
      </pre>
      {draft.execution_result ? (
        <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-xs">
          {JSON.stringify(draft.execution_result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function ActionsPage() {
  const { t, i18n } = useTranslation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isApprover = Boolean(role && APPROVER_ROLES.includes(role));

  const fetchMine = useServerFn(listMyActionDrafts);
  const fetchPending = useServerFn(listPendingActionApprovals);
  const fetchExecutable = useServerFn(listExecutableActionDrafts);
  const decide = useServerFn(decideActionDraft);
  const execute = useServerFn(executeActionDraft);

  const [notes, setNotes] = useState<Record<string, string>>({});

  const mineQuery = useQuery({ queryKey: ["my-action-drafts"], queryFn: () => fetchMine() });
  const pendingQuery = useQuery({
    queryKey: ["pending-action-approvals"],
    queryFn: () => fetchPending(),
    enabled: isApprover,
  });
  const executableQuery = useQuery({
    queryKey: ["executable-action-drafts"],
    queryFn: () => fetchExecutable(),
    enabled: isApprover,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-action-drafts"] });
    void queryClient.invalidateQueries({ queryKey: ["pending-action-approvals"] });
    void queryClient.invalidateQueries({ queryKey: ["executable-action-drafts"] });
  };

  const decideMutation = useMutation({
    mutationFn: (input: { draftId: string; decision: "approved" | "rejected" }) =>
      decide({
        data: {
          draftId: input.draftId,
          decision: input.decision,
          note: notes[input.draftId] ?? "",
        },
      }),
    onSuccess: (_result, variables) => {
      toast.success(t(variables.decision === "approved" ? "actions.approved" : "actions.rejected"));
      invalidateAll();
    },
    onError: (error: Error) => {
      toast.error(
        t(
          error.message.includes("NOT_DECIDABLE") ? "actions.notDecidable" : "actions.decideFailed",
        ),
      );
    },
  });

  const executeMutation = useMutation({
    mutationFn: (draftId: string) => execute({ data: { draftId } }),
    onSuccess: () => {
      toast.success(t("actions.executed"));
      invalidateAll();
    },
    onError: (error: Error) => {
      const key = error.message.includes("SEGREGATION_OF_DUTIES")
        ? "actions.errorSegregation"
        : error.message.includes("FORBIDDEN")
          ? "actions.errorForbiddenExecute"
          : error.message.includes("EXECUTION_FAILED")
            ? "actions.errorExecutionFailed"
            : "actions.errorGeneric";
      toast.error(t(key));
      invalidateAll();
    },
  });

  const mine = mineQuery.data ?? [];
  const pending = pendingQuery.data ?? [];
  const executable = executableQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("actions.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("actions.pageSubtitle")}</p>
        </div>
        <CreateActionDraftDialog
          trigger={<Button variant="brand">{t("actions.newDraft")}</Button>}
        />
      </div>

      {isApprover ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("actions.pendingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("actions.pendingEmpty")}</p>
            ) : (
              pending.map((draft) => (
                <div key={draft.id} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <DraftMeta draft={draft} language={i18n.language} />
                    <Badge variant={statusVariant(draft.status)}>
                      {t(`actions.status.${draft.status}`)}
                    </Badge>
                  </div>
                  <Textarea
                    rows={2}
                    value={notes[draft.id] ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [draft.id]: event.target.value }))
                    }
                    placeholder={t("actions.notePlaceholder")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      disabled={decideMutation.isPending}
                      onClick={() =>
                        decideMutation.mutate({ draftId: draft.id, decision: "approved" })
                      }
                    >
                      {t("actions.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={decideMutation.isPending}
                      onClick={() =>
                        decideMutation.mutate({ draftId: draft.id, decision: "rejected" })
                      }
                    >
                      {t("actions.reject")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {isApprover ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("actions.executableTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executableQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : executable.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("actions.executableEmpty")}</p>
            ) : (
              executable.map((draft) => (
                <div
                  key={draft.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <DraftMeta draft={draft} language={i18n.language} />
                  <Button
                    variant="brand"
                    disabled={executeMutation.isPending}
                    onClick={() => executeMutation.mutate(draft.id)}
                  >
                    {t("actions.execute")}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("actions.myTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mineQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("actions.myEmpty")}</p>
          ) : (
            mine.map((draft) => (
              <div
                key={draft.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <DraftMeta draft={draft} language={i18n.language} />
                <Badge variant={statusVariant(draft.status)}>
                  {t(`actions.status.${draft.status}`)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
