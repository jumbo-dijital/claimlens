import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestAuditContext } from "@/lib/audit-context.server";
import { insertAuditLog } from "@/lib/audit-log.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const DAMAGE_TYPES = ["scratch", "dent", "crack", "broken", "missing", "structural", "other"] as const;
const SEVERITIES = ["minor", "moderate", "severe"] as const;

const DamageSchema = z.object({
  overall_confidence: z.number().min(0).max(1),
  summary: z.string(),
  findings: z
    .array(
      z.object({
        damage_type: z.enum(DAMAGE_TYPES),
        location: z.string(),
        severity: z.enum(SEVERITIES),
        suggested_repair: z.string(),
        confidence: z.number().min(0).max(1),
        rationale: z.string(),
      }),
    )
    .min(0)
    .max(20),
  image_quality_issues: z.array(z.string()).default([]),
});

type DamageOutput = z.infer<typeof DamageSchema>;

function clampConfidence(value: unknown, fallback = 0.65) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeDamageType(value: unknown): DamageOutput["findings"][number]["damage_type"] {
  const lower = String(value ?? "").toLowerCase();
  if (DAMAGE_TYPES.includes(lower as (typeof DAMAGE_TYPES)[number])) return lower as (typeof DAMAGE_TYPES)[number];
  if (/scuff|scrape|paint|abrasion/.test(lower)) return "scratch";
  if (/dent|ding|deform|crease/.test(lower)) return "dent";
  if (/crack|fracture|split/.test(lower)) return "crack";
  if (/break|broken|shatter/.test(lower)) return "broken";
  if (/missing|detached|absent/.test(lower)) return "missing";
  if (/structural|frame|chassis|alignment/.test(lower)) return "structural";
  return "other";
}

function normalizeSeverity(value: unknown): DamageOutput["findings"][number]["severity"] {
  const lower = String(value ?? "").toLowerCase();
  if (lower.includes("severe") || lower.includes("major") || lower.includes("heavy") || lower.includes("high")) return "severe";
  if (lower.includes("minor") || lower.includes("light") || lower.includes("low") || lower.includes("small")) return "minor";
  return "moderate";
}

function extractJsonFromResponse(response: string): unknown {
  const cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in AI response");

  const json = cleaned
    .slice(start, end + 1)
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return JSON.parse(json);
}

function normalizeAiOutput(raw: unknown): DamageOutput {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawFindings = Array.isArray(input.findings) ? input.findings : [];
  const findings = rawFindings
    .filter((finding): finding is Record<string, unknown> => !!finding && typeof finding === "object")
    .slice(0, 20)
    .map((finding) => ({
      damage_type: normalizeDamageType(finding.damage_type),
      location: String(finding.location || "visible exterior panel"),
      severity: normalizeSeverity(finding.severity),
      suggested_repair: String(finding.suggested_repair || "Inspect and repair affected exterior panel"),
      confidence: clampConfidence(finding.confidence),
      rationale: String(finding.rationale || "Visible damage identified in the supplied photographs."),
    }));

  return DamageSchema.parse({
    overall_confidence: clampConfidence(input.overall_confidence, findings.length ? 0.7 : 0.4),
    summary: String(input.summary || (findings.length ? "Damage identified from supplied photographs." : "No clear vehicle damage identified from supplied photographs.")),
    findings,
    image_quality_issues: Array.isArray(input.image_quality_issues) ? input.image_quality_issues.map(String) : [],
  });
}

import { requireRole } from "@/lib/auth-roles.server";

export const analyzeClaim = createServerFn({ method: "POST" })
  .middleware([requireRole("agent", "adjuster", "superadmin")])
  .inputValidator((input: unknown) =>
    z.object({ claimId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
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

    

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const sys = `You are an experienced auto-damage assessor for an insurance company. Analyze the supplied photographs of a ${claim.vehicle_year} ${claim.vehicle_make} ${claim.vehicle_model}. For each clearly visible damage, output one finding with damage_type, body-panel location (e.g. "front bumper - left"), severity, a suggested_repair description that matches common auto-body line items (e.g. "Front bumper cover", "Headlight assembly (L)", "Dent repair (PDR medium)", "Paint correction (panel)"), a confidence in [0,1] and a brief rationale. Flag any image-quality issues (blur, glare, poor angle). Be conservative — do not invent damage that is not visible.`;

    let aiOutput: z.infer<typeof DamageSchema>;
    try {
      const { text } = await generateText({
        model,
        messages: [
          {
            role: "system",
            content: `${sys}\n\nRespond with ONLY a JSON object. Use this exact shape: {"overall_confidence":0.0,"summary":"string","findings":[{"damage_type":"scratch|dent|crack|broken|missing|structural|other","location":"string","severity":"minor|moderate|severe","suggested_repair":"string","confidence":0.0,"rationale":"string"}],"image_quality_issues":["string"]}.`,
          },
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
      aiOutput = normalizeAiOutput(extractJsonFromResponse(text));
    } catch (err) {
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

    await insertAuditLog({
      claim_id: data.claimId,
      actor_user_id: context.userId,
      actor_role: "system",
      action: "ai_analysis_completed",
      details: {
        assessment_id: assessment.id,
        version: nextVersion,
        findings_count: aiOutput.findings.length,
        overall_confidence: aiOutput.overall_confidence,
        image_quality_issues: aiOutput.image_quality_issues,
      } as never,
      ...getRequestAuditContext(),
    });

    return { assessmentId: assessment.id, findings: aiOutput.findings.length };
  });
