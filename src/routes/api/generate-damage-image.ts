import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
});

const ALLOWED_MODEL = "google/gemini-3.1-flash-image-preview";

export const Route = createFileRoute("/api/generate-damage-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: claims, error } = await sb.auth.getClaims(token);
        if (error || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        // 2. Authorize: superadmin only
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (!roles?.some((r) => r.role === "superadmin")) {
          return new Response("Forbidden", { status: 403 });
        }

        // 3. Validate input
        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ALLOWED_MODEL,
            messages: [{ role: "user", content: parsed.prompt }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
