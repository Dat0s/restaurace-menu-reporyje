# Polední menu v Řeporyjích

Agregátor poledních menu restaurací v Řeporyjích. Automaticky stahuje aktuální nabídky každých 15 minut a zobrazuje je na jedné stránce.

**🌐 [jidlo.reporyje.info](https://jidlo.reporyje.info/)**

## Restaurace

| Restaurace           | Typ menu         | Zdroj dat                     |
| -------------------- | ---------------- | ----------------------------- |
| Bistro a Kavárna Na náměstí | Denní     | HTML scraping                 |
| Řeporyjská Sokolovna | Denní            | Next.js JSON                  |
| Pivovar Řeporyje     | Denní (po dnech) | OCR z obrázku                 |
| Jídelna Pohotovka    | Denní            | JSON API                      |
| Kantýna STAPO        | Denní (po dnech) | Facebook OCR → ruční obrázek  |
| Řeznictví Svoboda    | Denní (po dnech) | Instagram OCR → ruční obrázek |
| HQ Pippi Grill       | Stálé            | Statické                      |
| DÖNER KEBAB HOUSE    | Stálé            | Statické                      |
| Papa Cipolla         | Stálé            | Statické                      |
| Mama Bowl            | Stálé            | Statické (ručně přepsané z obrázků) |

## Jak to funguje

```
GitHub Actions (každých 15 min) → Node.js scrapery → menu-data.json → GitHub Pages
```

1. **GitHub Actions** spouští `npm run scrape` podle cronu
2. **Scrapery** stáhnou menu z webů restaurací (HTML, JSON API, OCR)
3. Výsledky se uloží do `docs/menu-data.json`
4. **GitHub Pages** servíruje statický frontend z `/docs`

### Kantýna STAPO a Řeznictví Svoboda

Facebook i Instagram vyžadují přihlášení, proto scrapery používají cookies throwaway účtů (GitHub secrets `FB_COOKIES` / `IG_COOKIES`, návod v [`scrapers/py/README.md`](scrapers/py/README.md)). S platnými cookies funguje stahování i z GitHub Actions; po jejich expiraci spadnou obě restaurace na záložní kartu a je potřeba cookies znovu vyexportovat. Postup má čtyři stupně:

1. Automatické stažení přes puppeteer (s cookies)
2. Python scrapery (facebook-scraper / instaloader)
3. OCR ručně nahraného obrázku z `menu-images/kantyna.jpg` nebo `menu-images/svoboda.jpg`
4. Záložní karta s odkazem na Facebook / Instagram

Jako záloha běží na domácím PC naplánovaná úloha `ReporyjeMenuScrape` (Po/Út/Pá 7–11 h, nastavení `scripts/setup-local-task.ps1`), která stáhne menu z domácí IP, pokud na webu není aktuální.

**Jak aktualizovat menu ručně** (bez PC, bez skriptů):

1. Uložte screenshot týdenního menu z Facebooku (Kantýna) nebo Instagramu @svoboda_reznictvi
2. Na github.com otevřete složku `menu-images/` → _Add file_ → _Upload files_
3. Nahrajte soubor pojmenovaný přesně `kantyna.jpg` nebo `svoboda.jpg` (přepište starý)
4. Do ~15 minut cron obrázek přečte a web se aktualizuje

## Lokální spuštění

```bash
npm ci
pip install -r scrapers/py/requirements.txt   # volitelné, Python stupeň pro FB/IG
npm run scrape
node scripts/prerender.js
# Otevřete docs/index.html v prohlížeči
```

## Technologie

- **Frontend:** Vanilla JS, statické HTML/CSS
- **Scraping:** Cheerio (HTML), Puppeteer + Tesseract.js (OCR), fetch (JSON API)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions

## Stránka pro

[reporyje.info](https://reporyje.info)
