import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRoleName = "CEO" | "Director" | "Manager" | "Supervisor" | "Staff";

export type ActionDraftStatus =
  "pending_approval" | "approved" | "rejected" | "executed" | "execution_failed" | "cancelled";

/** A fully JSON-serializable value, matching how payload/execution_result are stored (jsonb). */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

export type SensitiveActionDef = {
  code: string;
  name: string;
  description: string;
  approver_role: AppRoleName;
};

export type ActionDraftRow = {
  id: string;
  action_code: string;
  action_name: string;
  title: string;
  payload: JsonRecord;
  status: ActionDraftStatus;
  approver_role: AppRoleName;
  agent_code: string | null;
  requested_by: string;
  requester_name: string;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
  execution_result: JsonRecord | null;
};

/** Explicit, curated payload shape per sensitive action. Never inferred from a model. */
const DRAFT_PAYLOAD_SCHEMAS = {
  DISCIPLINARY_LETTER_DRAFT: z.object({
    employee_no: z.string().min(1).max(50),
    letter_type: z.enum(["SP1", "SP2", "SP3"]),
    reason: z.string().min(5).max(1000),
  }),
  MASTER_DATA_CHANGE: z.object({
    employee_no: z.string().min(1).max(50),
    field: z.enum(["division", "position", "status"]),
    new_value: z.string().min(1).max(200),
  }),
  PO_APPROVAL: z.object({
    po_no: z.string().min(1).max(50),
  }),
} as const satisfies Record<string, z.ZodTypeAny>;

type ActionCode = keyof typeof DRAFT_PAYLOAD_SCHEMAS;

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

function toRow(
  row: {
    id: string;
    action_code: string;
    title: string;
    payload: unknown;
    status: string;
    approver_role: string;
    agent_code: string | null;
    requested_by: string;
    created_at: string;
    decided_at: string | null;
    executed_at: string | null;
    execution_result: unknown;
    sensitive_actions?: { name: string } | null;
  },
  names: Record<string, string>,
): ActionDraftRow {
  return {
    id: row.id,
    action_code: row.action_code,
    action_name: row.sensitive_actions?.name ?? row.action_code,
    title: row.title,
    payload: (row.payload ?? {}) as JsonRecord,
    status: row.status as ActionDraftStatus,
    approver_role: row.approver_role as AppRoleName,
    agent_code: row.agent_code,
    requested_by: row.requested_by,
    requester_name: names[row.requested_by] ?? "—",
    created_at: row.created_at,
    decided_at: row.decided_at,
    executed_at: row.executed_at,
    execution_result: (row.execution_result ?? null) as JsonRecord | null,
  };
}

const DRAFT_SELECT =
  "id, action_code, title, payload, status, approver_role, agent_code, requested_by, created_at, decided_at, executed_at, execution_result, sensitive_actions(name)";

/** Active registry of sensitive actions (for the "create draft" form). */
export const listSensitiveActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SensitiveActionDef[]> => {
    const { data, error } = await context.supabase
      .from("sensitive_actions")
      .select("code, name, description, approver_role")
      .eq("is_active", true)
      .order("code");
    if (error) throw new Error(error.message);
    return (data ?? []) as SensitiveActionDef[];
  });

/**
 * Create a DRAFT for a sensitive write action. This never executes anything by
 * itself: it only records intent, pending a human decision from the right role.
 * The requester must already hold access to the agent they draft on behalf of
 * (deny-by-default), and the payload shape is fixed per action code.
 */
export const createActionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        actionCode: z.string().min(1),
        agentCode: z.string().min(1),
        title: z.string().min(3).max(200),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actionCode = data.actionCode.toUpperCase() as ActionCode;
    const agentCode = data.agentCode.toUpperCase();

    const schema = DRAFT_PAYLOAD_SCHEMAS[actionCode];
    if (!schema) throw new Error("UNKNOWN_ACTION_CODE");
    const parsedPayload = schema.safeParse(data.payload);
    if (!parsedPayload.success) throw new Error("INVALID_PAYLOAD");

    const { data: registryRow } = await context.supabase
      .from("sensitive_actions")
      .select("code, approver_role, is_active")
      .eq("code", actionCode)
      .maybeSingle();
    if (!registryRow || !registryRow.is_active) throw new Error("UNKNOWN_ACTION_CODE");

    // deny-by-default: the requester may only draft on behalf of an agent they can use
    const { data: allowed } = await context.supabase.rpc("can_use_agent", {
      _user_id: context.userId,
      _agent_code: agentCode,
    });
    if (allowed !== true) throw new Error("FORBIDDEN_AGENT");

    const { data: inserted, error } = await context.supabase
      .from("action_drafts")
      .insert({
        action_code: actionCode,
        requested_by: context.userId,
        agent_code: agentCode,
        title: data.title,
        payload: parsedPayload.data as never,
        status: "pending_approval",
        approver_role: registryRow.approver_role,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      userId: context.userId,
      agentCode,
      action: "action_draft_created",
      detail: { draft_id: inserted.id, action_code: actionCode },
      dataScope: "governance",
    });

    return { ok: true, id: inserted.id } as const;
  });

/** Drafts requested by the signed-in user. */
export const listMyActionDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActionDraftRow[]> => {
    const { data, error } = await context.supabase
      .from("action_drafts")
      .select(DRAFT_SELECT)
      .eq("requested_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const names = await namesFor(rows.map((row) => row.requested_by));
    return rows.map((row) => toRow(row, names));
  });

/** Drafts pending this approver's decision (RLS already excludes their own). */
export const listPendingActionApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActionDraftRow[]> => {
    const { data, error } = await context.supabase
      .from("action_drafts")
      .select(DRAFT_SELECT)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const names = await namesFor(rows.map((row) => row.requested_by));
    return rows.map((row) => toRow(row, names));
  });

/** Approved drafts visible to this approver, ready for controlled execution. */
export const listExecutableActionDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActionDraftRow[]> => {
    const { data, error } = await context.supabase
      .from("action_drafts")
      .select(DRAFT_SELECT)
      .eq("status", "approved")
      .order("decided_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const names = await namesFor(rows.map((row) => row.requested_by));
    return rows.map((row) => toRow(row, names));
  });

/** Approve or reject a draft. Humans only; the requester can never decide their own draft. */
export const decideActionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draftId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS enforces: pending only, right approver role, never the requester themselves.
    const { data: updated, error } = await context.supabase
      .from("action_drafts")
      .update({
        status: data.decision,
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("id", data.draftId)
      .eq("status", "pending_approval")
      .select("id, action_code, agent_code, requested_by")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("NOT_DECIDABLE");

    const { error: approvalError } = await context.supabase.from("action_approvals").insert({
      action_draft_id: updated.id,
      approver_id: context.userId,
      decision: data.decision,
      note: data.note,
    });
    if (approvalError) throw new Error(approvalError.message);

    await writeAudit({
      userId: context.userId,
      agentCode: updated.agent_code,
      action: data.decision === "approved" ? "action_draft_approved" : "action_draft_rejected",
      detail: {
        draft_id: updated.id,
        action_code: updated.action_code,
        requester_id: updated.requested_by,
        note: data.note,
      },
      dataScope: "governance",
    });

    return { ok: true } as const;
  });

type ExecutionOutcome = { ok: boolean; detail: JsonRecord };

/**
 * Action-specific mutation, run only after a draft reached status='approved'.
 * Each branch is explicit and narrowly scoped -- there is no generic "run this
 * payload" path. Real integrations replace these demo mutations later.
 */
async function runApprovedAction(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  draft: { id: string; action_code: string; payload: JsonRecord },
  executedBy: string,
): Promise<ExecutionOutcome> {
  switch (draft.action_code) {
    case "PO_APPROVAL": {
      const poNo = String(draft.payload["po_no"] ?? "");
      const { data: updated, error } = await admin
        .from("demo_purchase_orders")
        .update({ status: "approved" })
        .eq("po_no", poNo)
        .eq("status", "outstanding")
        .select("po_no")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) return { ok: false, detail: { reason: "po_not_outstanding", po_no: poNo } };
      return { ok: true, detail: { po_no: poNo, new_status: "approved" } };
    }
    case "DISCIPLINARY_LETTER_DRAFT": {
      const employeeNo = String(draft.payload["employee_no"] ?? "");
      const letterType = String(draft.payload["letter_type"] ?? "");
      const reason = String(draft.payload["reason"] ?? "");
      const { error } = await admin.from("disciplinary_letters").insert({
        action_draft_id: draft.id,
        employee_no: employeeNo,
        letter_type: letterType,
        reason,
        issued_by: executedBy,
      });
      if (error) throw new Error(error.message);
      return { ok: true, detail: { employee_no: employeeNo, letter_type: letterType } };
    }
    case "MASTER_DATA_CHANGE": {
      const employeeNo = String(draft.payload["employee_no"] ?? "");
      const field = String(draft.payload["field"] ?? "");
      const newValue = String(draft.payload["new_value"] ?? "");
      if (!["division", "position", "status"].includes(field)) {
        return { ok: false, detail: { reason: "invalid_field", field } };
      }
      const { data: updated, error } = await admin
        .from("demo_employees")
        .update({ [field]: newValue } as never)
        .eq("employee_no", employeeNo)
        .select("employee_no")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) {
        return { ok: false, detail: { reason: "employee_not_found", employee_no: employeeNo } };
      }
      return { ok: true, detail: { employee_no: employeeNo, field, new_value: newValue } };
    }
    default:
      return { ok: false, detail: { reason: "unknown_action_code" } };
  }
}

/**
 * Controlled execution path. Only reachable once a draft is 'approved'. Re-checks
 * segregation of duties and the approver role independently of the earlier
 * decision step, then performs the bounded, action-specific mutation and logs it.
 */
export const executeActionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ draftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();

    const { data: draft, error } = await admin
      .from("action_drafts")
      .select("id, action_code, agent_code, payload, status, approver_role, requested_by")
      .eq("id", data.draftId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!draft) throw new Error("NOT_FOUND");
    if (draft.status !== "approved") throw new Error("NOT_EXECUTABLE");
    if (draft.requested_by === context.userId) throw new Error("SEGREGATION_OF_DUTIES");

    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = new Set((roleRows ?? []).map((row) => row.role));
    if (!roles.has("CEO") && !roles.has(draft.approver_role)) throw new Error("FORBIDDEN");

    let outcome: ExecutionOutcome;
    try {
      outcome = await runApprovedAction(
        admin,
        {
          id: draft.id,
          action_code: draft.action_code,
          payload: (draft.payload ?? {}) as JsonRecord,
        },
        context.userId,
      );
    } catch (err) {
      outcome = {
        ok: false,
        detail: { error: err instanceof Error ? err.message : "unknown_error" },
      };
    }

    await admin
      .from("action_drafts")
      .update({
        status: outcome.ok ? "executed" : "execution_failed",
        executed_at: new Date().toISOString(),
        executed_by: context.userId,
        execution_result: outcome.detail as never,
      })
      .eq("id", draft.id);

    await writeAudit({
      userId: context.userId,
      agentCode: draft.agent_code,
      action: outcome.ok ? "sensitive_action_executed" : "sensitive_action_execution_failed",
      detail: { draft_id: draft.id, action_code: draft.action_code, ...outcome.detail },
      dataScope: "governance",
    });

    if (!outcome.ok) throw new Error("EXECUTION_FAILED");
    return { ok: true, detail: outcome.detail } as const;
  });
