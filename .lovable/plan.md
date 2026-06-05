## Goal

Rebuild "New claim" as a normal action on the claims table. Manual entry is the default; AI generation is a labeled superadmin shortcut on both steps of the flow.

Step 1 (claim details): empty form by default + "Demo: Generate claim" shortcut.
Step 2 (damage photos, on the claim detail page): manual upload by default + "Demo: Generate photos" shortcut that opens a modal pre-populated with scene/model/angles.

## Files

### New: `src/components/claim-details-form.tsx`

Extract the editable form currently inlined as `ClaimEditCard` in `src/routes/_authenticated/claims.$id.tsx` (~lines 450–605) into a reusable component.

```tsx
export interface ClaimDetailsValues {
  policyholder_name: string;
  policy_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_class: "standard" | "premium";
  damage_severity: "minor" | "moderate" | "severe";
  paint_color: string;
  impact_area: string;
  incident_description: string;
}

interface Props {
  initial: ClaimDetailsValues;
  saveLabel?: string;        // default "Save"
  onSave: (values: ClaimDetailsValues) => Promise<void>;
  onDelete?: () => Promise<void>;   // omit to hide Delete
  headerExtra?: ReactNode;          // right-aligned slot in CardHeader
  title?: string;                   // default "Claim details"
  valuesOverride?: ClaimDetailsValues; // setting this resets form state to it
}
```

Internally holds form state, exposes a `headerExtra` slot for the "Demo: Generate claim" button, keeps the existing delete confirmation `AlertDialog`. Export `emptyClaimDetails()` returning sensible blanks (empty strings, current year, "standard", "moderate").

### Edit: `src/routes/_authenticated/claims.$id.tsx`

- Remove the inlined `ClaimEditCard`.
- Use `<ClaimDetailsForm initial={...} onSave={...} onDelete={isSuperadmin ? ... : undefined} />` in `ClaimDetail`.
- In `ImagePanel`, reorder the action row so **Upload photos is the default primary button** and the AI shortcut is the secondary one, labelled **"Demo: Generate photos"** with the `Sparkles` icon (superadmin-only, hidden once any manual upload exists — current rule). Same wording for the regenerate state: **"Demo: Regenerate"**. Clicking it still opens the existing `GenerateImagesDialog`, which already contains scene/model/angle-count fields — no behavior change there.

### New: `src/routes/_authenticated/claims.new.tsx`

Route at `/claims/new`. Heading "New claim". Renders:

```tsx
<ClaimDetailsForm
  initial={emptyClaimDetails()}
  valuesOverride={aiSeed ?? undefined}
  saveLabel="Create claim"
  onSave={async (values) => {
    const { claimId } = await createClaim({ data: values });
    router.navigate({ to: "/claims/$id", params: { id: claimId } });
  }}
  headerExtra={isSuperadmin ? <DemoGenerateButton onFilled={setAiSeed} /> : null}
/>
```

`DemoGenerateButton`: outline button, `Sparkles` icon, label "Demo: Generate claim". Calls `generateSyntheticClaimDetails` server fn and passes the mapped values into `setAiSeed`. The AI returns extra fields (`scene`, etc.) — drop fields not on the form.

### Edit: `src/lib/claim-actions.functions.ts`

Repurpose `createSyntheticClaim` → `createClaim`:

- Middleware broadened to `requireRole("agent", "adjuster", "superadmin")`.
- Drop `scene`, `image_model`, `image_angle_count`, and `images` from the input schema (those belong to the Damage photos step). Insert column defaults for `image_model` / `image_angle_count` when writing the row.
- Audit action becomes `"claim_created"`; add `details: { source: "manual" | "demo_generated" }` driven by an optional `demoGenerated: boolean` input.

### Edit: `src/routes/_authenticated/index.tsx`

Replace the superadmin "Generate synthetic claim" button with a **`+ New`** button visible to all roles, linking to `/claims/new`.

### Edit: `src/components/app-header.tsx`

Remove the "Generate claim" nav item from `navFor`. Nav becomes Claims + Audit log for everyone.

### Delete

- `src/routes/_authenticated/admin.generate.tsx`
- `src/lib/use-claim-draft.ts` (only used by that page)

Keep `src/lib/generate-claim-details.functions.ts` — it powers the "Demo: Generate claim" shortcut.

## Out of scope

- No changes to `GenerateImagesDialog` internals or to the image generation pipeline.
- No changes to the AI prompt in `generateSyntheticClaimDetails`.
- No rename/backfill of historical `claim_created_synthetic` audit rows.
