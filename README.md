# Polední menu v Řeporyjích

Agregátor poledních menu restaurací v Řeporyjích. Automaticky stahuje aktuální nabídky každých 15 minut a zobrazuje je na jedné stránce.

**🌐 [dat0s.github.io/restaurace-menu-reporyje](https://dat0s.github.io/restaurace-menu-reporyje/)**

## Restaurace

| Restaurace           | Typ menu         | Zdroj dat                     |
| -------------------- | ---------------- | ----------------------------- |
| Kavárna na Náměstí   | Denní            | HTML scraping                 |
| Řeporyjská Sokolovna | Denní            | Next.js JSON                  |
| Pivovar Řeporyje     | Denní (po dnech) | OCR z obrázku                 |
| Jídelna Pohotovka    | Denní            | JSON API                      |
| Kantýna STAPO        | Denní (po dnech) | Facebook OCR → ruční obrázek  |
| Řeznictví Svoboda    | Denní (po dnech) | Instagram OCR → ruční obrázek |
| HQ Pippi Grill       | Stálé            | Statické                      |
| DÖNER KEBAB HOUSE    | Stálé            | Statické                      |
| Papa Cipolla         | Stálé            | Statické                      |

## Jak to funguje

```
GitHub Actions (každých 15 min) → Node.js scrapery → menu-data.json → GitHub Pages
```

1. **GitHub Actions** spouští `npm run scrape` podle cronu
2. **Scrapery** stáhnou menu z webů restaurací (HTML, JSON API, OCR)
3. Výsledky se uloží do `docs/menu-data.json`
4. **GitHub Pages** servíruje statický frontend z `/docs`

### Kantýna STAPO a Řeznictví Svoboda

Meta blokuje IP adresy GitHub Actions, takže automatické stahování z Facebooku/Instagramu většinou selže. Scrapery proto používají třístupňový postup:

1. Pokus o automatické stažení (funguje z domácí IP, v CI zpravidla ne)
2. OCR ručně nahraného obrázku z `menu-images/kantyna.jpg` nebo `menu-images/svoboda.jpg`
3. Záložní karta s odkazem na Facebook / Instagram

**Jak aktualizovat menu ručně** (bez PC, bez skriptů):

1. Uložte screenshot týdenního menu z Facebooku (Kantýna) nebo Instagramu @svoboda_reznictvi
2. Na github.com otevřete složku `menu-images/` → _Add file_ → _Upload files_
3. Nahrajte soubor pojmenovaný přesně `kantyna.jpg` nebo `svoboda.jpg` (přepište starý)
4. Do ~15 minut cron obrázek přečte a web se aktualizuje

## Lokální spuštění

```bash
npm ci
npm run scrape
# Otevřete docs/index.html v prohlížeči
```

## Technologie

- **Frontend:** Vanilla JS, statické HTML/CSS
- **Scraping:** Cheerio (HTML), Puppeteer + Tesseract.js (OCR), fetch (JSON API)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions

## Stránka pro

[reporyje.info](https://reporyje.info)
