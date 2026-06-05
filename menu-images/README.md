# menu-images/

Manual fallback for restaurants whose menu is only published as a weekly image on
Facebook/Instagram, which GitHub Actions cannot scrape reliably (Meta blocks the
runner's datacenter IP).

## How it works

Each 15-minute scrape first tries the automated social-media scrape. If that fails
(it usually will), the scraper OCRs the image it finds here instead. If there's no
image either, it shows the "look on Facebook/Instagram" fallback card.

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
