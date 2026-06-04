## Add "Look up estimate" button to Add line item dialog

### Goal
In the Add line item modal, hide the part cost and labour hours fields until the user clicks a **"Look up estimate"** button. The button asks AI to estimate both values based on the entered repair description, damage type, location, and severity. After the estimate returns, the two fields appear (pre-filled, still editable) so the user can adjust before saving.

### Changes

1. **New server function** `estimateLineItemCost` in `src/lib/claim-actions.functions.ts`:
   - Input (Zod-validated): `claimId`, `suggested_repair`, `damage_type`, `location`, `severity`.
   - Auth: `requireRole("agent", "adjuster", "superadmin")`.
   - Handler:
     - Load the claim (for `vehicle_year/make/model/class`).
     - Load `repair_catalog` rows for the claim's `vehicle_class` and include them in the prompt as reference pricing.
     - Call Lovable AI via `createLovableAiGatewayProvider` + `generateText` with `google/gemini-3-flash-preview`, asking for strict JSON: `{ "part_cost": number, "labour_hours": number, "rationale": string }`.
     - Parse JSON, clamp to sensible ranges (`part_cost >= 0`, `0.1 <= labour_hours <= 40`).
     - Return `{ part_cost, labour_hours, rationale }`.
   - Surface 429/402 errors with friendly messages, matching the pattern in `analyze-claim.functions.ts`.

2. **Update `AddLineItemDialog`** in `src/routes/_authenticated/claims.$id.tsx`:
   - Accept `claimId` as a new prop and pass it from the parent call site.
   - Remove `partCost` / `hours` state initialization to `"0"`; instead track `estimate: { part_cost: number; labour_hours: number } | null` initialized to `null`.
   - Add an `estimating` state and a **"Look up estimate"** button placed where the part cost / labour hours row currently sits.
   - Button disabled until `repair`, `damageType`, `location` are non-empty (and while `estimating`).
   - On click: call the new server fn via `useServerFn`; on success, set the estimate state, populate `partCost` and `hours` inputs, and toast the rationale; on failure, toast the error.
   - Only render the Part cost and Labour hours inputs after `estimate !== null`. Once shown, allow the user to edit them or click the button again to re-estimate.
   - Update `valid` to also require `estimate !== null` so the user can't save without looking up an estimate.

### Out of scope
- No schema changes.
- No changes to the existing edit-line-item dialog or "Run AI analysis" flow.