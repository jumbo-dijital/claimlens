## Goal

Capture the requesting browser's IP address and User-Agent string on every new `audit_log` row going forward. No backfill of existing rows.

## Changes

### 1. Database migration

Add two nullable columns to `public.audit_log`:

- `ip_address text` — client IP captured server-side
- `user_agent text` — raw User-Agent header

Nullable so existing rows stay valid and any future row that lacks request context (e.g., a system-initiated cron job) can still insert.

### 2. Shared helper

New file `src/lib/audit-context.server.ts` exporting `getRequestAuditContext()` that uses TanStack's server runtime to read:

- IP via `getRequestIP({ xForwardedFor: true })`
- User-Agent via `getRequestHeader('user-agent')`

Returns `{ ip_address, user_agent }` (either may be `null`).

### 3. Wire helper into every server-side audit insert

All `audit_log` inserts today live in server functions running with `supabaseAdmin`:

- `src/lib/claim-actions.functions.ts` (9 insert sites)
- `src/lib/ai/analyze-claim.functions.ts` (1 insert site)

Each handler calls `getRequestAuditContext()` once at the top, then spreads the result into every `audit_log` insert payload in that handler.

The one client-side reference to `audit_log` (`src/routes/_authenticated/claims.$id.tsx`) is a read-only `SELECT` for the timeline UI — no change needed there.

### 4. Regenerated Supabase types

After the migration runs, `src/integrations/supabase/types.ts` is regenerated automatically, so the new fields become typed on `audit_log` inserts.

## Out of scope

- No backfill of `ip_address` / `user_agent` for existing rows.
- No new UI surface for the new fields (the audit page can be updated in a follow-up if you want them displayed).
- No change to RLS — the new columns inherit the table's existing policy.
