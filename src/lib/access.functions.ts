import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRoleName = "CEO" | "Director" | "Manager" | "Supervisor" | "Staff";

export type AccessRequestRow = {
  id: string;
  agent_code: string;
  agent_name: string;
  purpose: string;
  status: string;
  approver_role: AppRoleName;
  created_at: string;
  decided_at: string | null;
  requester_id: string;
  requester_name: string;
};

export type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  agent_code: string | null;
  data_scope: string;
  user_id: string | null;
  user_name: string;
  detail: unknown;
};

/** Hierarchy routing: who must approve a request coming from this role. */
function approverRoleFor(role: string | null | undefined): AppRoleName {
  if (role === "Manager") return "Director";
  if (role === "Director" || role === "CEO") return "CEO";
  return "Manager";
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function namesFor(userIds: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {};
  const admin = await loadAdmin();
  const { data } = await admin.from("profiles").select("id, full_name").in("id", unique);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.id] = row.full_name || "—";
  return map;
}

async function writeAudit(input: {
  userId: string;
  agentCode: string | null;
  action: string;
  detail: Record<string, unknown>;
  dataScope: string;
}) {
  const admin = await loadAdmin();
  await admin.from("audit_log").insert({
    user_id: input.userId,
    agent_code: input.agentCode,
    action: input.action,
    detail: input.detail as never,
    data_scope: input.dataScope,
  });
}

/** Submit an access request for an agent the user may not use yet. */
export const requestAgentAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ agentCode: z.string().min(1), purpose: z.string().min(5).max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const agentCode = data.agentCode.toUpperCase();

    const { data: agent } = await context.supabase
      .from("agents")
      .select("code, is_active")
      .eq("code", agentCode)
      .maybeSingle();
    if (!agent) throw new Error("AGENT_NOT_FOUND");

    const { data: allowed } = await context.supabase.rpc("can_use_agent", {
      _user_id: context.userId,
      _agent_code: agentCode,
    });
    if (allowed === true) throw new Error("ALREADY_ALLOWED");

    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const approverRole = approverRoleFor(roleRows?.[0]?.role);

    const { error } = await context.supabase.from("access_requests").insert({
      user_id: context.userId,
      agent_code: agentCode,
      purpose: data.purpose,
      status: "pending",
      approver_role: approverRole,
    });
    if (error) {
      if (error.code === "23505") throw new Error("PENDING_EXISTS");
      throw new Error(error.message);
    }

    await writeAudit({
      userId: context.userId,
      agentCode,
      action: "access_request_created",
      detail: { purpose: data.purpose, approver_role: approverRole },
      dataScope: "governance",
    });

    return { ok: true, approverRole } as const;
  });

/** Requests submitted by the signed-in user. */
export const listMyAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessRequestRow[]> => {
    const { data, error } = await context.supabase
      .from("access_requests")
      .select("id, agent_code, purpose, status, approver_role, created_at, decided_at, user_id, agents(name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      agent_code: row.agent_code,
      agent_name: row.agents?.name ?? row.agent_code,
      purpose: row.purpose,
      status: row.status,
      approver_role: row.approver_role as AppRoleName,
      created_at: row.created_at,
      decided_at: row.decided_at,
      requester_id: row.user_id,
      requester_name: "",
    }));
  });

/** Pending requests this approver may decide (RLS already excludes their own). */
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessRequestRow[]> => {
    const { data, error } = await context.supabase
      .from("access_requests")
      .select("id, agent_code, purpose, status, approver_role, created_at, decided_at, user_id, agents(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const names = await namesFor(rows.map((row) => row.user_id));

    return rows.map((row) => ({
      id: row.id,
      agent_code: row.agent_code,
      agent_name: row.agents?.name ?? row.agent_code,
      purpose: row.purpose,
      status: row.status,
      approver_role: row.approver_role as AppRoleName,
      created_at: row.created_at,
      decided_at: row.decided_at,
      requester_id: row.user_id,
      requester_name: names[row.user_id] ?? "—",
    }));
  });

/** Approve or reject. Humans only; the requester can never decide their own request. */
export const decideAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS enforces: pending only, right approver role, never the requester themselves.
    const { data: updated, error } = await context.supabase
      .from("access_requests")
      .update({ status: data.decision, decided_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("status", "pending")
      .select("id, user_id, agent_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("NOT_DECIDABLE");

    const { error: approvalError } = await context.supabase.from("approvals").insert({
      access_request_id: updated.id,
      approver_id: context.userId,
      decision: data.decision,
      note: data.note,
    });
    if (approvalError) throw new Error(approvalError.message);

    if (data.decision === "approved") {
      const admin = await loadAdmin();
      const { error: grantError } = await admin.from("agent_user_grants").upsert(
        {
          user_id: updated.user_id,
          agent_code: updated.agent_code,
          granted_by: context.userId,
          access_request_id: updated.id,
          revoked_at: null,
        },
        { onConflict: "user_id,agent_code" },
      );
      if (grantError) throw new Error(grantError.message);
    }

    await writeAudit({
      userId: context.userId,
      agentCode: updated.agent_code,
      action: data.decision === "approved" ? "access_request_approved" : "access_request_rejected",
      detail: { request_id: updated.id, requester_id: updated.user_id, note: data.note },
      dataScope: "governance",
    });

    return { ok: true } as const;
  });

/** Read-only audit trail. RLS: own entries, or everything for CEO/Director. */
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentCode: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditRow[]> => {
    let query = context.supabase
      .from("audit_log")
      .select("id, created_at, action, agent_code, data_scope, user_id, detail")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.agentCode) query = query.eq("agent_code", data.agentCode.toUpperCase());
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59Z`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const names = await namesFor((rows ?? []).map((row) => row.user_id ?? ""));

    return (rows ?? []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      agent_code: row.agent_code,
      data_scope: row.data_scope,
      user_id: row.user_id,
      user_name: row.user_id ? (names[row.user_id] ?? "—") : "—",
      detail: row.detail,
    }));
  });
