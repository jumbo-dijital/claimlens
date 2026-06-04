Re-order the AddLineItemDialog form fields and update one label.

1. In `src/routes/_authenticated/claims.$id.tsx`, within `AddLineItemDialog`:
   - Move the "Rationale (required)" `Textarea` block (currently after the estimate/Part cost row) to directly below the "Severity" `Select` block.
   - Keep the "Look up estimate" button and the conditional "Part cost / Labour hours" row at the bottom of the form, just above `DialogFooter`.
   - Change the label for the Part cost input from `"Part cost"` to `"Part cost ($ USD)"`.

No other changes needed — this is a layout-only edit in one component.