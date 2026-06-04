import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireRole } from "@/lib/auth-roles.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const DraftSchema = z.object({
  policyholder_name: z.string(),
  vehicle_make: z.string(),
  vehicle_model: z.string(),
  vehicle_year: z.number(),
  vehicle_class: z.enum(["standard", "premium"]),
  paint_color: z.string(),
  scene: z.string(),
  impact_area: z.string(),
  damage_severity: z.enum(["minor", "moderate", "severe"]),
  incident_description: z.string(),
});

export const generateSyntheticClaimDetails = createServerFn({ method: "POST" })
  .middleware([requireRole("superadmin")])
  .handler(async () => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const sys = `You fabricate realistic but entirely fictional auto-insurance claim records for a QA/demo environment. Invent a plausible policyholder name, a realistic mainstream vehicle (make/model/year between 1998 and 2025), a paint color (specific tone, e.g. "metallic graphite grey"), a scene/setting describing the location and lighting where the photos would have been taken, an impact area (one of: "front bumper and grille", "rear bumper and trunk lid", "driver side doors and quarter panel", "passenger side doors and quarter panel"), a damage severity (minor/moderate/severe), and a brief 1-3 sentence incident_description from the policyholder's perspective. Vehicle class is "premium" for luxury brands (BMW, Audi, Mercedes, Lexus, Tesla, Porsche, Volvo), otherwise "standard". Vary the outputs — do not repeat the same vehicle, color or scenario across calls.`;

    try {
      const { text } = await generateText({
        model,
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content:
              'Fabricate one fresh synthetic claim record. Respond with ONLY a JSON object (no markdown, no commentary) with exactly these keys: policyholder_name (string), vehicle_make (string), vehicle_model (string), vehicle_year (number), vehicle_class ("standard"|"premium"), paint_color (string), scene (string), impact_area (string), damage_severity ("minor"|"moderate"|"severe"), incident_description (string).',
          },
        ],
      });

      const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object in response");
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return DraftSchema.parse(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("AI rate limit reached. Please wait and try again.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`Claim generation failed: ${msg}`);
    }
  });
