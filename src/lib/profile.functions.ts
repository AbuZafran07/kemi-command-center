import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateMyProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  avatarUrl: z.string().url().max(2000).optional(),
});

/**
 * Update the signed-in user's own name/avatar. RLS ("profiles_update_own")
 * already limits the row to the caller, and .eq("id", context.userId) below
 * matches that -- there is no code path here that can touch another profile.
 */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMyProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: before } = await context.supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const patch: { full_name: string; avatar_url?: string } = { full_name: data.fullName };
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;

    const { error } = await context.supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      agent_code: null,
      action: "profile_updated",
      detail: {
        before: { full_name: before?.full_name ?? "", avatar_url: before?.avatar_url ?? null },
        after: patch,
      } as never,
      data_scope: "profile",
    });

    return { ok: true } as const;
  });
