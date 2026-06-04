I found the core issue: the current prompts define “left side” and “right side” using the viewer’s left/right while looking at the front of the car. That reverses the vehicle’s actual left/right and contradicts the synthetic-claim prompt, which says sides are relative to the vehicle facing forward. This explains why the model can generate the same physical side twice.

Plan:

1. Fix side definitions in `src/lib/claim-image-prompt.ts`
   - Define left/right from the vehicle’s perspective: as if seated in the car facing forward.
   - Remove the current “viewer’s left/right when looking at the front” wording.
   - Add explicit side-profile orientation cues so the two side prompts are visually distinct:
     - Left side: camera on vehicle-left; front end points toward one image edge, rear toward the opposite edge.
     - Right side: camera on vehicle-right; front/rear orientation is reversed from the left-side prompt.
   - Add clear “do not mirror / do not show the opposite side” language for each side.

2. Tighten damage visibility rules
   - For the damaged side, state that damage must appear only on that named physical side.
   - For the undamaged side, state that this is the opposite physical side and must be pristine.
   - Keep the regex limited to `left` and `right` only, with no `driver`/`passenger` fallback.

3. Fix the synthetic claim prompt in `src/lib/generate-claim-details.functions.ts`
   - Replace the current inconsistent parenthetical with: “left/right are from the vehicle occupant’s perspective while facing forward.”
   - Keep the instruction to never use “driver side” or “passenger side”.

4. Optional UI clarity in existing edit forms
   - Update the Impact area label/help copy to say left/right are vehicle-left/right, not viewer-left/right, so edited claims don’t reintroduce ambiguous wording.

5. Regeneration behavior
   - No database schema change is needed.
   - Existing generated images should be regenerated after the prompt update; I won’t delete data unless you explicitly ask again for this specific batch.