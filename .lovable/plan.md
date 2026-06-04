## Problem

`AuditTimeline` reads from the `["claim-audit", claimId]` React Query cache. The server functions (`addLineItem`, `editLineItem`, `updateClaim`, `updateAssessmentSummary`, `replaceClaimImages`, `setAssessmentFeedback`, `submitForApproval`, `deleteClaim`) write audit rows on the server, but no client code invalidates that query, so the cached "Activity (0)" stays stale until a hard reload.

## Fix

In `src/routes/_authenticated/claims.$id.tsx`:

1. Grab `useQueryClient()` once inside `ClaimDetail`.
2. Add a tiny helper `refreshActivity = () => queryClient.invalidateQueries({ queryKey: ["claim-audit", id] })`.
3. Call `refreshActivity()` right after every action that the server logs to `audit_log`:
   - Add line item (`onSave` in `AddLineItemDialog`)
   - Edit line item (existing edit `onSave`)
   - Delete line item (the inline trash-button handler)
   - Update claim fields (claim edit save)
   - Update assessment summary (`SummaryEditor` save)
   - Replace claim images
   - Thumbs up/down feedback (`setFeedback` handlers)
   - Submit for approval
   - Run/re-run AI analysis (creates `claim_created` / assessment rows that should appear)

No schema, no realtime, no new component — just cache invalidation alongside the existing `refetchItems()` / `refetchAssessment()` calls.

## Out of scope

- Supabase realtime subscription on `audit_log` (heavier, not needed for single-user edits).
- Backfilling activity for historical claims.
