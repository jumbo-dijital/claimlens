# Security model

## Database access posture

This app uses Lovable Cloud (Supabase). The Data API access model is **closed by default**:

| Role | Tables (`public.*`) |
| --- | --- |
| `anon` (browser, no session) | No access — every GRANT revoked. The publishable/anon key in `.env` is inert against the Data API. |
| `authenticated` (signed-in user, via browser) | **SELECT only** on every table. Direct INSERT/UPDATE/DELETE from the browser is rejected. |
| `service_role` (server functions via `supabaseAdmin`) | Full access. Bypasses RLS. |

Row-level security is enabled on every `public` table. SELECT policies allow any authenticated user to read all rows (this is a shared workspace by design — users are expected to see each other's claims, assessments, etc.).

## Where business logic lives

- **All reads** can happen either from the browser via `@/integrations/supabase/client` (subject to RLS + the SELECT grant above), or from server functions.
- **All writes** must go through a `createServerFn` handler. Server functions use either:
  - `requireSupabaseAuth` middleware — acts as the signed-in user (still SELECT-only at the DB level, so this is mostly for reads that need request context), or
  - `supabaseAdmin` from `@/integrations/supabase/client.server` — bypasses RLS, used for mutations after the handler has verified the caller's auth and authorization.

There is no INSERT/UPDATE/DELETE grant to `authenticated`, so a forgotten authorization check in a server function is the *only* path that could lead to an unauthorized write. Server functions must always:

1. Authenticate the caller (`requireSupabaseAuth` or equivalent).
2. Authorize the action against the caller's role (`public.has_role(auth.uid(), 'role')`).
3. Only then perform the write with `supabaseAdmin`.

## Secrets

- The `.env` file contains only publishable values (Supabase project URL, publishable key, project id). It is safe to commit.
- Real secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, third-party API keys) live in the Lovable Cloud secret store and are injected into server functions at runtime as `process.env.*`. They are never bundled into client code and never committed.

## Adding a new table

Follow this exact order in a single migration:

```sql
CREATE TABLE public.my_table (...);
REVOKE ALL ON public.my_table FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.my_table TO authenticated;   -- read-only from the browser
GRANT ALL    ON public.my_table TO service_role;    -- server functions
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read my_table" ON public.my_table
  FOR SELECT TO authenticated USING (true);
```

**Do not** add `GRANT INSERT|UPDATE|DELETE ... TO authenticated` to make a client-side mutation "just work". Move the mutation into a server function instead. Widening direct write access to `authenticated` would expose every row to every signed-in user with no row-level scoping.

If a future feature genuinely needs per-user ownership (e.g. "agents only see their own claims"), add an owner column (e.g. `created_by uuid NOT NULL DEFAULT auth.uid()`) and replace the open `USING (true)` policy with a scoped one **before** granting any write privilege to `authenticated`.

## What this model does *not* protect against

- A bug in a server function that performs a privileged write without checking the caller's role. RLS is not a backstop here because `supabaseAdmin` bypasses it.
- A leaked service-role key. Rotate immediately via Lovable Cloud if exposed.
- Authenticated users reading data they shouldn't see — by design, every signed-in user can read every row. This is acceptable for the current shared-workspace use case; revisit if the product needs per-user privacy.
