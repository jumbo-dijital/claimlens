import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
  );
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;

  const { fetchUserRoles } = await import("@/lib/auth-roles.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [roles, { data: profile }] = await Promise.all([
    fetchUserRoles(userId),
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  return {
    userId,
    email: (data.claims.email as string | undefined) ?? null,
    roles,
    profile: profile ?? null,
  };
});
