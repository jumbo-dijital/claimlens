## Goal

Let agents and adjusters (not just superadmin) edit claim details, manage damage photos, and edit/extend the assessment. Rename "AI assessment" to "Claim assessment". Make the assessment summary editable. Allow manually adding damaged-component line items.

## Server functions (`src/lib/claim-actions.functions.ts`)

1. **Broaden roles** on existing fns so agent + adjuster + superadmin can all use them:
   - `updateClaim` → `requireRole("agent", "adjuster", "superadmin")`
   - `replaceClaimImages` → same
   - `editLineItem` → add `adjuster`
   - (Keep `deleteClaim` superadmin-only — not part of this request.)

2. **Add `updateAssessmentSummary`** (agent/adjuster/superadmin): input `{ assessmentId, summary }`; updates `ai_assessments.summary`; writes `audit_log` action `assessment_summary_edited`.

3. **Add `addLineItem`** (agent/adjuster/superadmin): input `{ assessmentId, fields: { damage_type, location, severity, suggested_repair, part_cost, labour_hours, labour_cost }, rationale (>=3) }`; inserts row with `source: "agent"`, `edited_by: context.userId`, stored `rationale`; writes audit `line_item_added`.

## UI (`src/routes/_authenticated/claims.$id.tsx`)

1. **Always render `ClaimEditCard` and `ImagePanel`** — remove the `isSuperadmin` gates around them. Drop the read-only image grid fallback. (Keep the destructive Delete button inside `ClaimEditCard` visible only to superadmin.)

2. **Rename card heading** from "AI assessment" to "Claim assessment". Update the `<CardTitle>` text.

3. **Editable summary**: replace the static `<p>{assessment.summary}</p>` with an inline-editable `<Textarea>` + Save button (only rendered when an assessment exists). Calls `updateAssessmentSummary` then refetches.

4. **Add line item**: below the line-item list (and when list is empty but assessment exists), add an "Add line item" button that opens a new `AddLineItemDialog` (mirrors `EditDialog` shape) with fields: repair description, damage type, location, severity (select: minor/moderate/severe), part cost, labour hours, rationale. Labour cost auto-derived as `hours * 95` to match existing pattern. On save calls `addLineItem` then refetches `line-items`.

5. No changes to the review route — its own editing flow already exists there.

## Out of scope

- Deleting claims stays superadmin-only.
- No schema/migration changes; existing `assessment_line_items` columns already support manual insert with `source = 'agent'`.
- Audit log UI unchanged (new actions just appear in the existing feed).
