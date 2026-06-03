## ClaimLens Prototype Plan

A proof-of-concept claims assessment co-pilot with AI damage analysis, agent review, supervisor approval, and superadmin synthetic claim generation.

### Personas (top-right user switcher, no real auth)
- **Claims Agent** — Sarah: reviews claims, edits AI estimates, submits for approval
- **Senior Adjuster** — Tom: approves/rejects/sends back
- **Superadmin**: generates synthetic claims with AI-generated damage images

### Routes
- `/` — Claims queue (filtered by current persona's relevant statuses)
- `/claims/$id` — Claim workspace (images + AI assessment + edit/submit)
- `/claims/$id/review` — Supervisor review view (approve/reject/comment)
- `/admin/generate` — Superadmin synthetic claim generator
- `/audit` — Audit trail / activity log
- `/claims/$id/report` — Printable/exportable estimate report

### Key UI
1. **Claims queue**: table of claims with status badges (New, AI Processing, In Review, Submitted, Approved, Rejected, Needs Info), policyholder, vehicle, date, confidence indicator.
2. **Claim workspace**:
   - Left: image gallery organized by angle (front/rear/side/close-up), quality flags for low-res/blurry
   - Center: AI damage findings list — each line item (e.g. "Front bumper — dent", confidence %, suggested part/labour, cost from repair DB), with annotated image preview
   - Right: editable estimate table; agent edits require a rationale note (logged)
   - "Re-run AI analysis" button; "Submit for approval" CTA
3. **Supervisor review**: read-only assessment + AI vs agent diff + comment box + Approve / Request changes / Reject
4. **Superadmin generator**: form (vehicle make/model/year, damage severity, # of angles) → uses Lovable AI Gateway image generation to create synthetic damage photos, then seeds a claim with those images
5. **Audit trail**: chronological log of AI runs, edits with rationale, approvals
6. **Report view**: clean itemised estimate, print/export

### Data model (Lovable Cloud / Supabase)
- `claims` (id, policyholder_name, vehicle_make, vehicle_model, vehicle_year, plate, incident_date, status, current_agent_id, current_reviewer_id, created_at)
- `claim_images` (id, claim_id, storage_path, angle, quality_flag, ai_generated boolean)
- `ai_assessments` (id, claim_id, version, summary, overall_confidence, raw_json, created_at)
- `assessment_line_items` (id, assessment_id, damage_type, location, severity, suggested_repair, part_cost, labour_hours, labour_cost, confidence, source: ai|agent, edited_by, rationale)
- `reviews` (id, claim_id, reviewer_id, decision: approve|reject|changes, comment, created_at)
- `audit_log` (id, claim_id, actor_persona, action, details_json, created_at)
- `personas` (seeded: agent, adjuster, superadmin) — selected via local persona switcher (no real auth)
- `repair_catalog` (id, part_name, vehicle_class, base_part_cost, base_labour_hours) — seeded

Storage bucket `claim-images` (public, for prototype).

### AI integration (Lovable AI Gateway, server-side only)
- **Damage analysis (vision)**: `google/gemini-3-flash-preview` via AI SDK with `Output.object` schema — takes image URLs, returns structured findings (damage type, location, severity, confidence, suggested repair). Server function cross-references `repair_catalog` to attach cost estimates.
- **Synthetic damage image generation**: Lovable AI Gateway `/v1/images/generations` with **Gemini image models** — default `google/gemini-3.1-flash-image-preview` (Nano Banana 2, fast + high quality), with optional toggle to `google/gemini-3-pro-image-preview` for higher fidelity. Streamed with progressive previews; final PNG uploaded to the `claim-images` storage bucket and attached to the synthetic claim.
- Server routes: `src/routes/api/generate-damage-image.ts` (streaming SSE) and server functions in `src/lib/ai/*.functions.ts` for analysis.

### Persona switching
Zustand store with current persona id, persisted to localStorage. Header dropdown switches between the 3 seeded users. All server functions accept persona id as input (no real auth for POC).

### Stack
- TanStack Start template, Tailwind + shadcn, TanStack Query
- Lovable Cloud for DB + storage
- Lovable AI Gateway for vision analysis + Gemini image generation

### Out of scope (per PRD non-goals)
- Real authentication / SSO
- Policyholder-facing claim submission
- Repair shop integration
- Full automation (always human-in-the-loop)

### Build order
1. Enable Lovable Cloud, create schema + seed personas and repair catalog, create storage bucket
2. Persona switcher + claims queue + base layout/design system
3. Claim workspace UI
4. AI damage analysis server function + wire to workspace
5. Edit/rationale logging + submit workflow
6. Supervisor review screen
7. Superadmin synthetic claim generator with Gemini image generation (streamed previews)
8. Audit trail + report export
