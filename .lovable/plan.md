## Goal

Audit log entries for edits must record both the previous value and the new value for each changed field, so the per-claim Activity timeline can render readable "from → to" diffs.

## Server changes (`src/lib/claim-actions.functions.ts`)

For every edit-style action, fetch the current row BEFORE the update, compute a per-field `{ from, to }` diff limited to fields that actually changed, and store it under `details.changes`. Keep the existing keys (`patch`, `rationale`, etc.) so nothing else breaks.

### `updateClaim`
- Pre-fetch the claim row (only the columns in the patch schema).
- Build `changes: Record<field, { from, to }>` by comparing each patch key to the existing row; skip keys where the value is unchanged.
- `details: { changes, patch }`. If `changes` is empty, skip the audit insert (and skip the DB update too).

### `editLineItem`
- `before` is already fetched. Diff each patch key against `before[key]` the same way.
- `details: { line_item_id, changes, rationale }` (keep `patch` for back-compat too).
- Special-case `is_deleted: true` → keep current `line_item_removed` action; `changes` may be omitted in that branch.

### `updateAssessmentSummary`
- Pre-fetch existing `summary` alongside `claim_id` in the same select.
- `details: { changes: { summary: { from, to } } }`. Skip insert (and update) if unchanged.

### `replaceClaimImages`
- Pre-fetch existing image rows (url, angle).
- `details: { changes: { images: { from: [...], to: [...] } }, image_count }`. The "from/to" arrays are the angle+url lists; the UI renders counts plus an expandable list.

### Actions that don't need diffs
- `createSyntheticClaim`, `deleteClaim`, `submitForApproval`, `reviewClaim`, `addLineItem` — these are create/transition/append events, not field edits. Leave their `details` as-is. The timeline renders them as single-state events (no from→to needed).

### Shared helper
Add a small `diffPatch(before, patch)` helper inside the file that returns `Record<string, { from: unknown; to: unknown }>`, used by `updateClaim` and `editLineItem` to keep logic identical. Treat `null`, `undefined`, and `""` as equivalent for "no value" so cosmetic clears don't pollute the diff.

## UI changes (`AuditTimeline` in `src/routes/_authenticated/claims.$id.tsx`)

When rendering a row whose `details.changes` is present:
- Replace the JSON preview with a compact field list:
  - `Vehicle year: 2019 → 2020`
  - `Severity: moderate → severe`
- Humanize field keys via a small label map (`policyholder_name` → "Policyholder", etc.); fall back to the raw key.
- Format values with the same helpers already used on the page (`formatCurrency` for `*_cost`, capitalize severity, plain string otherwise). Truncate long strings (e.g. `incident_description`, `summary`) to ~80 chars with a "Show full" toggle that expands the full from/to text.
- For `replaceClaimImages`, render "Images: 4 → 5" plus an expandable list of angle labels added/removed.
- The "Show details" raw-JSON toggle stays as a fallback for rows without `changes` and for power users.

## Schema

No migration needed — `audit_log.details` is already `jsonb`.

## Out of scope

- Historical rewrite of existing audit rows (old entries keep showing the raw JSON fallback).
- Diffing for create/delete/submit/review actions.
- Field-level RLS or redaction.
