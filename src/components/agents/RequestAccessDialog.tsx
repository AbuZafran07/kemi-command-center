import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { requestAgentAccess } from "@/lib/access.functions";

export function RequestAccessDialog({
  agentCode,
  agentName,
  trigger,
}: {
  agentCode: string;
  agentName: string;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const submit = useServerFn(requestAgentAccess);

  const mutation = useMutation({
    mutationFn: () => submit({ data: { agentCode, purpose: purpose.trim() } }),
    onSuccess: () => {
      toast.success(t("access.submitted"));
      setPurpose("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["my-access-requests"] });
    },
    onError: (error: Error) => {
      const key = error.message.includes("PENDING_EXISTS")
        ? "access.errorPending"
        : error.message.includes("ALREADY_ALLOWED")
          ? "access.errorAlready"
          : "access.errorGeneric";
      toast.error(t(key));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("access.dialogTitle", { agent: agentName })}</DialogTitle>
          <DialogDescription>{t("access.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          placeholder={t("access.purposePlaceholder")}
          rows={4}
        />
        <DialogFooter>
          <Button
            variant="brand"
            disabled={purpose.trim().length < 5 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("access.submitting") : t("access.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
