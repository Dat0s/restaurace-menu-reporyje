# menu-images/

Manual fallback for restaurants whose menu is only published as a weekly image on
Facebook/Instagram, which GitHub Actions cannot scrape reliably (Meta blocks the
runner's datacenter IP).

## How it works

Each 15-minute scrape walks a 4-tier cascade:

1. Puppeteer scrape of the Facebook group / Instagram profile
2. Python scrape (`facebook-scraper` / `instaloader`, see `scrapers/py/`) using
   the `FB_COOKIES` / `IG_COOKIES` secrets — see `scrapers/py/README.md`
3. OCR of the image uploaded here
4. The "look on Facebook/Instagram" fallback card

Every tier's result is checked for freshness: if the menu date on the image is
from a past week, it is discarded and the cascade continues. A stale image here
therefore no longer keeps last week's menu on the site — it just falls through
to the fallback card until you upload the new one.

## How to update a menu (no PC, no scripts)

1. Save/screenshot the week's menu image from the source:
   - **Kantýna STAPO** → the Facebook group post
   - **Řeznictví Svoboda** → the `@svoboda_reznictvi` Instagram post
2. On github.com, open this `menu-images/` folder → **Add file → Upload files**.
3. Upload the image named exactly:
   - `kantyna.jpg` (or `.jpeg` / `.png`)
   - `svoboda.jpg` (or `.jpeg` / `.png`)
     Overwrite the old file. Commit.
4. Within ~15 minutes the cron OCRs it and the site updates. The week's date shows
   under the restaurant name so you can confirm it's current.

Tips for good OCR: use a sharp, straight, well-lit image; JPEG or PNG only
(no WebP/HEIC). The Czech menu text and the date range are read automatically.
