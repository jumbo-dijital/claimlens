import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "agent" | "adjuster" | "superadmin";

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * Middleware factory. Throws if the authenticated user does not have any of the
 * supplied roles. Adds `roles` to context.
 */
export function requireRole(...allowed: AppRole[]) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const roles = await fetchUserRoles(context.userId);
      if (allowed.length > 0 && !roles.some((r) => allowed.includes(r))) {
        throw new Error(
          `Forbidden: requires one of [${allowed.join(", ")}], you have [${roles.join(", ")}]`,
        );
      }
      return next({ context: { roles } });
    });
}
