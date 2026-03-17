# Polední menu v Řeporyjích

Agregátor poledních menu restaurací v Řeporyjích. Automaticky stahuje aktuální nabídky každých 15 minut a zobrazuje je na jedné stránce.

**🌐 [dat0s.github.io/restaurace-menu-reporyje](https://dat0s.github.io/restaurace-menu-reporyje/)**

## Restaurace

| Restaurace | Typ menu | Zdroj dat |
|---|---|---|
| Kavárna na Náměstí | Denní | HTML scraping |
| Řeporyjská Sokolovna | Denní | Next.js JSON |
| Pivovar Řeporyje | Denní (po dnech) | OCR z obrázku |
| Jídelna Pohotovka | Denní | JSON API |
| HQ Pippi Grill | Stálé | Statické |
| DÖNER KEBAB HOUSE | Stálé | Statické |
| Papa Cipolla | Stálé | Statické |

## Jak to funguje

```
GitHub Actions (každých 15 min) → Node.js scrapery → menu-data.json → GitHub Pages
```

1. **GitHub Actions** spouští `npm run scrape` podle cronu
2. **Scrapery** stáhnou menu z webů restaurací (HTML, JSON API, OCR)
3. Výsledky se uloží do `docs/menu-data.json`
4. **GitHub Pages** servíruje statický frontend z `/docs`

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
