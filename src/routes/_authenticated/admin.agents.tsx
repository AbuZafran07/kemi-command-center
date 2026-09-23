import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { type AdminAgentRow, adminListAgents, adminUpdateAgent } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  component: AdminAgentsPage,
});

const DIVISION_ORDER = [
  "Executive",
  "HRGA",
  "Finance",
  "Sales",
  "Warehouse",
  "Purchasing",
  "IT/System",
];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;

function groupByDivision(agents: AdminAgentRow[]) {
  const groups = new Map<string, AdminAgentRow[]>();
  for (const agent of agents) {
    groups.set(agent.division, [...(groups.get(agent.division) ?? []), agent]);
  }
  const rank = (division: string) => {
    const index = DIVISION_ORDER.indexOf(division);
    return index === -1 ? DIVISION_ORDER.length : index;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function errorKey(error: Error): string {
  if (error.message.includes("FORBIDDEN")) return "admin.errForbidden";
  return "admin.errGeneric";
}

function AdminAgentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchAgents = useServerFn(adminListAgents);
  const updateAgent = useServerFn(adminUpdateAgent);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agentsQuery = useQuery({ queryKey: ["admin-agents"], queryFn: () => fetchAgents() });
  const groups = groupByDivision(agentsQuery.data ?? []);

  const [editing, setEditing] = useState<AdminAgentRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#006837");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const refresh = () => {
    for (const key of ["admin-agents", "my-agents", "all-agents", "agent-detail", "audit-log"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  function openEdit(agent: AdminAgentRow) {
    setEditing(agent);
    setName(agent.name);
    setDescription(agent.description);
    setColor(agent.avatar_color);
    setPendingFile(null);
    setPreviewUrl(null);
    setRemovePhoto(false);
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("admin.photoInvalidType"));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("admin.photoTooLarge"));
      event.target.value = "";
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      let avatarUrl: string | null | undefined;

      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${editing.code}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("agent-avatars")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (uploadError) throw new Error(uploadError.message);
        avatarUrl = supabase.storage.from("agent-avatars").getPublicUrl(path).data.publicUrl;
      } else if (removePhoto) {
        avatarUrl = null;
      }

      await updateAgent({
        data: {
          code: editing.code,
          name: name.trim(),
          description: description.trim(),
          avatarColor: color,
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success(t("admin.agentSaved"));
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message || t(errorKey(error))),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { code: string; isActive: boolean }) => updateAgent({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.agentToggled"));
      refresh();
    },
    onError: (error: Error) => toast.error(t(errorKey(error))),
  });

  const shownPhoto = removePhoto ? null : (previewUrl ?? editing?.avatar_url ?? null);
  const canSave = name.trim().length > 0 && HEX.test(color) && !saveMutation.isPending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("admin.agentsNote")}</p>

      {agentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.agentsEmpty")}</p>
      ) : (
        groups.map(([division, agents]) => (
          <Card key={division}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{division}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.code}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <AgentAvatar
                    name={agent.name}
                    avatarUrl={agent.avatar_url}
                    status={agent.is_active ? "online" : "offline"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {agent.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {agent.code} · {agent.role}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={agent.is_active}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ code: agent.code, isActive: checked })
                      }
                      aria-label={t("admin.agentActive")}
                    />
                    {agent.is_active ? t("admin.agentActive") : t("admin.agentInactive")}
                  </label>
                  <Button variant="outline" size="sm" onClick={() => openEdit(agent)}>
                    {t("admin.edit")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.agentEditTitle")}</DialogTitle>
            <DialogDescription>
              {editing?.code} · {editing?.division}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <AgentAvatar
                name={name || editing?.name || "?"}
                color={HEX.test(color) ? color : "#006837"}
                avatarUrl={shownPhoto}
                size="lg"
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("admin.photoChange")}
                  </Button>
                  {shownPhoto ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPendingFile(null);
                        setPreviewUrl(null);
                        setRemovePhoto(true);
                      }}
                    >
                      {t("admin.photoRemove")}
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickFile}
                />
                <p className="text-xs text-muted-foreground">{t("admin.photoHint")}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-name">{t("admin.agentName")}</Label>
              <Input
                id="agent-name"
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">{t("admin.agentDescription")}</Label>
              <Textarea
                id="agent-description"
                rows={3}
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-color">{t("admin.agentColor")}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={t("admin.agentColor")}
                  value={HEX.test(color) ? color : "#006837"}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  id="agent-color"
                  value={color}
                  maxLength={7}
                  onChange={(event) => setColor(event.target.value)}
                  className="w-32 font-mono"
                />
                {!HEX.test(color) ? (
                  <span className="text-xs text-destructive">{t("admin.colorInvalid")}</span>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="brand" disabled={!canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? t("admin.saving") : t("admin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
