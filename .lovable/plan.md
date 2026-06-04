## Goal

On the Damage photos grid, let users (a) delete an individual photo and (b) click any photo to view it full-size in a modal.

## Changes

### 1. Backend: `deleteClaimImage` server fn

In `src/lib/claim-actions.functions.ts`, add `deleteClaimImage`:

- Middleware: `requireRole("agent", "adjuster", "superadmin")`.
- Input (zod): `{ claimImageId: z.string().uuid() }`.
- Handler: fetch the row (to get `claim_id`, `angle`, `ai_generated` for the audit entry), delete by id via `supabaseAdmin`, and write an `audit_log` row with `action: "claim_image_deleted"`, `details: { angle, ai_generated }`, plus `...getRequestAuditContext()`.

### 2. Frontend: delete + lightbox in `ImagePanel`

In `src/routes/_authenticated/claims.$id.tsx`:

- Import the new `deleteClaimImage` and wire `useServerFn` in `ClaimDetail`. Pass an `onDelete` handler into `ImagePanel` that calls it, then `refetchImages()` and `refreshActivity()`.
- In `ImagePanel`:
  - Add `lightbox` state holding the currently-expanded image (`{ url, angle } | null`). Saved images (non-live preview tiles) become clickable: the `<img>` is wrapped in a `<button type="button">` with `cursor-zoom-in` that opens the lightbox. Live in-flight generation previews are NOT clickable (no URL yet / mid-stream).
  - Add a small delete button overlaid on the top-right of each saved image (icon-only `Button`, `Trash2` icon, `size="icon"`, semi-transparent background so it sits on the photo). Clicking it stops propagation, opens an `AlertDialog` confirming deletion, then calls `onDelete(image.id)`. Live preview tiles do not get a delete button.
  - Render a `Dialog` (lightbox) that shows the full image (`max-h-[85vh] w-auto object-contain`) with the angle label below. Close by clicking outside or pressing Escape (default Dialog behavior).

`ClaimImageRow` already carries `id`, `url`, `angle` — no shape change needed.

### 3. Generation gating stays correct

Deleting a user-uploaded photo can flip `hasUploaded` back to false, which restores the Generate/Regenerate buttons for superadmins. This falls out naturally from `images.some((i) => i.ai_generated === false)` recomputing after refetch — no extra work.

## Out of scope

- No bulk-delete / multi-select.
- No undo. Deletion is immediate after confirm.
- No keyboard navigation between images in the lightbox (single-image view only).
