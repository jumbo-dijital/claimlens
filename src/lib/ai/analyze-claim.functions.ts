import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const DamageSchema = z.object({
  overall_confidence: z.number().min(0).max(1),
  summary: z.string(),
  findings: z
    .array(
      z.object({
        damage_type: z.enum(["scratch", "dent", "crack", "broken", "missing", "structural", "other"]),
        location: z.string(),
        severity: z.enum(["minor", "moderate", "severe"]),
        suggested_repair: z.string(),
        confidence: z.number().min(0).max(1),
        rationale: z.string(),
      }),
    )
    .min(0)
    .max(20),
  image_quality_issues: z.array(z.string()).default([]),
});

export const analyzeClaim = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ claimId: z.string().uuid(), personaId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: claim, error: claimErr } = await supabaseAdmin
      .from("claims")
      .select("*")
      .eq("id", data.claimId)
      .single();
    if (claimErr || !claim) throw new Error("Claim not found");

    const { data: images } = await supabaseAdmin
      .from("claim_images")
      .select("*")
      .eq("claim_id", data.claimId);
    if (!images || images.length === 0) throw new Error("No images on this claim");

    await supabaseAdmin.from("claims").update({ status: "ai_processing" }).eq("id", data.claimId);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const sys = `You are an experienced auto-damage assessor for an insurance company. Analyze the supplied photographs of a ${claim.vehicle_year} ${claim.vehicle_make} ${claim.vehicle_model}. For each clearly visible damage, output one finding with damage_type, body-panel location (e.g. "front bumper - left"), severity, a suggested_repair description that matches common auto-body line items (e.g. "Front bumper cover", "Headlight assembly (L)", "Dent repair (PDR medium)", "Paint correction (panel)"), a confidence in [0,1] and a brief rationale. Flag any image-quality issues (blur, glare, poor angle). Be conservative — do not invent damage that is not visible.`;

    let aiOutput: z.infer<typeof DamageSchema>;
    try {
      const { experimental_output } = await generateText({
        model,
        experimental_output: Output.object({ schema: DamageSchema }),
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Incident description: ${claim.incident_description ?? "(not provided)"}. Analyze the following ${images.length} image(s).`,
              },
              ...images.map((img) => ({ type: "image" as const, image: img.url })),
            ],
          },
        ],
      });
      aiOutput = experimental_output;
    } catch (err) {
      await supabaseAdmin.from("claims").update({ status: "new" }).eq("id", data.claimId);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("AI rate limit reached. Please wait and try again.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Please add credits in Workspace settings.");
      throw new Error(`AI analysis failed: ${msg}`);
    }

    // Look up repair catalog
    const { data: catalog } = await supabaseAdmin.from("repair_catalog").select("*");
    const vehicleClass = claim.vehicle_class ?? "standard";
    const lookupCost = (suggestedRepair: string) => {
      if (!catalog) return { part: 0, hours: 1, rate: 95 };
      const lower = suggestedRepair.toLowerCase();
      const match =
        catalog.find(
          (c) =>
            c.vehicle_class === vehicleClass &&
            lower.includes(c.part_name.toLowerCase().slice(0, 12)),
        ) ??
        catalog.find((c) => lower.includes(c.part_name.toLowerCase().slice(0, 8))) ??
        catalog.find((c) => c.part_name === "Paint correction (panel)");
      if (!match) return { part: 0, hours: 1, rate: 95 };
      return { part: Number(match.base_part_cost), hours: Number(match.base_labour_hours), rate: Number(match.labour_rate) };
    };

    // Get next version
    const { data: existing } = await supabaseAdmin
      .from("ai_assessments")
      .select("version")
      .eq("claim_id", data.claimId)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    const { data: assessment, error: aErr } = await supabaseAdmin
      .from("ai_assessments")
      .insert({
        claim_id: data.claimId,
        version: nextVersion,
        summary: aiOutput.summary,
        overall_confidence: aiOutput.overall_confidence,
        raw_json: aiOutput as never,
        model: "google/gemini-3-flash-preview",
      })
      .select()
      .single();
    if (aErr || !assessment) throw new Error("Failed to save assessment");

    const lineItems = aiOutput.findings.map((f) => {
      const cost = lookupCost(f.suggested_repair);
      return {
        assessment_id: assessment.id,
        damage_type: f.damage_type,
        location: f.location,
        severity: f.severity,
        suggested_repair: f.suggested_repair,
        part_cost: cost.part,
        labour_hours: cost.hours,
        labour_cost: cost.hours * cost.rate,
        confidence: f.confidence,
        source: "ai" as const,
        rationale: f.rationale,
      };
    });

    if (lineItems.length > 0) {
      await supabaseAdmin.from("assessment_line_items").insert(lineItems);
    }

    await supabaseAdmin.from("claims").update({ status: "in_review" }).eq("id", data.claimId);

    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_persona_id: data.personaId,
      actor_role: "system",
      action: "ai_analysis_completed",
      details: {
        assessment_id: assessment.id,
        version: nextVersion,
        findings_count: aiOutput.findings.length,
        overall_confidence: aiOutput.overall_confidence,
        image_quality_issues: aiOutput.image_quality_issues,
      } as never,
    });

    return { assessmentId: assessment.id, findings: aiOutput.findings.length };
  });
