## Lifecycle (final)

Five steps, no `ai_processing`, no `changes_requested`:

```text
 ●━━━━●━━━━○━━━━○━━━━○
 New  Review Submit Approved  Rejected
```

| Status | Step | Notes |
|---|---|---|
| `new` | 1. New | claim created; covers the brief AI analysis window |
| `in_review` | 2. In review | assessment exists with line items |
| `submitted` | 3. Submitted for approval | awaiting adjuster |
| `approved` | 4. Approved | terminal (success) |
| `rejected` | 5. Rejected | terminal (destructive) |

Approved and Rejected are mutually exclusive terminals on the same row; only the reached one lights up. Adjusters/superadmins can send a `submitted` claim back via "Return to assessors", which sets the status back to `in_review`.

## DB migration

Single migration on `public.claims`:

1. `UPDATE claims SET status = 'new' WHERE status = 'ai_processing';`
2. `UPDATE claims SET status = 'in_review' WHERE status = 'changes_requested';`
3. Drop the existing CHECK constraint on `status` and recreate it as `CHECK (status IN ('new','in_review','submitted','approved','rejected'))`.

No changes to RLS or grants. Audit rows are not rewritten — historical `action` values like `review_changes` stay as-is in `audit_log`.

## Server functions (`src/lib/claim-actions.functions.ts`)

- `reviewClaim`: narrow `decision` to `z.enum(["approve","reject"])` and drop the `changes` branch + `changes_requested` from `statusMap`. The senior review screen no longer has a "Request changes" option — sending work back is the adjuster's "Return to assessors" action instead.
- New `returnToAssessors({ claimId, comment? })`, `requireRole("adjuster","superadmin")`: sets `claims.status = 'in_review'`, inserts `audit_log` row with `action = "returned_to_assessors"`, `details = { comment }`.
- New `addClaimComment({ claimId, text })`, `requireRole("agent","adjuster","superadmin")`: text trimmed 1..2000, inserts `audit_log` row with `action = "comment"`, `details = { text }`. Comments live in `audit_log` so they appear in Activity history with no schema change.

## AI analysis (`src/lib/ai/analyze-claim.functions.ts`)

Remove the `status = "ai_processing"` write at line 118. After analysis succeeds, set `status = "in_review"` (already happens downstream when the assessment is written — verify and keep a single transition from `new` → `in_review`). No intermediate processing status surfaces to the UI; the button shows its own "Analyzing…" spinner.

## UI

- New `src/components/claim-progress-stepper.tsx` (`{ status }` prop). Semantic tokens only; check icons for completed steps; ring on current; muted on upcoming. On `<sm`, hide non-current labels.
- `src/routes/_authenticated/claims.$id.tsx`:
  - Mount the stepper directly above the `ClaimDetailsForm`.
  - Header action row: replace the existing `submitted || changes_requested` predicate with just `submitted`. Add a `Return to assessors` outline button (adjuster/superadmin, when `status === 'submitted'`) that opens a small dialog with an optional comment textarea and calls `returnToAssessors`.
  - Activity history: add a comment composer (Textarea + "Post comment") at the top for all roles, calling `addClaimComment`. Extend the activity row renderer to label `comment` (show body, preserve line breaks) and `returned_to_assessors` (show comment if any).
- `src/routes/_authenticated/claims.$id.review.tsx`: remove the "Request changes" button and the `"changes"` branch from `act()`. Keep Approve and Reject.
- `src/routes/_authenticated/index.tsx`: drop `ai_processing` and `changes_requested` from both status filters (lines 46 and 48).
- `src/lib/format.ts`: remove `ai_processing` and `changes_requested` entries from both `statusLabel` and `statusTone`.

## Out of scope

- Renaming or backfilling historical `audit_log.action` values (`review_changes`, etc.).
- Any change to `ai_assessments`, `assessment_line_items`, or image flows.
- Editing or deleting comments after posting.
