# Steward brand logo

`steward-logo.png` — the mariner's-compass logo, first produced for #158 (Google OAuth consent screen branding). 800×800 PNG, ~789KB — square, above Google's 120×120 minimum, under its 1MB cap.

Built from an 8-point compass rose (bronze bezel, brass rivets, graduated dial) over the app's real wood-grain texture (`artifacts/arlo/public/woodgrain.png`, brightened for legibility), with the "Steward." wordmark set exactly as it appears on the login/header screen (`R.logoText`/`R.logoDot` in `artifacts/arlo/src/pages/Home.tsx` — Calibri stack, 400 weight, parchment `#EEE4C4`, brass `#D8AA3E` glowing dot).

## Files

- `steward-logo.png` — the final exported asset. Use this one.
- `steward-logo.source.html` — the standalone HTML the PNG was rendered from (plain HTML/CSS/SVG, no build step). Open it in a browser, or re-screenshot it (e.g. via Playwright/Chromium at a higher `deviceScaleFactor`) to produce a new export at a different resolution.
- `wood-square.jpg` — the square-cropped, brightened wood-grain background the source HTML references. Re-crop from `artifacts/arlo/public/woodgrain.png` if the app's texture ever changes.

## Provenance

Explored as 6 concepts (compass, shepherd's staff, anchor, monogram, lantern, open book) on a Claude Design canvas before settling on the compass — see #158 for the full discussion and the concept-board link.
