## Move image model and angle count controls next to the generate button

### Problem
The **Image model** and **# of angles** dropdowns currently live in the claim edit form at the top of the page. They only affect image generation, so they should appear beside the **Generate images** / **Regenerate** button inside the Damage photos card.

### Changes

1. **Remove the two dropdowns from the claim edit form**
   - File: `src/routes/_authenticated/claims.$id.tsx`
   - Delete the `<div>` blocks for `Image model` (line ~518) and `# of angles` (line ~529) from the `ClaimEditForm` grid.
   - Remove `image_model` and `image_angle_count` from the form state/setters if they are no longer used elsewhere in the edit form.

2. **Add the controls to `ImagePanel`**
   - File: `src/routes/_authenticated/claims.$id.tsx`
   - Pass the current `image_model` and `image_angle_count` values into `ImagePanel` (it already receives `claim`).
   - In `ImagePanel`, render the two dropdowns horizontally (or stacked) directly above the **Generate images** button (when no images exist) or beside/above the **Regenerate** button (when images exist).
   - On change, write the new value back to the claim via `updateClaim` so the selection persists for the next generation.

3. **Update labels map**
   - Remove `image_model` and `image_angle_count` from the audit-log labels map if they were listed there (they are generation settings, not claim metadata worth logging).

### No schema or backend changes required.