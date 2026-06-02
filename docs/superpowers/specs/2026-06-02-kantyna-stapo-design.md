# Design: Scraper pro Kantýnu STAPO

**Datum:** 2026-06-02  
**Stav:** Schváleno uživatelem

---

## Kontext

Přidání nové restaurace „Kantýna STAPO" do agregátoru obědových menu na reporyje.info. Kantýna zveřejňuje týdenní menu jako obrázek v příspěvcích veřejné Facebook skupiny: https://www.facebook.com/groups/1396911425536833

Příspěvky začínají textem „Polední menu" nebo „Jídelní Lístek". Menu pokrývá celý týden (Po–Pá), obraz je zveřejňován mírně dopředu.

---

## Přístup

Stejný vzor jako `scrapers/svoboda.js` — Puppeteer + Tesseract OCR.

---

## Scraper (`scrapers/kantyna.js`)

### Navigace

1. Puppeteer spustí headless Chromium
2. Otevře `https://www.facebook.com/groups/1396911425536833`
3. Zavře login modal / cookie banner (klik na tlačítka s textem odpovídajícím `/close|dismiss|not now|decline/i`)
4. Scrolluje feed skupiny a hledá příspěvek, jehož viditelný text (popisek) obsahuje `/polední\s*menu|jídelní\s*lístek/i`
5. Z nalezeného příspěvku extrahuje URL obrázku (`img[src*="scontent"]` nebo `img[src*="fbcdn"]`)
6. Stáhne obrázek s hlavičkou `Referer: https://www.facebook.com/`

### OCR a parsování

- Stejné jako Svoboda: `Tesseract.recognize(imgBuffer, 'ces')`
- Validace: text musí obsahovat `/polední\s*menu|jídelní\s*lístek/i`, jinak zkusí další příspěvek
- `parseMenuText()` — totožná logika jako Svoboda:
  - Extrakce data z rozsahu (např. „2.6. – 6.6.")
  - Sekce pojmenované podle dnů (Pondělí–Pátek)
  - Položky: název + cena (volitelná)
  - Quality check: pokud nejsou nalezeny denní sekce a položky jsou krátké/málo → `fallbackResult()`

### Fallback

```javascript
{
  name: 'Kantýna STAPO',
  source: 'https://www.facebook.com/groups/1396911425536833',
  menuDate: '',
  sections: [{ title: 'Polední menu', items: [
    { name: 'Menu nebylo nalezeno. Podívejte se na Facebook skupinu Kantýna STAPO', price: '' }
  ]}]
}
```

### Návratové schéma

```javascript
{
  name: 'Kantýna STAPO',
  source: 'https://www.facebook.com/groups/1396911425536833',
  phone: null,          // telefon není znám
  menuDate: '2.6. - 6.6.',
  scrapedAt: new Date().toISOString(),
  sections: [
    { title: 'Pondělí', items: [{ name: '...', price: '...' }] },
    { title: 'Úterý',   items: [...] },
    // ...
  ]
}
```

---

## Integrace

### `scrapers/run-light.js`

Přidat do pole `scrapers` (jako denní menu — **nezahrnovat** do `staticMenu` setu):

```javascript
const { scrapeKantyna } = require('./kantyna');
// ...
{ name: 'Kantýna STAPO', fn: scrapeKantyna },
```

### `docs/script.js`

Kantýna je multi-day restaurace (týdenní menu). Přidat do podmínky `isMultiDay`:

```javascript
var isMultiDay =
  r.name === "Pivovar Řeporyje" ||
  r.name === "Řeznictví Svoboda" ||
  r.name === "Kantýna STAPO";
```

### `docs/style.css`

Přidat barvu hranice pro novou kartu (`.card:nth-child(N)` — N podle pořadí po seřazení, kantýna bude abecedně mezi denními menu).

---

## Co není v rozsahu

- Přihlášení do Facebooku (skupina je veřejná)
- Cachování session cookies mezi scrapováními
- Parsování více obrázků v jednom příspěvku

---

## Rizika

| Riziko                                       | Mitigace                                              |
| -------------------------------------------- | ----------------------------------------------------- |
| Facebook blokuje headless browser            | User-Agent jako běžný prohlížeč (stejné jako Svoboda) |
| Login modal překryje obsah                   | Dismiss stejnou logikou jako Svoboda                  |
| Obrázek vyžaduje session i pro veřejný obsah | Fallback zobrazí odkaz na skupinu                     |
| Facebook změní DOM strukturu feedu           | Selektory je potřeba aktualizovat ručně při výpadku   |
| OCR špatně přečte obrázek                    | Quality check → fallback (stejné jako Svoboda)        |
