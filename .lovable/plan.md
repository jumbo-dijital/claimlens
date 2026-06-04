
## Goal

Replace the current single-form claim-generation page with a guided flow:

1. **Zero state** on `/admin/generate` — one big blue "Generate claim details" button.
2. **Unsaved synthetic claim** — AI fabricates all details, shown as an editable form with three actions (Regenerate, Save and proceed to images, Clear).
3. **Saved claim** — user is taken to `/claims/$id`, where the same fields appear as an editable form with Save / Delete, and the image panel exposes a "Generate images" button.
4. **Images** — generated images are auto-saved against the claim; Regenerate deletes the previous set first. The prompt sent to the AI gateway is shown under each image.

In-session draft state (the unsaved generated claim) is preserved if the user navigates away and back, but never persisted across page reloads or new sessions.

---

## 1. Database changes (one migration)

Add the fields needed to keep image-generation context with the claim so regeneration works after navigation/reload, and to display the prompt used:

- `claims`:
  - `paint_color text`
  - `scene text`
  - `impact_area text`
  - `damage_severity text` (minor / moderate / severe)
  - `image_model text` (e.g. `google/gemini-3.1-flash-image-preview`)
  - `image_angle_count int` (1–4)
- `claim_images`:
  - `prompt text` — the exact text prompt sent to the AI gateway for this image.

No new tables, no policy changes (existing claim/image RLS already covers these).

---

## 2. New / changed server functions

All in `src/lib/claim-actions.functions.ts` (or split as noted), all `createServerFn` with `requireRole("superadmin")` where appropriate:

- **`generateSyntheticClaimDetails`** *(new)* — no DB write. Calls Lovable AI (`google/gemini-3-flash-preview` via the existing AI gateway provider) with a structured `Output.object` schema to fabricate: `policyholder_name`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_class`, `paint_color`, `scene`, `impact_area`, `damage_severity`, `incident_description`. Returns the object to the client.
- **`createSyntheticClaim`** *(extend existing)* — accepts the new fields, persists them on the `claims` row, and (for this new flow) is called with `images: []` so it just creates the empty claim. Existing image-array behaviour stays compatible.
- **`updateClaim`** *(new)* — superadmin-only patch of the claim fields above; writes `audit_log`.
- **`deleteClaim`** *(new)* — superadmin-only cascade delete of `claims` row and its `claim_images` (and any AI assessment rows); writes `audit_log`.
- **`replaceClaimImages`** *(new)* — superadmin-only. Takes `{ claimId, images: [{ url, angle, prompt }] }`, deletes existing `claim_images` for the claim, inserts the new ones, writes an audit entry.

The existing `/api/generate-damage-image` server route is reused unchanged for the actual image streaming.

---

## 3. In-session draft store

A small module-level store (plain Zustand-style hook or a React context provider mounted in `src/routes/_authenticated/route.tsx`) holds the current unsaved generated claim:

- Shape: `{ draft: SyntheticClaim | null, setDraft, clearDraft }`.
- Lives in memory only — no `localStorage` / `sessionStorage`. This satisfies "preserved within the session, lost on reload".
- The `/admin/generate` route reads/writes this store so navigating away (e.g. opening the sidebar or visiting another page) and back restores the draft view.

---

## 4. `/admin/generate` rewrite

Three render states, derived from the draft store:

**A. Zero state (no draft)**
- Centered card with a single primary-blue button: *"Generate claim details"* (Sparkles icon).
- Clicking it calls `generateSyntheticClaimDetails`, stores the result in the draft store, transitions to state B.

**B. Unsaved draft**
- Editable form bound to the draft (every field from the schema, including paint color / scene / impact area / severity / model / angle count selectors that were already on this page).
- Footer with three buttons:
  - **Regenerate** (`RefreshCw` icon, outline) — re-calls `generateSyntheticClaimDetails`, replaces draft.
  - **Save and proceed to images** (`ArrowRight` icon, primary blue) — calls `createSyntheticClaim` with `images: []`, clears the draft store, navigates to `/claims/$id`.
  - **Clear** (`Eraser` icon, outline) — clears the draft store, returns to state A. No DB write.

**C. (state C lives on the claim detail page — see §5)**

The old manual-entry-only mode is removed. All fields are still editable in state B in case the user wants to tweak the AI output before saving.

---

## 5. `/claims/$id` additions

Augment the existing claim detail page so it can host the post-save edit + image-generation flow:

**Editable claim header form** (visible to superadmin only)
- Replaces the static `<h1>` / subtitle block when `me.roles.includes("superadmin")`.
- Inline form for the claim fields (policyholder, make/model/year, class, paint color, scene, impact area, severity, angle count, image model, incident description).
- Two buttons under the form:
  - **Save** (default) — calls `updateClaim`, refetches the claim.
  - **Delete** (destructive, `Trash2` icon) — confirm dialog → `deleteClaim` → navigate back to `/`.

**Image panel** (replaces current static "Damage photos" card behaviour)
- If `images.length === 0`: a primary-blue **Generate images** button (`Sparkles` icon).
- If `images.length > 0`: shows the images plus a **Regenerate** button (`RefreshCw` icon, outline).
- Clicking either triggers the existing streaming flow against `/api/generate-damage-image`, one angle at a time, using the claim's stored `paint_color`/`scene`/`impact_area`/`damage_severity`/`image_model`/`image_angle_count` to build the prompt (same `buildPrompt` logic moved into a shared helper in `src/lib/claim-image-prompt.ts`).
- On completion: calls `replaceClaimImages` with the full new set (and each image's prompt). For Regenerate this deletes the previous images server-side in the same call.
- Each rendered image shows its `prompt` underneath in a small muted text block (collapsible "Show prompt" toggle to keep the UI tidy).

The existing AI-assessment panel, line-item editing, submit-for-approval, and reviewer flows are left untouched.

---

## 6. Files touched

- `supabase/migrations/<new>.sql` — schema additions above.
- `src/lib/claim-actions.functions.ts` — extend `createSyntheticClaim`, add `updateClaim`, `deleteClaim`, `replaceClaimImages`.
- `src/lib/generate-claim-details.functions.ts` *(new)* — `generateSyntheticClaimDetails` using Lovable AI gateway provider.
- `src/lib/claim-image-prompt.ts` *(new)* — shared `buildPrompt(angle, claim)`.
- `src/lib/use-claim-draft.ts` *(new)* — in-memory draft store hook.
- `src/routes/_authenticated/admin.generate.tsx` — full rewrite for the 3 render states described in §4.
- `src/routes/_authenticated/claims.$id.tsx` — add edit form (superadmin) and image generate/regenerate panel from §5.
- `src/integrations/supabase/types.ts` — regenerated after migration runs (automatic).

---

## Out of scope

- No changes to authentication, RLS, the AI assessment / line-item flow, or the reviewer/adjuster screens.
- No persistence of the draft across reloads (explicit requirement).
- Non-superadmin roles continue to see the existing read-only claim detail view; the new edit form and image generation controls are gated to superadmin (matching `createSyntheticClaim`'s existing role check).
