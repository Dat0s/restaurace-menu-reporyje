# Kantýna STAPO Scraper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Puppeteer+OCR scraper for Kantýna STAPO (Facebook group, weekly image menu) following the exact same pattern as `scrapers/svoboda.js`.

**Architecture:** Headless Chromium loads the public FB group, finds a post whose text matches "Polední menu"/"Jídelní Lístek", downloads the image, runs Czech OCR, and parses day-named sections (Po–Pá). Garbage-output quality check falls back to a "not found" placeholder rather than preserving stale data.

**Tech Stack:** Node.js, puppeteer, tesseract.js (already in package.json)

---

## File map

| Action | File                    | Change                                                 |
| ------ | ----------------------- | ------------------------------------------------------ |
| Create | `scrapers/kantyna.js`   | New scraper (clone of svoboda.js adapted for Facebook) |
| Modify | `scrapers/run-light.js` | Import + register in scrapers array                    |
| Modify | `docs/script.js`        | Add `'Kantýna STAPO'` to `isMultiDay` condition        |
| Modify | `docs/style.css`        | Add `.card:nth-child(10)` border color                 |

**Sort order after addition** (verified via localeCompare 'cs'):

1. Bistro a Kavárna Na náměstí · 2. Jídelna Pohotovka · **3. Kantýna STAPO** · 4. Pivovar Řeporyje · 5. Řeporyjská Sokolovna · 6. Řeznictví Svoboda · 7. DÖNER KEBAB HOUSE · 8. HQ Pippi Grill · 9. Mama Bowl · 10. Papa Cipolla

---

## Task 1: Create `scrapers/kantyna.js`

**Files:**

- Create: `scrapers/kantyna.js`

- [ ] **Krok 1: Vytvoř soubor se scraperem**

Vytvoř `scrapers/kantyna.js` s tímto obsahem:

```javascript
const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");

async function scrapeKantyna() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );

    // Establish session cookies at facebook.com before navigating to group
    await page.goto("https://www.facebook.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    await page.goto("https://www.facebook.com/groups/1396911425536833", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Dismiss login / cookie / notification dialogs
    try {
      const buttons = await page.$$('button, [role="button"]');
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (
          /not now|dismiss|close|decline|reject|allow|odmítnout|zavřít|přijmout/i.test(
            text,
          )
        ) {
          await btn.click();
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch {}

    // Scroll to trigger lazy-loaded posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 1500));
    }

    const debugInfo = await page
      .evaluate(() => ({
        url: location.href,
        title: document.title,
        articleCount: document.querySelectorAll('[role="article"]').length,
        imgCount: document.querySelectorAll("img").length,
      }))
      .catch(() => ({ error: "evaluate failed" }));
    console.log("  Page state:", JSON.stringify(debugInfo));

    // Find the post whose visible text contains the menu keyword
    const imageUrls = await page.evaluate(() => {
      const articles = Array.from(
        document.querySelectorAll('[role="article"]'),
      );
      for (const article of articles) {
        const text = article.textContent || "";
        if (/polední\s*menu|jídelní\s*lístek/i.test(text)) {
          const imgs = Array.from(article.querySelectorAll("img"));
          return imgs
            .filter((img) => {
              const src = img.src || "";
              return (
                (src.includes("scontent") || src.includes("fbcdn")) &&
                img.width > 100
              );
            })
            .map((img) => img.src);
        }
      }
      return [];
    });

    console.log("  Found", imageUrls.length, "candidate image(s)");

    if (imageUrls.length === 0) {
      console.log("  No menu post found in visible feed, returning null");
      return null;
    }

    for (let idx = 0; idx < imageUrls.length; idx++) {
      const imageUrl = imageUrls[idx];
      console.log(
        "  Trying image",
        idx + 1,
        "/",
        imageUrls.length,
        ":",
        imageUrl.substring(0, 80) + "...",
      );

      const imgResponse = await fetch(imageUrl, {
        headers: {
          Referer: "https://www.facebook.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });

      if (!imgResponse.ok) {
        console.log("  Image download failed:", imgResponse.status);
        continue;
      }

      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      if (imgBuffer.length < 5000) {
        console.log(
          "  Image too small, likely not a menu:",
          imgBuffer.length,
          "bytes",
        );
        continue;
      }

      const {
        data: { text },
      } = await Tesseract.recognize(imgBuffer, "ces");
      console.log("  OCR text length:", text.length);

      if (!/polední\s*menu|jídelní\s*lístek/i.test(text)) {
        console.log("  Menu keyword not found in OCR text, trying next...");
        continue;
      }

      console.log("  Menu keyword confirmed in OCR — parsing");
      return parseMenuText(text);
    }

    console.log("  No usable menu image found");
    return null;
  } finally {
    await browser.close();
  }
}

function parseMenuText(text) {
  const rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = rawLines
    .map((l) => l.replace(/\s*\([0-9,\s]+\)\s*/g, "").trim())
    .map((l) => l.replace(/(\d+)\s*k?[Kk][čcČ]/g, "$1 Kč"))
    .filter((l) => l.length > 0);

  // Extract date range (e.g. "2.6. – 6.6." or "2.6- 6.6.")
  let menuDate = "";
  for (const line of lines) {
    const rangeMatch = line.match(
      /(\d{1,2}\.\d{1,2}\.?)\s*[-–—]\s*(\d{1,2}\.\d{1,2})/,
    );
    if (rangeMatch) {
      menuDate =
        rangeMatch[1].replace(/\.$/, "") +
        ". - " +
        rangeMatch[2].replace(/\.$/, "") +
        ".";
      break;
    }
    const singleMatch = line.match(
      /(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/,
    );
    if (singleMatch) {
      menuDate = singleMatch[1] + "." + singleMatch[2] + "." + singleMatch[3];
      break;
    }
  }

  const dayNames = ["pondělí", "úterý", "středa", "čtvrtek", "pátek"];
  const dayDisplayNames = {
    pondělí: "Pondělí",
    úterý: "Úterý",
    středa: "Středa",
    čtvrtek: "Čtvrtek",
    pátek: "Pátek",
  };

  const skipPatterns = [
    /^(kantýna|stapo)/i,
    /přeje.*chuť/i,
    /dobrou\s+chuť/i,
    /těšíme\s+se/i,
    /objednávk/i,
    /facebook/i,
    /polední\s*menu/i,
    /jídelní\s*lístek/i,
    /^[a-z]{1,4}$/i,
    /^\d{1,2}\.\d{1,2}\.?\s*[-–—]/,
    /^[v»\-\d\s.,]{1,8}$/,
    /^KW\s*\d/i,
    /^K\d+\s*$/i,
  ];

  function shouldSkip(line) {
    return skipPatterns.some((p) => p.test(line));
  }

  const sections = [];
  let currentSection = "Polední menu";
  let currentItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (shouldSkip(line)) continue;

    const lineLower = line.toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž]/gi, "");
    const dayMatch = dayNames.find((d) => lineLower.startsWith(d));
    if (dayMatch) {
      if (currentItems.length > 0) {
        sections.push({ title: currentSection, items: currentItems });
      }
      currentSection = dayDisplayNames[dayMatch] || line;
      currentItems = [];
      continue;
    }

    const priceMatch = line.match(/^(.+?)\s+(\d+)\s*Kč\s*$/);
    if (priceMatch) {
      const name = priceMatch[1].replace(/[.\-–—,]+$/, "").trim();
      if (name.length > 2) {
        currentItems.push({ name, price: priceMatch[2] + " Kč" });
      }
      continue;
    }

    const standalonePrice = line.match(/^(\d+)\s*Kč\s*$/);
    if (
      standalonePrice &&
      currentItems.length > 0 &&
      !currentItems[currentItems.length - 1].price
    ) {
      currentItems[currentItems.length - 1].price = standalonePrice[1] + " Kč";
      continue;
    }

    if (line.length > 10 && /[a-záčďéěíňóřšťúůýž]/i.test(line)) {
      currentItems.push({
        name: line.replace(/[.\-–—,]+$/, "").trim(),
        price: "",
      });
    }
  }

  if (currentItems.length > 0) {
    sections.push({ title: currentSection, items: currentItems });
  }

  for (const s of sections) {
    for (const item of s.items) {
      if (item.name) {
        item.name = item.name.charAt(0).toUpperCase() + item.name.slice(1);
      }
    }
  }

  const cleanSections = sections.filter((s) => s.items.length > 0);

  if (cleanSections.length === 0) return null;

  // Quality check: no day sections + few/short items = OCR garbage → use fallback
  const hasDaySections = cleanSections.some((s) =>
    ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].includes(s.title),
  );
  if (!hasDaySections) {
    const allItems = cleanSections.flatMap((s) => s.items);
    const avgLen =
      allItems.reduce((sum, i) => sum + i.name.length, 0) /
      (allItems.length || 1);
    if (allItems.length < 3 || avgLen < 15) {
      console.log(
        "  OCR result looks like garbage (no day sections, few/short items), using fallback",
      );
      return fallbackResult();
    }
  }

  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: null,
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections: cleanSections,
  };
}

function fallbackResult() {
  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: null,
    menuDate: "",
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Polední menu",
        items: [
          {
            name: "Menu nebylo nalezeno. Podívejte se na Facebook skupinu Kantýna STAPO",
            price: "",
          },
        ],
      },
    ],
  };
}

module.exports = { scrapeKantyna };
```

- [ ] **Krok 2: Ověř syntaxi**

```
node -e "require('./scrapers/kantyna')"
```

Očekávaný výstup: žádná chyba.

- [ ] **Krok 3: Commit**

```
git add scrapers/kantyna.js
git commit -m "feat: add Kantyna STAPO scraper (Facebook + OCR)"
```

---

## Task 2: Registrace v orchestrátoru

**Files:**

- Modify: `scrapers/run-light.js`

- [ ] **Krok 1: Přidej import a záznam do pole scrapers**

Na začátek `scrapers/run-light.js` přidej import vedle ostatních:

```javascript
const { scrapeKantyna } = require("./kantyna");
```

Do pole `scrapers` přidej před `'Pivovar Řeporyje'` (abecední pořadí je zajištěno sortem, pořadí v poli nevadí — ale pro přehlednost řaď za Jídelnu Pohotovka):

```javascript
{ name: 'Kantýna STAPO', fn: scrapeKantyna },
```

Výsledný začátek pole bude:

```javascript
const scrapers = [
  { name: "Bistro a Kavárna Na náměstí", fn: scrapeKavarna },
  { name: "Řeporyjská Sokolovna", fn: scrapeSokolovna },
  { name: "Pivovar Řeporyje", fn: scrapePivovar },
  { name: "Papa Cipolla", fn: scrapePapaCipolla },
  { name: "HQ Pippi Grill", fn: scrapePippiGrill },
  { name: "Jídelna Pohotovka", fn: scrapePohotovka },
  { name: "Řeznictví Svoboda", fn: scrapeSvoboda },
  { name: "Mama Bowl", fn: scrapeMamaBowl },
  { name: "Kantýna STAPO", fn: scrapeKantyna },
  { name: "DÖNER KEBAB HOUSE", fn: scrapeDoner },
];
```

- [ ] **Krok 2: Ověř syntaxi**

```
node -e "require('./scrapers/run-light')" 2>&1 | head -5
```

Očekávaný výstup: žádná chyba (nebo výstup začne scrapeováním, protože `main()` se spustí — to je v pořádku).

- [ ] **Krok 3: Commit**

```
git add scrapers/run-light.js
git commit -m "feat: register Kantyna STAPO in scraper orchestrator"
```

---

## Task 3: Frontend — multi-day a CSS

**Files:**

- Modify: `docs/script.js`
- Modify: `docs/style.css`

- [ ] **Krok 1: Přidej Kantýnu STAPO do isMultiDay v script.js**

Najdi řádek:

```javascript
var isMultiDay =
  r.name === "Pivovar Řeporyje" || r.name === "Řeznictví Svoboda";
```

Změň na:

```javascript
var isMultiDay =
  r.name === "Pivovar Řeporyje" ||
  r.name === "Řeznictví Svoboda" ||
  r.name === "Kantýna STAPO";
```

- [ ] **Krok 2: Přidej 10. barvu karty v style.css**

Za řádek:

```css
.card:nth-child(9) {
  border-left-color: #d35400;
}
```

Přidej:

```css
.card:nth-child(10) {
  border-left-color: #1abc9c;
}
```

- [ ] **Krok 3: Commit**

```
git add docs/script.js docs/style.css
git commit -m "feat: frontend support for Kantyna STAPO (multi-day, card color)"
```

---

## Task 4: Manuální test scraperu

- [ ] **Krok 1: Spusť scraper izolovaně**

```
node -e "const {scrapeKantyna} = require('./scrapers/kantyna'); scrapeKantyna().then(d => console.log(JSON.stringify(d, null, 2))).catch(e => console.error(e.message))"
```

**Úspěch:** JSON s `name: 'Kantýna STAPO'`, sekcemi pojmenovanými po dnech (Pondělí–Pátek) a `menuDate` ve formátu `"2.6. - 6.6."`.

**Fallback (přijatelný výsledek):** Objekt s `sections[0].items[0].name` začínajícím "Menu nebylo nalezeno..." — Facebook blokoval přístup nebo obrázek nebyl dostupný. Scraper funguje správně, web zobrazí odkaz na skupinu.

**Chyba (vyžaduje ladění):** výjimka Node.js / timeout. Zkontroluj konzolový výstup (`Page state:`) a selektory.

- [ ] **Krok 2: Ověř kompletní scrape (všechny restaurace)**

```
npm run scrape
```

Očekáváný výstup: `Scraping Kantýna STAPO...` řádek s `OK: N items` nebo `SKIP: no data`. Žádné ostatní restaurace nesmí selhat.

- [ ] **Krok 3: Commit aktualizovaných dat**

```
git add docs/menu-data.json
git commit -m "data: update menu"
```

---

## Task 5: Push a deploy

- [ ] **Krok 1: Push na GitHub**

```
git push
```

- [ ] **Krok 2: Spusť GitHub Actions ručně**

```
gh workflow run scrape.yml
```

- [ ] **Krok 3: Zkontroluj výstup workflow**

```
gh run list --workflow=scrape.yml --limit=3
```

Počkej na zelený status, pak zkontroluj live web — Kantýna STAPO karta by měla být viditelná jako 3. v pořadí.
