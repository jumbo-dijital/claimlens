# Add real auth + role-based authorization

Replace the client-side persona switcher with real Supabase email/password authentication, and enforce roles server-side on every mutation and the AI image-generation endpoint. This closes both security findings (open image-gen endpoint + client-trusted personaId) and protects the audit log and claim data.

## 1. Database

New migration:

- `profiles` table — `id uuid PK references auth.users on delete cascade`, `display_name`, `avatar_color`, timestamps. RLS: users select/update their own row. Trigger on `auth.users` insert auto-creates a profile.
- `app_role` enum: `agent | adjuster | superadmin`.
- `user_roles` table — `(user_id, role)` unique, FK to `auth.users`. RLS: authenticated can SELECT their own roles. No client writes.
- `has_role(_user_id uuid, _role app_role)` SECURITY DEFINER function.
- Migrate existing `personas` data: keep the table for display metadata (name, email, color) but drop reliance on it for authorization. Seed 3 demo auth users (agent / adjuster / superadmin) via a one-time SQL block using `auth.users` (documented credentials shown in the UI sign-in page for the demo).
- Tighten RLS on `claims`, `claim_images`, `ai_assessments`, `assessment_line_items`, `reviews`, `audit_log`: drop the current `SELECT … using(true)` anon policies; replace with `TO authenticated USING (true)` (all signed-in staff can read claims data — appropriate for an insurance back-office app). Keep `repair_catalog` readable by authenticated only. Revoke all access from `anon`.

## 2. Auth integration

- Use the Lovable Supabase integration's managed `_authenticated/route.tsx` gate (client-rendered, redirects to `/auth`).
- Build `/auth` route: email + password sign-in form (sign-up disabled — demo accounts are pre-seeded). Show the three demo credentials on the page for easy testing.
- Move every existing route (`/`, `/claims/$id`, `/claims/$id/review`, `/audit`, `/admin/generate`) under `src/routes/_authenticated/`.
- Register `attachSupabaseAuth` in `src/start.ts` `functionMiddleware` (verify it's already there; the scaffold sets this up).
- Root `__root.tsx`: add the `onAuthStateChange` listener that invalidates router + query cache.
- Replace `persona-store.ts` (zustand+localStorage) with a hook that reads the current user + roles from a `getMe` server fn (cached via React Query). `AppHeader` shows the signed-in user and a sign-out button instead of the persona switcher.

## 3. Server-side role enforcement

Add a `requireRole(...roles)` helper that builds on `requireSupabaseAuth`, looks up `user_roles` via `supabaseAdmin`, and throws on mismatch. Apply per function:

- `analyzeClaim` → agent, adjuster, or superadmin
- `editLineItem`, `submitForApproval` → agent or superadmin (and verify the claim is assigned to them, or they are superadmin)
- `reviewClaim` → adjuster or superadmin
- `createSyntheticClaim` → superadmin
- All `audit_log` inserts use the authenticated `userId` as `actor_persona_id` — no more client-supplied IDs.

Remove every `personaId` parameter from server fn input validators.

## 4. Lock down the image-generation endpoint

Rewrite `src/routes/api/generate-damage-image.ts` as `/api/generate-damage-image` with:

- Extract bearer from `Authorization` header, validate via `supabase.auth.getClaims`, look up role — reject if not `superadmin`.
- Hard-coded model allowlist: only `google/gemini-3.1-flash-image-preview` accepted; ignore client `model`.
- Zod validation on prompt (length cap 2000 chars).
- The client (`admin.generate.tsx`) attaches the access token from `supabase.auth.getSession()` when calling the endpoint.

## 5. UI cleanup

- Delete persona-switcher UI, `usePersonaStore`, and any UI gating that referenced it.
- Gate nav links and action buttons on the current user's roles (from `getMe`).
- `/admin/generate` only linked for superadmin.
- `/claims/$id/review` only linked for adjuster/superadmin.

## 6. Verification

- Manual smoke test: sign in as each demo user, confirm each role can only perform allowed actions; confirm `/api/generate-damage-image` returns 401 without a valid superadmin token.
- Re-run security scan; both findings should clear.

## Technical notes

- The `personas` table stays only as a display catalog; it's no longer the source of authorization truth. We can drop `actor_persona_id` columns later, but for this change we set them to the authenticated user's id (treating `auth.users.id` and `personas.id` as parallel) or repoint `actor_user_id uuid references auth.users` in the same migration — cleaner. I'll do the latter and update audit reads accordingly.
- Email auto-confirm will be enabled for the demo so the three seeded accounts can sign in without verification mail.

Want me to proceed, or adjust the role matrix (e.g. let adjusters also create synthetic claims, or have a separate "viewer" role)?
