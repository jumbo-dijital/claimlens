## Goal
Replace US-centric "driver side / passenger side" terminology with unambiguous "left side / right side" across UI labels, prompt text, and stored angle values. Wipe existing claim data so no legacy values remain.

## Changes

### 1. `src/lib/claim-image-prompt.ts`
- `ANGLES` → `["front", "rear", "left side", "right side"]`.
- Switch cases renamed to `"left side"` / `"right side"`.
- Angle descriptions reworded without driver/passenger framing:
  - left side → "Camera positioned perpendicular to the LEFT side of the vehicle (the side on the viewer's left when looking at the front of the car), showing the full left profile from front wheel to rear wheel."
  - right side → mirror equivalent.
- `isDamagedAngle` regex matches `left` / `right` only — no `driver`/`passenger` fallback.

### 2. `src/lib/generate-claim-details.functions.ts`
- Update synthetic-claim system prompt impact_area options to: `"front bumper and grille"`, `"rear bumper and trunk lid"`, `"left side doors and quarter panel"`, `"right side doors and quarter panel"`.
- Add: "Never use 'driver side' or 'passenger side' — always describe sides as left or right relative to the vehicle facing forward."

### 3. Data wipe
- Delete all rows from `claim_images`, `assessment_line_items`, `ai_assessments`, `reviews`, `audit_log` (where `entity_type='claim'`), and `claims`. Done via the insert tool.

## Out of scope
- No DB schema changes.
- No legacy-value compatibility — old terms are deleted, not migrated.
