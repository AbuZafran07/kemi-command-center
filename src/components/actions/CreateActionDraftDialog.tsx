import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createActionDraft, listSensitiveActions } from "@/lib/actions.functions";
import { listMyAgents } from "@/lib/agents.functions";

type FieldState = {
  employee_no: string;
  letter_type: "SP1" | "SP2" | "SP3" | "";
  reason: string;
  field: "division" | "position" | "status" | "";
  new_value: string;
  po_no: string;
};

const EMPTY_FIELDS: FieldState = {
  employee_no: "",
  letter_type: "",
  reason: "",
  field: "",
  new_value: "",
  po_no: "",
};

function buildPayload(actionCode: string, fields: FieldState): Record<string, unknown> | null {
  if (actionCode === "DISCIPLINARY_LETTER_DRAFT") {
    if (!fields.employee_no || !fields.letter_type || fields.reason.trim().length < 5) return null;
    return {
      employee_no: fields.employee_no,
      letter_type: fields.letter_type,
      reason: fields.reason.trim(),
    };
  }
  if (actionCode === "MASTER_DATA_CHANGE") {
    if (!fields.employee_no || !fields.field || !fields.new_value.trim()) return null;
    return {
      employee_no: fields.employee_no,
      field: fields.field,
      new_value: fields.new_value.trim(),
    };
  }
  if (actionCode === "PO_APPROVAL") {
    if (!fields.po_no.trim()) return null;
    return { po_no: fields.po_no.trim() };
  }
  return null;
}

export function CreateActionDraftDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [actionCode, setActionCode] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<FieldState>(EMPTY_FIELDS);

  const fetchActions = useServerFn(listSensitiveActions);
  const fetchAgents = useServerFn(listMyAgents);
  const submit = useServerFn(createActionDraft);

  const actionsQuery = useQuery({
    queryKey: ["sensitive-actions"],
    queryFn: () => fetchActions(),
    enabled: open,
  });
  const agentsQuery = useQuery({
    queryKey: ["my-agents"],
    queryFn: () => fetchAgents(),
    enabled: open,
  });

  const actions = actionsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const payload = buildPayload(actionCode, fields);

  const reset = () => {
    setActionCode("");
    setAgentCode("");
    setTitle("");
    setFields(EMPTY_FIELDS);
  };

  const mutation = useMutation({
    mutationFn: () =>
      submit({ data: { actionCode, agentCode, title: title.trim(), payload: payload ?? {} } }),
    onSuccess: () => {
      toast.success(t("actions.created"));
      reset();
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["my-action-drafts"] });
    },
    onError: (error: Error) => {
      const key = error.message.includes("FORBIDDEN_AGENT")
        ? "actions.errorForbiddenAgent"
        : error.message.includes("INVALID_PAYLOAD")
          ? "actions.errorInvalidPayload"
          : "actions.errorGeneric";
      toast.error(t(key));
    },
  });

  const canSubmit =
    actionCode.length > 0 && agentCode.length > 0 && title.trim().length >= 3 && payload !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("actions.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("actions.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("actions.pickAction")}</Label>
            <Select
              value={actionCode}
              onValueChange={(value) => {
                setActionCode(value);
                setFields(EMPTY_FIELDS);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("actions.pickActionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {actions.map((action) => (
                  <SelectItem key={action.code} value={action.code}>
                    {action.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionCode ? (
              <p className="text-xs text-muted-foreground">
                {actions.find((a) => a.code === actionCode)?.description}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("actions.pickAgent")}</Label>
            <Select value={agentCode} onValueChange={setAgentCode}>
              <SelectTrigger>
                <SelectValue placeholder={t("actions.pickAgentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.code} value={agent.code}>
                    {agent.name} · {agent.division}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("actions.title")}</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </div>

          {actionCode === "DISCIPLINARY_LETTER_DRAFT" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label>{t("actions.employeeNo")}</Label>
                <Input
                  value={fields.employee_no}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, employee_no: event.target.value }))
                  }
                  placeholder="EMP-005"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("actions.letterType")}</Label>
                <Select
                  value={fields.letter_type}
                  onValueChange={(value) =>
                    setFields((prev) => ({
                      ...prev,
                      letter_type: value as FieldState["letter_type"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="SP1 / SP2 / SP3" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SP1">SP1</SelectItem>
                    <SelectItem value="SP2">SP2</SelectItem>
                    <SelectItem value="SP3">SP3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("actions.reason")}</Label>
                <Textarea
                  rows={3}
                  value={fields.reason}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          {actionCode === "MASTER_DATA_CHANGE" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label>{t("actions.employeeNo")}</Label>
                <Input
                  value={fields.employee_no}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, employee_no: event.target.value }))
                  }
                  placeholder="EMP-005"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("actions.field")}</Label>
                <Select
                  value={fields.field}
                  onValueChange={(value) =>
                    setFields((prev) => ({ ...prev, field: value as FieldState["field"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("actions.fieldPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="division">{t("actions.fieldDivision")}</SelectItem>
                    <SelectItem value="position">{t("actions.fieldPosition")}</SelectItem>
                    <SelectItem value="status">{t("actions.fieldStatus")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("actions.newValue")}</Label>
                <Input
                  value={fields.new_value}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, new_value: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          {actionCode === "PO_APPROVAL" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label>{t("actions.poNo")}</Label>
                <Input
                  value={fields.po_no}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, po_no: event.target.value }))
                  }
                  placeholder="PO-2606-001"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="brand"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("actions.submitting") : t("actions.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
