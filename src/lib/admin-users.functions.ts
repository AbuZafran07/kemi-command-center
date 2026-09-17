import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["CEO", "Director", "Manager", "Supervisor", "Staff"]);

const newUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  division: z.string().default(""),
  role: roleSchema,
});

/** CEO-only: create an account with a given role (also used for test users). */
export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isCeo, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "CEO",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isCeo) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        division: data.division,
        role: data.role,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
