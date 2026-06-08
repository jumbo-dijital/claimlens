Generate a 1024×1024 PNG app icon for ClaimLens and deliver it as a downloadable artifact.

## What I'll do

1. Use the image generator (premium quality, opaque background) to produce a polished ClaimLens icon:
   - Stylized scan-eye / lens mark on the brand blue (`#3b82f6`)
   - Solid background (no transparency — Lovable's app icon slot expects an opaque square)
   - Centered, generous padding so it survives rounded-corner masking
   - No text (app icons render small; the wordmark would be illegible)
2. Save to `/mnt/documents/claimlens-icon-1024.png`
3. QA it by inspecting the rendered image, regenerate if the composition is off
4. Surface it via a `<presentation-artifact>` tag so you can download it

## Notes

- 1024×1024 is the master size Lovable uses; it downsamples for smaller slots.
- No code changes to the project — this is a one-off artifact, not a favicon swap. If you later want it wired in as the site favicon / `apple-touch-icon`, that's a separate step.