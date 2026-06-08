## Problem

When generating claim images, the Lovable AI Gateway sometimes returns a successful `image_generation.completed` SSE event with `output_tokens: 0` and **no `b64_json`** — i.e. the model (e.g. `google/gemini-3.1-flash-image-preview`) accepted the request but produced no image, typically a safety-style refusal or a model-side failure.

Today's parser in `src/lib/stream-image.ts` only marks the stream as "completed" when an event carries a `b64_json` field. With no `b64_json` arriving at all, `sawFinal` stays `false`, `lastDataUrl` stays empty, and we throw the generic:

> Image stream ended without completion

That bubbles up as a red toast and the user has no idea what happened or what to do about it.

## Fix

Make the SSE parser distinguish "stream ended early / network issue" from "model returned no image", and surface a useful message in the latter case.

### Change `src/lib/stream-image.ts`

- Track whether we received an `image_generation.completed` event at all, independent of whether it carried `b64_json`.
- If the stream ends with a `completed` event but zero image frames were ever delivered, throw a specific error:
  `"The image model returned no image (it may have refused the prompt). Try again, rephrase the prompt, or pick a different model."`
- Keep the existing fallback that promotes the last partial frame to final when the upstream cuts off mid-stream.
- Keep the existing generic error only for the true "stream cut off with nothing at all" case.

### No other changes

- No server route changes (the upstream behavior is correct; we just need to interpret it).
- No UI changes beyond the improved toast text that already comes from the thrown error message in `claims.$id.tsx` (`toast.error(e instanceof Error ? e.message : ...)`).

## Technical notes

- The relevant SSE shape we saw:
  ```
  event: image_generation.completed
  data: {"type":"image_generation.completed","usage":{"output_tokens":0,...}}
  ```
- Detection rule: `eventName === "image_generation.completed"` AND no `b64_json` ever observed (no partials, no final).
- Files touched: `src/lib/stream-image.ts` only.
