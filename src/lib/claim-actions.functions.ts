import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function genClaimNumber() {
  const n = Math.floor(Math.random() * 900000 + 100000);
  return `CL-${new Date().getFullYear()}-${n}`;
}

export const createSyntheticClaim = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        personaId: z.string().uuid().nullable(),
        policyholder_name: z.string().min(1),
        vehicle_make: z.string().min(1),
        vehicle_model: z.string().min(1),
        vehicle_year: z.number().int().min(1990).max(2030),
        vehicle_class: z.enum(["standard", "premium"]).default("standard"),
        incident_description: z.string().default(""),
        images: z
          .array(z.object({ url: z.string(), angle: z.string() }))
          .min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // pick an agent to assign
    const { data: agent } = await supabaseAdmin
      .from("personas")
      .select("id")
      .eq("role", "agent")
      .maybeSingle();

    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .insert({
        claim_number: genClaimNumber(),
        policyholder_name: data.policyholder_name,
        policy_number: `POL-${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: data.vehicle_year,
        vehicle_class: data.vehicle_class,
        incident_date: new Date().toISOString().slice(0, 10),
        incident_description: data.incident_description,
        status: "new",
        current_agent_id: agent?.id ?? null,
      })
      .select()
      .single();
    if (error || !claim) throw new Error(error?.message ?? "Failed to create claim");

    await supabaseAdmin.from("claim_images").insert(
      data.images.map((img) => ({
        claim_id: claim.id,
        url: img.url,
        angle: img.angle,
        ai_generated: true,
      })),
    );

    await supabaseAdmin.from("audit_log").insert({
      claim_id: claim.id,
      actor_persona_id: data.personaId,
      actor_role: "superadmin",
      action: "claim_created_synthetic",
      details: { image_count: data.images.length } as never,
    });

    return { claimId: claim.id };
  });

export const editLineItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        personaId: z.string().uuid().nullable(),
        lineItemId: z.string().uuid(),
        patch: z.object({
          suggested_repair: z.string().optional(),
          part_cost: z.number().optional(),
          labour_hours: z.number().optional(),
          labour_cost: z.number().optional(),
          severity: z.string().optional(),
          is_deleted: z.boolean().optional(),
        }),
        rationale: z.string().min(3),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { data: before } = await supabaseAdmin
      .from("assessment_line_items")
      .select("*, ai_assessments(claim_id)")
      .eq("id", data.lineItemId)
      .single();
    const { error } = await supabaseAdmin
      .from("assessment_line_items")
      .update({
        ...data.patch,
        source: "agent",
        edited_by: data.personaId,
        rationale: data.rationale,
      })
      .eq("id", data.lineItemId);
    if (error) throw new Error(error.message);

    const claimId = (before as { ai_assessments?: { claim_id?: string } } | null)?.ai_assessments
      ?.claim_id;
    if (claimId) {
      await supabaseAdmin.from("audit_log").insert({
        claim_id: claimId,
        actor_persona_id: data.personaId,
        actor_role: "agent",
        action: data.patch.is_deleted ? "line_item_removed" : "line_item_edited",
        details: { line_item_id: data.lineItemId, patch: data.patch, rationale: data.rationale } as never,
      });
    }
    return { ok: true };
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ claimId: z.string().uuid(), personaId: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: adjuster } = await supabaseAdmin
      .from("personas")
      .select("id")
      .eq("role", "adjuster")
      .maybeSingle();
    await supabaseAdmin
      .from("claims")
      .update({ status: "submitted", current_reviewer_id: adjuster?.id ?? null })
      .eq("id", data.claimId);
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_persona_id: data.personaId,
      actor_role: "agent",
      action: "submitted_for_approval",
      details: {} as never,
    });
    return { ok: true };
  });

export const reviewClaim = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        personaId: z.string().uuid().nullable(),
        decision: z.enum(["approve", "reject", "changes"]),
        comment: z.string().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      changes: "changes_requested",
    };
    await supabaseAdmin
      .from("claims")
      .update({ status: statusMap[data.decision] })
      .eq("id", data.claimId);
    await supabaseAdmin.from("reviews").insert({
      claim_id: data.claimId,
      reviewer_id: data.personaId,
      decision: data.decision,
      comment: data.comment,
    });
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_persona_id: data.personaId,
      actor_role: "adjuster",
      action: `review_${data.decision}`,
      details: { comment: data.comment } as never,
    });
    return { ok: true };
  });
