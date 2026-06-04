## Goal

Make manual uploads the primary way to add damage photos. Generation becomes a superadmin-only secondary action, gated off once any uploaded photo exists. Move generation settings into a modal and prerender placeholder tiles during generation.

## Changes

All work is in `src/routes/_authenticated/claims.$id.tsx` and `src/lib/claim-actions.functions.ts`. Images continue to be stored as base64 data URLs in `claim_images.url` (same pattern used today for generated images) — no storage bucket needed.

### 1. Backend: append-only upload server fn

In `src/lib/claim-actions.functions.ts`, add `addClaimImages`:

- Role: `agent`, `adjuster`, `superadmin` (everyone who can edit a claim).
- Input: `{ claimId, images: [{ url, angle }] }` where `url` is a base64 data URL (size-bound the validator, e.g. each url ≤ ~10 MB worth of base64).
- Inserts rows with `ai_generated: false`, `prompt: null`. Does NOT replace existing images.
- Writes an `audit_log` entry `claim_images_uploaded` with the count.

Leave `replaceClaimImages` unchanged — generation still wipes and replaces.

### 2. Upload UI (primary)

In `ImagePanel`, add an upload control as the primary action:

- A "Upload photos" `Button` (primary variant) that opens a hidden `<input type="file" accept="image/*" multiple />`.
- For each selected file: read with `FileReader.readAsDataURL`, derive `angle` from the file name (fallback to "uploaded"), call the new `addClaimImages` fn.
- Show a small inline spinner per pending upload and append to the grid as they resolve. Toast on completion or per-file failure.
- Validate client-side: image MIME type, max file size (e.g. 10 MB).

### 3. Generation gating

Compute `hasUploaded = images.some((i) => i.ai_generated === false)`.

- Hide both "Generate images" and "Regenerate" buttons when `hasUploaded` is true.
- Hide both for non-superadmin users regardless. Superadmin check: `me?.roles.includes('superadmin')`.
- The "Run AI analysis" button on the assessment card is unrelated and stays as-is.

### 4. Generation settings modal

Replace the inline `renderGenControls` row with:

- A secondary-styled "Generate images" button (outline variant, `Sparkles` icon) shown only to superadmins when no uploads exist.
- A new `GenerateImagesDialog` with three fields:
  - **Scene / setting** — `<Textarea rows={3}>`, persisted via `onUpdateClaim({ scene })` on change (same as today).
  - **Image model** — same `Select` as today.
  - **# of angles** — same `Select` as today.
- Footer: "Cancel" and "Generate" buttons. Clicking Generate closes the modal and immediately runs the existing `run()` generation flow.

The inline "Regenerate" button stays in the Damage photos card (outside the modal), shown only to superadmins and only when `!hasUploaded` and at least one generated image exists. Regenerate uses the persisted scene / model / angle count without reopening the modal.

### 5. Prerender placeholder tiles during generation

Refactor the generation loop in `run()`:

- Before the loop, seed `previews` with `angleCount` placeholder entries (`{ angle, url: "", final: false, prompt: "" }`) so all tiles render immediately with their loading spinners.
- Inside the loop, update the i-th entry in place (replace `setPreviews((p) => [...p, ...])` with the existing index-based update). Set `prompt` on the entry when it becomes known.
- The grid already handles `loading: !p.url` — no change to the rendering branch.

### 6. Layout

Damage photos card body, in order:

1. Photo grid (if any).
2. Action row: "Upload photos" (primary) + "Generate images" (secondary, superadmin + no uploads) when the grid is empty or whenever there are no images; "Upload photos" + "Regenerate" (secondary, superadmin + no uploads) when generated images already exist.

The empty state (no photos yet) shows the upload + generate buttons together so the user can choose.

## Out of scope

- No migration to a real storage bucket; keeping data URLs preserves the existing pattern.
- No change to `replaceClaimImages`, `analyzeClaim`, or the assessment flow.
- No backfill of `ai_generated` on existing rows (existing generated rows already have `ai_generated: true`).
