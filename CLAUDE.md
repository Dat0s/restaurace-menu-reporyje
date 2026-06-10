# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Restaurant lunch menu aggregator for [reporyje.info](https://reporyje.info). Scrapes 9 local restaurants every 15 minutes via GitHub Actions, stores results as static JSON, and serves a vanilla JS frontend via GitHub Pages.

**Live site:** https://dat0s.github.io/restaurace-menu-reporyje/

## Commands

```bash
npm run scrape          # Run all scrapers, output to docs/menu-data.json
npm ci                  # Install dependencies (clean)
node scripts/check-freshness.js   # Check live site for stale Kantýna/Svoboda menus
node scrapers/run-local.js        # Local-PC scrape of Kantýna+Svoboda (FORCE_SCRAPE=1 skips freshness check)
```

Test a single scraper:

```bash
node -e "const {scrapeKavarna} = require('./scrapers/kavarna.js'); scrapeKavarna().then(d => console.log(JSON.stringify(d, null, 2)))"
```

Trigger GitHub Actions manually:

```bash
gh workflow run scrape.yml
```

## Architecture

```
GitHub Actions (cron */15) → scrapers/run-light.js → docs/menu-data.json → GitHub Pages
```

- **scrapers/** — One file per restaurant, each exports an async function returning a standardized object
- **scrapers/run-light.js** — Orchestrator: runs all scrapers, upserts into JSON, sorts alphabetically (DÖNER KEBAB HOUSE pinned last)
- **scrapers/utils.js** — `readData()`, `writeData()`, `upsertRestaurant()` for docs/menu-data.json
- **docs/** — Static frontend (index.html, script.js, style.css) served by GitHub Pages from /docs on master
- **menu-images/** — Manual fallback intake folder: user uploads `kantyna.jpg` / `svoboda.jpg` weekly via github.com when automated Meta scraping fails

## Scraper Return Schema

Every scraper must return this shape:

```javascript
{
  name: 'Restaurant Name',        // Used as unique key for upsert
  source: 'https://...',          // Link shown in card footer
  phone: '+420 xxx xxx xxx',      // Shown in card footer (optional)
  menuDate: 'Úterý 17. 3.',      // Shown under restaurant name (or '' to hide)
  scrapedAt: new Date().toISOString(),
  sections: [{
    title: 'Section Name',        // e.g. 'Hlavní jídla', 'POLÉVKA'
    items: [{
      name: 'Dish name',
      price: '159 Kč',
      soldOut: true,              // Optional, renders strikethrough red
      link: 'https://...'        // Optional, renders name as clickable link (https only)
    }]
  }]
}
```

## Scraper Types

| Type                                                       | Tool                                                               | Restaurants                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Static HTML (fetch + cheerio)                              | cheerio                                                            | Kavárna na Náměstí, Řeporyjská Sokolovna, Mama Bowl                   |
| JSON API                                                   | fetch                                                              | Jídelna Pohotovka (pohotovka.cz/menu/menu.json, needs Referer header) |
| Dynamic + OCR                                              | puppeteer + tesseract.js                                           | Pivovar Řeporyje (image menu → Czech OCR → text)                      |
| 4-tier cascade (puppeteer → Python → local OCR → fallback) | puppeteer + Python (facebook-scraper / instaloader) + tesseract.js | Kantýna STAPO (Facebook), Řeznictví Svoboda (Instagram)               |
| Hardcoded static                                           | none                                                               | Papa Cipolla, HQ Pippi Grill, DÖNER KEBAB HOUSE                       |

## Adding a New Restaurant

1. Create `scrapers/newrestaurant.js` exporting an async function
2. In `scrapers/run-light.js`: require it, add to the `scrapers` array
3. Add a card border color in `docs/style.css` (`.card:nth-child(N)`)
4. Run `npm run scrape` to verify output
5. Commit scraper + updated menu-data.json

## Frontend Behavior

- Fetches menu-data.json with `cache: 'no-store'` and timestamp cache-bust
- Hides "Polední menu" section title when it's the only section (redundant with page heading)
- Shows sold-out items in red with strikethrough and "Vyprodáno" label
- Items with a `link` field render as `<a href>` (scheme validated to `https?://` before use)
- Auto-refreshes page every 12 hours
- Stale data warning if >24 hours old
- Multi-day restaurants (Kantýna, Svoboda, Pivovar): today's section shown first; rest collapsed behind "Zobrazit celý týden"

## Key Gotchas

- **Kantýna & Svoboda — Meta IP blocking**: GitHub Actions datacenter IPs are hard-blocked by Facebook/Instagram. Scrapers use a 4-tier cascade: `tryAutomated()` → Python tier (`scrapers/py/fb_group_images.py` via facebook-scraper / `ig_profile_images.py` via instaloader, spawned through `scrapers/py-bridge.js`) → `ocrLocalImage()` → `fallbackResult()`. Each tier must return `null` (not the fallback) on failure so the next tier runs.
- **Python tier needs cookies**: the FB group redirects to /login and IG graphql returns 403 without a session — `FB_COOKIES`/`IG_COOKIES` secrets must hold cookies of a throwaway account that is a member of the Kantýna FB group. Setup guide: `scrapers/py/README.md`. Without valid cookies the Python tier fails gracefully and the cascade continues.
- **Freshness guard**: every tier result passes `isMenuFresh(menuDate)` (`scrapers/utils.js`) — menus dated before Monday of the current week are discarded so a stale `menu-images/*.jpg` can never keep last week's menu on the site. Empty/unparseable dates are treated as fresh. `run-light.js` also refuses to copy a stale previous `menuDate` onto a result with an empty date.
- **Stale-menu e-mail alert**: `.github/workflows/notify.yml` (Mon/Tue/Fri ~11:15 Prague) runs `scripts/check-freshness.js` against the live site; if Kantýna/Svoboda is fallback/stale the job exits 1 and GitHub e-mails the owner about the failed run — that's the whole notification mechanism, no SMTP.
- **Local scheduled task**: Windows task `ReporyjeMenuScrape` (Mon/Tue/Fri 7–11 h) runs `scripts/local-scrape.ps1` in a dedicated clone at `%LOCALAPPDATA%\reporyje-menu\repo` — first checks live freshness, scrapes only Kantýna+Svoboda from the residential IP (cookies in `%LOCALAPPDATA%\reporyje-menu\`), pushes `data: update menu (local)`. Setup: `scripts/setup-local-task.ps1` (see `scrapers/py/README.md`). Wed/Thu are skipped (weekly menus don't change midweek).
- **menu-images/ fallback**: When automation returns `null`, the scraper OCRs `menu-images/kantyna.jpg` (or `svoboda.jpg`) using Tesseract `ces`. User replaces the file weekly via github.com upload. File must be JPEG or PNG — magic-byte validated before OCR.
- **Kantýna allergen noise**: `parseMenuText` strips trailing digit sequences from dish lines (allergen column OCR artefacts like "15357" or "13:7") but guards the "CENA POLEDNÍHO MENU NNN" price line so the default price is still extracted.
- **Pivovar OCR**: Daily menu is an image on pivovarfood.cz (Weblium). The scraper scrolls to trigger lazy loading, finds the image by Weblium resource group ID `6685145de189dbc54c372591`, then runs Czech OCR. Day names (Pondělí–Pátek) are parsed as section headers.
- **Sokolovna data path**: Uses `nextData.props.app` (NOT `pageProps.app`). Prices are in haléře (÷100).
- **Pohotovka API**: Requires `User-Agent` and `Referer: https://pohotovka.cz/` headers or returns 401.
- **menu-data.json conflicts**: GitHub Actions commits this file every 15 min. When pushing local changes, expect merge conflicts — resolve by re-running `npm run scrape` after rebase.
- **Sort order**: Czech locale collation via `localeCompare('cs')`, with DÖNER KEBAB HOUSE hardcoded to sort last.

## Language

The UI and all user-facing text is in Czech. Restaurant names, section titles, and item names are Czech.
