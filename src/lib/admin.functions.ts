import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSuperAdmin } from "@/lib/super-admin-middleware";

export const ORG_ROLES = ["CEO", "Director", "Manager", "Supervisor", "Staff"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  division: string;
  avatar_url: string | null;
  org_role: OrgRole | null;
  is_super_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

const orgRoleSchema = z.enum(ORG_ROLES);

/**
 * Writes below go through the caller's own client (context.supabase), so RLS
 * (super_admin only) and the DB triggers (last-super-admin guard, audit_log)
 * apply to them -- the service-role client is only used to read auth.users.
 */

/** Used by the Admin route guard. Not gated: it only reports the caller's own status. */
export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    return { isSuperAdmin: data === true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .handler(async (): Promise<AdminUserRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authUsers: {
      id: string;
      email: string;
      created_at: string;
      last_sign_in_at: string | null;
    }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const user of data.users) {
        authUsers.push({
          id: user.id,
          email: user.email ?? "",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
    }

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, division, avatar_url"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

    const rows = authUsers.map((user): AdminUserRow => {
      const userRoles = (roles ?? []).filter((row) => row.user_id === user.id).map((r) => r.role);
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name ?? "",
        division: profile?.division ?? "",
        avatar_url: profile?.avatar_url ?? null,
        org_role: (userRoles.find((role) => role !== "super_admin") as OrgRole | undefined) ?? null,
        is_super_admin: userRoles.includes("super_admin"),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      };
    });

    return rows.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
  });

export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().min(1).max(200),
        division: z.string().trim().max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName, division: data.division })
      .eq("id", data.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("NOT_FOUND");
    return { ok: true } as const;
  });

/** Replace a user's ORGANISATIONAL role (super_admin is untouched). */
export const adminSetUserOrgRole = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: orgRoleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("user_roles")
      .select("id, role")
      .eq("user_id", data.userId)
      .neq("role", "super_admin");
    if (error) throw new Error(error.message);

    const orgRows = rows ?? [];
    if (orgRows.length === 0) {
      const { error: insertError } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (insertError) throw new Error(insertError.message);
      return { ok: true } as const;
    }

    // Keep exactly one organisational row for the user.
    const keep = orgRows.find((row) => row.role === data.role) ?? orgRows[0]!;
    for (const extra of orgRows.filter((row) => row.id !== keep.id)) {
      const { error: deleteError } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("id", extra.id);
      if (deleteError) throw new Error(deleteError.message);
    }
    if (keep.role !== data.role) {
      const { error: updateError } = await context.supabase
        .from("user_roles")
        .update({ role: data.role })
        .eq("id", keep.id);
      if (updateError) throw new Error(updateError.message);
    }
    return { ok: true } as const;
  });

/**
 * Grant/revoke super_admin. The DB guard enforces "never the last super_admin" and
 * "never your own"; the self check here only gives a clearer error first.
 */
export const adminToggleSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), enable: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.enable) {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: "super_admin" });
      if (error && error.code !== "23505") throw new Error(error.message);
      return { ok: true } as const;
    }

    if (data.userId === context.userId) throw new Error("SUPER_ADMIN_SELF_REVOKE");

    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/** Create a new account with profile + organisational role. */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        password: z.string().min(8).max(200),
        fullName: z.string().trim().min(1).max(200),
        division: z.string().trim().max(100).default(""),
        role: orgRoleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        division: data.division,
        role: data.role,
      },
    });
    if (error) {
      if (/already/i.test(error.message)) throw new Error("EMAIL_EXISTS");
      throw new Error(error.message);
    }
    const newId = created.user?.id;
    if (!newId) throw new Error("CREATE_FAILED");

    // The signup trigger creates the profile/role rows; align them with the form.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newId, full_name: data.fullName, division: data.division });
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", newId)
      .neq("role", "super_admin");
    if (!existingRoles || existingRoles.length === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });
    } else {
      await supabaseAdmin.from("user_roles").update({ role: data.role }).eq("id", existingRoles[0]!.id);
      for (const extra of existingRoles.slice(1)) {
        await supabaseAdmin.from("user_roles").delete().eq("id", extra.id);
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      agent_code: null,
      action: "admin_user_created",
      detail: { target_user: newId, email: data.email, role: data.role },
      data_scope: "admin",
    });

    return { ok: true } as const;
  });

/** Permanently delete an account (never your own). */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("SELF_DELETE");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = target.user?.email ?? "";

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      agent_code: null,
      action: "admin_user_deleted",
      detail: { target_user: data.userId, email },
      data_scope: "admin",
    });

    return { ok: true } as const;
  });

export type AdminAgentRow = {
  code: string;
  name: string;
  role: string;
  division: string;
  description: string;
  avatar_color: string;
  avatar_url: string | null;
  is_active: boolean;
};

// agents_select_authenticated only shows inactive agents to CEO/Director; a
// super_admin whose org role is e.g. Staff must still see every agent here, so
// this reads through the service-role client (already gated by requireSuperAdmin).
export const adminListAgents = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .handler(async (): Promise<AdminAgentRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("code, name, role, division, description, avatar_color, avatar_url, is_active")
      .order("division")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Photos may only point at our own agent-avatars bucket (no arbitrary external images).
// Accepts both a public URL and a signed URL (the bucket is private, so uploads use
// createSignedUrl -- see admin.agents.tsx), since either form can legitimately occur.
const AGENT_PHOTO_PATH_RE = /\/storage\/v1\/object\/(public|sign)\/agent-avatars\//;

/**
 * Edit an agent. Only the fields provided are changed. The write goes through the
 * caller's own client, so RLS (super_admin only), the immutable-code guard and the
 * audit trigger all apply.
 */
export const adminUpdateAgent = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(20),
        name: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(500).optional(),
        avatarColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        avatarUrl: z
          .string()
          .url()
          .max(2000)
          .refine((url) => AGENT_PHOTO_PATH_RE.test(url))
          .nullable()
          .optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const patch: {
      name?: string;
      description?: string;
      avatar_color?: string;
      avatar_url?: string | null;
      is_active?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.avatarColor !== undefined) patch.avatar_color = data.avatarColor;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (Object.keys(patch).length === 0) throw new Error("NOTHING_TO_UPDATE");

    // Deactivating an agent makes it invisible under agents_select_authenticated to a
    // non-CEO/Director caller, so the post-update .select() below must bypass RLS too --
    // authorization was already verified by requireSuperAdmin, not by this row's policy.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("agents")
      .update(patch)
      .eq("code", data.code.toUpperCase())
      .select("code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("NOT_FOUND");
    return { ok: true } as const;
  });
