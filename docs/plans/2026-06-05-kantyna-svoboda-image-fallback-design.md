# Kantýna STAPO & Řeznictví Svoboda — reliable menus via image-upload OCR fallback

**Date:** 2026-06-05

## Problem

Both restaurants publish their lunch menu **only as a weekly image on social media**:

- **Kantýna STAPO** → image in a login-walled Facebook _group_ (`1396911425536833`). No public FB Page, no Instagram. Facebook Groups API was shut down in 2024.
- **Řeznictví Svoboda** → image on Instagram `@svoboda_reznictvi`, login-walled. Own domain dead, not on any CZ menu portal.

Meta hard-blocks GitHub Actions' datacenter IP ranges for profile/group content, regardless of cookies. Verified during research that every free relay/mirror fails: Jina Reader hits the login wall; imginn/picuki/gramhir return Cloudflare 403; greatfon/igram serve empty JS shells. ~20 prior commits fighting this confirm it is not reliably solvable for free from CI.

Result today: both restaurants are permanently stuck on the "Menu nebylo nalezeno" fallback card.

## Key insight

The Tesseract OCR + `parseMenuText` pipeline in both scrapers **already works once an image is in hand**. The only missing input is "the current week's menu image." Menus change ~weekly, so a low-effort manual image drop is acceptable.

## Design

Constraints honored: free, no new accounts, fully hosted (GitHub Actions), no task scheduling on the user's PC.

### Intake folder

New folder `menu-images/` at repo root (kept out of the published `docs/` site). The user uploads `svoboda.jpg` / `kantyna.jpg` (or `.jpeg` / `.png`) via github.com (phone or browser) when the weekly menu changes — no PC, no scheduled task. Replacing the file updates the menu on the next 15-min cron run.

### Per-scraper cascade (svoboda.js, kantyna.js)

Each scraper becomes a 3-tier cascade, in this order:

1. **`tryAutomated()`** — the existing network logic (Instagram fetch/puppeteer for Svoboda; Facebook puppeteer+OCR for Kantýna). Returns a parsed menu object or `null`. Authoritative when it succeeds (freshest data).
2. **`ocrLocalImage(path)`** — only if automation returned `null`. OCRs `menu-images/<name>.{jpg,jpeg,png}` (first match) with the existing Tesseract `ces` recognizer, then runs the existing `parseMenuText`. Returns a menu object or `null`.
3. **`fallbackResult()`** — only if both produced nothing. The current friendly "look on FB/IG" card.

### Refactor required

Both scrapers currently return their `fallbackResult()` the moment automation fails, which prevents any fallback chaining. Split each into:

- `tryAutomated()` returning `null` (not the fallback) on failure, and
- a shared/duplicated `ocrLocalImage(filePath)` helper that reads the local file, validates it is a supported image format (reuse Kantýna's `isSupportedImageFormat`), OCRs it, and calls `parseMenuText`.

`parseMenuText`, `fallbackResult`, and the return schema stay unchanged. The image path resolves via `path.join(__dirname, '..', 'menu-images', ...)` so it is independent of CWD. No change to `run-light.js`, the orchestrator, the JSON schema, or the frontend.

## Non-goals

- No paid scraping APIs, proxies, or new third-party accounts.
- No change to the other 8 scrapers.
- No self-hosted runner / local scheduling.

## Verification

- With no image present: scraper runs `tryAutomated()`, then returns `fallbackResult()` (or a real menu if automation happens to succeed). No crash.
- With a valid menu image in `menu-images/`: when automation returns `null`, the local image is OCR'd and parsed into sections; `menuDate` reflects the date range in the image.
- `npm run scrape` completes and writes `docs/menu-data.json` with both restaurants present.

## What to do when the automatic scraping doesn't work (simplified user runbook)

Automatic scraping of Facebook/Instagram from GitHub Actions will fail most of the time (Meta blocks the server's IP). That is expected. When a menu isn't showing, do this **one manual step** — from a phone or any browser, no PC and no scripts:

1. **Save the menu image** — screenshot the weekly menu from the Facebook group (Kantýna) or the `@svoboda_reznictvi` Instagram post.
2. **Upload it to GitHub** — open the `menu-images/` folder in the repo on github.com → _Add file_ → _Upload files_ → drop the image named exactly `kantyna.jpg` or `svoboda.jpg` (overwrite the old one) → _Commit_.
3. **Wait ~15 min** — the existing cron Action OCRs the image and the site updates. The week's date appears under the restaurant name so freshness is visible.

If no image is uploaded, the card simply shows the "look on Facebook/Instagram" link until one is — nothing breaks.
