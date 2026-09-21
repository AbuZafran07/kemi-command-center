import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UserLabel = { name: string; email: string };

/**
 * Resolve display name + email for user ids (server-only: emails live in auth.users).
 * Falls back to the email when the profile has no name, so lists never show blanks.
 */
export async function resolveUsers(userIds: string[]): Promise<Record<string, UserLabel>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  const names = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));

  const entries = await Promise.all(
    unique.map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      const email = data.user?.email ?? "";
      const name = (names.get(id) ?? "").trim() || email || "—";
      return [id, { name, email }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
