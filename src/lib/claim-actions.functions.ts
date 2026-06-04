import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireRole } from "@/lib/auth-roles.server";

function genClaimNumber() {
  const n = Math.floor(Math.random() * 900000 + 100000);
  return `CL-${new Date().getFullYear()}-${n}`;
}

const ImageModelEnum = z.enum([
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
]);

export const createSyntheticClaim = createServerFn({ method: "POST" })
  .middleware([requireRole("superadmin")])
  .inputValidator((input: unknown) =>
    z
      .object({
        policyholder_name: z.string().min(1).max(120),
        vehicle_make: z.string().min(1).max(60),
        vehicle_model: z.string().min(1).max(60),
        vehicle_year: z.number().int().min(1990).max(2030),
        vehicle_class: z.enum(["standard", "premium"]).default("standard"),
        incident_description: z.string().max(2000).default(""),
        paint_color: z.string().max(80).default(""),
        scene: z.string().max(400).default(""),
        impact_area: z.string().max(160).default(""),
        damage_severity: z.enum(["minor", "moderate", "severe"]).default("moderate"),
        image_model: ImageModelEnum.default("google/gemini-3.1-flash-image-preview"),
        image_angle_count: z.number().int().min(1).max(4).default(4),
        images: z
          .array(
            z.object({
              url: z.string().min(1),
              angle: z.string().max(60),
              prompt: z.string().max(4000).optional(),
            }),
          )
          .min(0)
          .max(8)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
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
        paint_color: data.paint_color || null,
        scene: data.scene || null,
        impact_area: data.impact_area || null,
        damage_severity: data.damage_severity,
        image_model: data.image_model,
        image_angle_count: data.image_angle_count,
        status: "new",
      })
      .select()
      .single();
    if (error || !claim) throw new Error(error?.message ?? "Failed to create claim");

    if (data.images.length > 0) {
      await supabaseAdmin.from("claim_images").insert(
        data.images.map((img) => ({
          claim_id: claim.id,
          url: img.url,
          angle: img.angle,
          prompt: img.prompt ?? null,
          ai_generated: true,
        })),
      );
    }

    await supabaseAdmin.from("audit_log").insert({
      claim_id: claim.id,
      actor_user_id: context.userId,
      actor_role: "superadmin",
      action: "claim_created_synthetic",
      details: { image_count: data.images.length } as never,
    });

    return { claimId: claim.id };
  });

export const updateClaim = createServerFn({ method: "POST" })
  .middleware([requireRole("agent", "adjuster", "superadmin")])
  .inputValidator((input: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        patch: z.object({
          policyholder_name: z.string().min(1).max(120).optional(),
          vehicle_make: z.string().min(1).max(60).optional(),
          vehicle_model: z.string().min(1).max(60).optional(),
          vehicle_year: z.number().int().min(1990).max(2030).optional(),
          vehicle_class: z.enum(["standard", "premium"]).optional(),
          incident_description: z.string().max(2000).optional(),
          paint_color: z.string().max(80).optional(),
          scene: z.string().max(400).optional(),
          impact_area: z.string().max(160).optional(),
          damage_severity: z.enum(["minor", "moderate", "severe"]).optional(),
          image_model: ImageModelEnum.optional(),
          image_angle_count: z.number().int().min(1).max(4).optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("claims")
      .update(data.patch)
      .eq("id", data.claimId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_user_id: context.userId,
      actor_role: context.roles.includes("superadmin") ? "superadmin" : context.roles.includes("adjuster") ? "adjuster" : "agent",
      action: "claim_updated",
      details: { patch: data.patch } as never,
    });
    return { ok: true };
  });

export const deleteClaim = createServerFn({ method: "POST" })
  .middleware([requireRole("superadmin")])
  .inputValidator((input: unknown) =>
    z.object({ claimId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Best-effort cascade: images, line items, assessments, reviews, audit, then claim.
    const { data: assessments } = await supabaseAdmin
      .from("ai_assessments")
      .select("id")
      .eq("claim_id", data.claimId);
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    if (assessmentIds.length > 0) {
      await supabaseAdmin
        .from("assessment_line_items")
        .delete()
        .in("assessment_id", assessmentIds);
    }
    await supabaseAdmin.from("ai_assessments").delete().eq("claim_id", data.claimId);
    await supabaseAdmin.from("claim_images").delete().eq("claim_id", data.claimId);
    await supabaseAdmin.from("reviews").delete().eq("claim_id", data.claimId);
    await supabaseAdmin.from("audit_log").delete().eq("claim_id", data.claimId);
    const { error } = await supabaseAdmin.from("claims").delete().eq("id", data.claimId);
    if (error) throw new Error(error.message);
    // audit_log row referencing this claim_id would FK-fail after delete; log a fresh row without claim_id
    await supabaseAdmin.from("audit_log").insert({
      claim_id: null,
      actor_user_id: context.userId,
      actor_role: "superadmin",
      action: "claim_deleted",
      details: { claim_id: data.claimId } as never,
    });
    return { ok: true };
  });

export const replaceClaimImages = createServerFn({ method: "POST" })
  .middleware([requireRole("superadmin")])
  .inputValidator((input: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        images: z
          .array(
            z.object({
              url: z.string().min(1),
              angle: z.string().max(60),
              prompt: z.string().max(4000),
            }),
          )
          .min(1)
          .max(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("claim_images").delete().eq("claim_id", data.claimId);
    const { error } = await supabaseAdmin.from("claim_images").insert(
      data.images.map((img) => ({
        claim_id: data.claimId,
        url: img.url,
        angle: img.angle,
        prompt: img.prompt,
        ai_generated: true,
      })),
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_user_id: context.userId,
      actor_role: "superadmin",
      action: "claim_images_replaced",
      details: { image_count: data.images.length } as never,
    });
    return { ok: true };
  });

export const editLineItem = createServerFn({ method: "POST" })
  .middleware([requireRole("agent", "superadmin")])
  .inputValidator((i: unknown) =>
    z
      .object({
        lineItemId: z.string().uuid(),
        patch: z.object({
          suggested_repair: z.string().max(300).optional(),
          part_cost: z.number().min(0).max(1_000_000).optional(),
          labour_hours: z.number().min(0).max(500).optional(),
          labour_cost: z.number().min(0).max(1_000_000).optional(),
          severity: z.string().max(40).optional(),
          is_deleted: z.boolean().optional(),
        }),
        rationale: z.string().min(3).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
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
        edited_by: context.userId,
        rationale: data.rationale,
      })
      .eq("id", data.lineItemId);
    if (error) throw new Error(error.message);

    const claimId = (before as { ai_assessments?: { claim_id?: string } } | null)?.ai_assessments
      ?.claim_id;
    if (claimId) {
      await supabaseAdmin.from("audit_log").insert({
        claim_id: claimId,
        actor_user_id: context.userId,
        actor_role: context.roles.includes("superadmin") ? "superadmin" : "agent",
        action: data.patch.is_deleted ? "line_item_removed" : "line_item_edited",
        details: { line_item_id: data.lineItemId, patch: data.patch, rationale: data.rationale } as never,
      });
    }
    return { ok: true };
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireRole("agent", "superadmin")])
  .inputValidator((i: unknown) => z.object({ claimId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await supabaseAdmin
      .from("claims")
      .update({ status: "submitted" })
      .eq("id", data.claimId);
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_user_id: context.userId,
      actor_role: context.roles.includes("superadmin") ? "superadmin" : "agent",
      action: "submitted_for_approval",
      details: {} as never,
    });
    return { ok: true };
  });

export const reviewClaim = createServerFn({ method: "POST" })
  .middleware([requireRole("adjuster", "superadmin")])
  .inputValidator((i: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        decision: z.enum(["approve", "reject", "changes"]),
        comment: z.string().max(2000).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
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
      reviewer_id: context.userId,
      decision: data.decision,
      comment: data.comment,
    });
    await supabaseAdmin.from("audit_log").insert({
      claim_id: data.claimId,
      actor_user_id: context.userId,
      actor_role: context.roles.includes("superadmin") ? "superadmin" : "adjuster",
      action: `review_${data.decision}`,
      details: { comment: data.comment } as never,
    });
    return { ok: true };
  });
