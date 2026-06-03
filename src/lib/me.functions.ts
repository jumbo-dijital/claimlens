import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchUserRoles } = await import("@/lib/auth-roles.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [roles, { data: profile }] = await Promise.all([
      fetchUserRoles(context.userId),
      supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    return {
      userId: context.userId,
      email: (context.claims.email as string | undefined) ?? null,
      roles,
      profile: profile ?? null,
    };
  });
