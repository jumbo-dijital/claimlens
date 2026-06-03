import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-damage-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt, model } = (await request.json()) as {
          prompt: string;
          model?: string;
        };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const chosen = model || "google/gemini-3.1-flash-image-preview";

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: chosen,
            messages: [{ role: "user", content: prompt }],
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
