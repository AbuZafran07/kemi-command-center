import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAuth } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/profile.functions";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function ProfileSettingsCard() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const submit = useServerFn(updateMyProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const displayAvatar = previewUrl ?? profile?.avatar_url ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      let avatarUrl: string | undefined;

      if (pendingFile && user) {
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("user-avatars")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (uploadError) throw new Error(uploadError.message);
        // Private bucket: the avatar is served through a long-lived signed URL.
        const { data: signed, error: signError } = await supabase.storage
          .from("user-avatars")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "SIGN_FAILED");
        avatarUrl = signed.signedUrl;
      }

      await submit({ data: { fullName: fullName.trim(), ...(avatarUrl ? { avatarUrl } : {}) } });
    },
    onSuccess: async () => {
      toast.success(t("profile.saved"));
      setPendingFile(null);
      setPreviewUrl(null);
      await refreshProfile();
    },
    onError: (error: Error) => {
      toast.error(error.message || t("profile.saveFailed"));
    },
  });

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("profile.invalidType"));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("profile.tooLarge"));
      event.target.value = "";
      return;
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const canSave = fullName.trim().length > 0 && !mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("profile.title")}</CardTitle>
        <CardDescription>{t("profile.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={fullName || profile?.full_name || "?"}
            avatarUrl={displayAvatar}
            size="lg"
          />
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("profile.changePhoto")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-full-name">{t("profile.fullName")}</Label>
          <Input
            id="profile-full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={200}
          />
        </div>

        <Button variant="brand" disabled={!canSave} onClick={() => mutation.mutate()}>
          {mutation.isPending ? t("profile.saving") : t("profile.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
