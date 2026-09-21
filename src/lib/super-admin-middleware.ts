import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side gate for every admin server function. Deny-by-default: anything
 * other than an explicit `true` from has_role() is rejected, and the attempt is
 * written to audit_log.
 */
export const requireSuperAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });

    if (isSuperAdmin !== true) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_log").insert({
        user_id: context.userId,
        agent_code: null,
        action: "admin_access_denied",
        detail: {},
        data_scope: "admin",
      });
      throw new Error("FORBIDDEN_SUPER_ADMIN");
    }

    return next();
  });
