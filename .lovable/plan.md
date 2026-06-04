# Harden DB access without per-user scoping

## Goal

The anon key must not reach any table. Authenticated users keep seeing all data (no per-user scoping), but cannot write directly via the Data API — all mutations go through server functions using the service-role client, which already enforce auth via `requireSupabaseAuth`.

## Current reality (verified)

- No `GRANT`s exist on any `public` table for `anon`, `authenticated`, or `service_role`. The Data API is effectively closed today by *absence* of grants — fragile and implicit.
- SELECT policies exist for the `authenticated` role on every table (`USING (true)`) but are dormant because grants are missing.
- No INSERT/UPDATE/DELETE policies anywhere. Writes today only work via `supabaseAdmin` inside server functions.
- This works, but it's held together by "nobody added a GRANT". A future migration that adds a grant immediately exposes everything.

## Change: make the closed posture explicit and intentional

### 1. Migration — explicit grants and revokes on every public table

For each table in `public` (`ai_assessments`, `assessment_line_items`, `audit_log`, `claim_images`, `claims`, `personas`, `profiles`, `repair_catalog`, `reviews`, `user_roles`):

- `REVOKE ALL ... FROM anon` — anon key gets nothing via Data API, ever.
- `GRANT SELECT ON ... TO authenticated` — signed-in users can read (matches existing `USING (true)` SELECT policies). No INSERT/UPDATE/DELETE grant, so direct writes from the browser 403 even with a valid JWT.
- `GRANT ALL ON ... TO service_role` — server functions using `supabaseAdmin` keep working.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (idempotent; confirms RLS is on so the policies are actually enforced).
- Keep the existing `profiles` UPDATE policy (`id = auth.uid()`) and `user_roles` SELECT policy as-is. No grant for UPDATE/DELETE on profiles means even the self-update policy can't fire via Data API; if direct profile updates from the client are needed we can add `GRANT UPDATE ON public.profiles TO authenticated` — confirm before I include it.

### 2. No app code changes required

- Server functions already use `supabaseAdmin` (service role bypasses RLS and grants) or `requireSupabaseAuth` (acts as the user — SELECT-only, which matches the new grants).
- Browser code that reads from Supabase directly will continue to work for SELECTs and start failing for any direct INSERT/UPDATE/DELETE. I'll grep for direct mutation calls before submitting the migration and flag any I find rather than silently breaking them.

### 3. Documentation

Add a short `SECURITY.md` at repo root describing the model:
- anon key is inert (no grants, RLS on).
- Authenticated users can read all rows by design (shared workspace).
- All writes must go through `createServerFn` handlers; do not add INSERT/UPDATE/DELETE grants to `authenticated` without a per-row policy.
- How to safely add a new table (the four-step CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY pattern).

Also add a project memory entry so future agent work won't quietly add `GRANT INSERT TO authenticated` to make a client mutation "just work".

## Out of scope (deliberately)

- Per-user/per-role ownership scoping on `claims` and children. You said you don't want to stop users from seeing each other's claims, so no `created_by` column, no role-gated policies.
- Anonymous auth, password HIBP, or other auth-provider settings.
- Audit-log write policies (already write-only via server functions).

## Confirm before I switch to build mode

1. OK to fully block direct client writes? (I checked: claim mutations go through `claim-actions.functions.ts` server fns, so this should be safe — but worth confirming you haven't added direct `supabase.from(...).insert()` calls in components I haven't seen.)
2. Should `profiles` keep a path for users to edit their own display name from the client (→ add `GRANT UPDATE ON public.profiles TO authenticated`)? Or are profile edits also routed through a server function?
