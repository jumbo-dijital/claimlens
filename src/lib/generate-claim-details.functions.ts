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

const STANDARD_MAKES = [
  "Toyota", "Honda", "Ford", "Chevrolet", "Hyundai", "Kia", "Nissan", "Mazda",
  "Subaru", "Volkswagen", "Skoda", "Seat", "Renault", "Peugeot", "Citroen",
  "Fiat", "Opel", "Vauxhall", "Dacia", "Mitsubishi", "Suzuki", "Jeep", "Ram",
  "GMC", "Chrysler", "Dodge", "Holden",
];
const PREMIUM_MAKES = [
  "BMW", "Audi", "Mercedes-Benz", "Lexus", "Tesla", "Porsche", "Volvo",
  "Jaguar", "Land Rover", "Genesis", "Acura", "Infiniti", "Alfa Romeo",
  "Cadillac", "Lincoln", "Maserati",
];
const BODY_STYLES = ["sedan", "hatchback", "estate/wagon", "SUV", "crossover", "pickup truck", "coupe", "MPV/minivan"];
const COLOR_FAMILIES = [
  "a metallic silver", "a pearl white", "a deep navy blue", "a gunmetal grey",
  "a matte black", "a candy red", "a forest green", "a champagne beige",
  "a bronze/copper", "a sky blue", "a burgundy", "a sunburst yellow",
  "a graphite grey", "an arctic white", "an orange",
];
const SCENES = [
  "a suburban supermarket car park at midday",
  "a multi-storey city car park, level 3, fluorescent lighting",
  "a rural petrol station forecourt at dusk",
  "a residential driveway on an overcast morning",
  "a downtown parallel-parking spot in afternoon sun",
  "an apartment block underground garage",
  "a motorway service station car park at night under sodium lights",
  "a school drop-off zone in the rain",
  "a hardware store loading bay in bright sunlight",
  "an industrial estate side road, golden hour",
];
const IMPACT_AREAS = [
  "front bumper and grille",
  "rear bumper and trunk lid",
  "left side doors and quarter panel",
  "right side doors and quarter panel",
];
const SEVERITIES = ["minor", "moderate", "severe"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const generateSyntheticClaimDetails = createServerFn({ method: "POST" })
  .middleware([requireRole("superadmin")])
  .handler(async () => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const isPremium = Math.random() < 0.35;
    const make = pick(isPremium ? PREMIUM_MAKES : STANDARD_MAKES);
    const bodyStyle = pick(BODY_STYLES);
    const year = 1998 + Math.floor(Math.random() * 28);
    const colorFamily = pick(COLOR_FAMILIES);
    const scene = pick(SCENES);
    const impact_area = pick(IMPACT_AREAS);
    const damage_severity = pick(SEVERITIES);

    const sys = `You fabricate realistic but entirely fictional auto-insurance claim records for a QA/demo environment. Never use the terms "driver side" or "passenger side" — always describe sides as left or right from the perspective of an occupant sitting inside the vehicle facing forward (the automotive convention).`;

    const userPrompt = `Fabricate ONE synthetic claim record using these PRE-SELECTED randomized parameters. Do not substitute different values for these — use them exactly:
- vehicle_make: "${make}"
- body style: ${bodyStyle} (pick a real ${make} ${bodyStyle} model from the year ${year}; if ${make} did not sell a ${bodyStyle} in ${year}, pick their closest real model that year)
- vehicle_year: ${year}
- vehicle_class: "${isPremium ? "premium" : "standard"}"
- paint_color: a specific tone in the ${colorFamily} family (e.g. "Eminent White Pearl", "Mythos Black Metallic" — invent a realistic specific name)
- scene: ${scene} (expand into a short sentence with lighting/weather detail)
- impact_area: "${impact_area}"
- damage_severity: "${damage_severity}"

Then invent: a plausible policyholder_name, and a brief 1-3 sentence incident_description from the policyholder's perspective consistent with the impact_area and severity above.

Respond with ONLY a JSON object (no markdown, no commentary) with exactly these keys: policyholder_name (string), vehicle_make (string), vehicle_model (string), vehicle_year (number), vehicle_class ("standard"|"premium"), paint_color (string), scene (string), impact_area (string), damage_severity ("minor"|"moderate"|"severe"), incident_description (string).`;

    try {
      const { text } = await generateText({
        model,
        temperature: 1.0,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
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
