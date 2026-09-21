import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgentCard = {
  code: string;
  name: string;
  role: string;
  division: string;
  avatar_color: string;
  avatar_url: string | null;
  description: string;
};

/** Agents the signed-in user is actually allowed to use (deny-by-default). */
export const listMyAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentCard[]> => {
    const { data: agents, error } = await context.supabase
      .from("agents")
      .select("code, name, role, division, avatar_color, avatar_url, description")
      .eq("is_active", true)
      .order("code");
    if (error) throw new Error(error.message);

    const checks = await Promise.all(
      (agents ?? []).map(async (agent) => {
        const { data: allowed } = await context.supabase.rpc("can_use_agent", {
          _user_id: context.userId,
          _agent_code: agent.code,
        });
        return allowed === true ? agent : null;
      }),
    );

    return checks.filter((a): a is AgentCard => a !== null);
  });

export type AgentCatalogItem = AgentCard & { is_active: boolean; allowed: boolean };

/** Full agent catalogue with the current user's permission flag (for request/filter UIs). */
export const listAllAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentCatalogItem[]> => {
    const { data: agents, error } = await context.supabase
      .from("agents")
      .select("code, name, role, division, avatar_color, avatar_url, description, is_active")
      .order("code");
    if (error) throw new Error(error.message);

    return await Promise.all(
      (agents ?? []).map(async (agent) => {
        const { data: allowed } = await context.supabase.rpc("can_use_agent", {
          _user_id: context.userId,
          _agent_code: agent.code,
        });
        return { ...agent, allowed: allowed === true };
      }),
    );
  });

/** Agent profile + whether the current user may use it. */
export const getAgentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { data: agent } = await context.supabase
      .from("agents")
      .select("code, name, role, division, avatar_color, avatar_url, description, is_active")
      .eq("code", code)
      .maybeSingle();

    if (!agent) return { agent: null, allowed: false } as const;

    const { data: allowed } = await context.supabase.rpc("can_use_agent", {
      _user_id: context.userId,
      _agent_code: code,
    });

    return { agent, allowed: allowed === true } as const;
  });
