const { scrapeKavarna } = require("./kavarna");
const { scrapeSokolovna } = require("./sokolovna");
const { scrapePivovar } = require("./pivovar");
const { scrapePapaCipolla } = require("./papacipolla");
const { scrapePippiGrill } = require("./pippigrill");
const { scrapeDoner } = require("./donerkebab");
const { scrapePohotovka } = require("./pohotovka");
const { scrapeSvoboda } = require("./svoboda");
const { scrapeMamaBowl } = require("./mamabowl");
const { scrapeKantyna } = require("./kantyna");
const {
  readData,
  writeData,
  upsertRestaurant,
  isMenuFresh,
} = require("./utils");

// Undated posters (e.g. Svoboda after a holiday) have an empty menuDate, so
// freshness is judged by when the menu was scraped: since this week's Monday.
function scrapedThisWeek(scrapedAt, now = new Date()) {
  const t = new Date(scrapedAt);
  if (isNaN(t)) return false;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return t >= monday;
}

async function main() {
  const data = readData();

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

  for (const { name, fn } of scrapers) {
    console.log(`Scraping ${name}...`);
    try {
      const result = await fn();
      if (!result) {
        console.log(`  SKIP: no data (keeping previous)`);
        continue;
      }
      if (!result.sections || result.sections.length === 0) {
        console.log(`  SKIP: empty sections (keeping previous)`);
        continue;
      }
      // A fallback card must never replace a real menu that is still fresh —
      // e.g. a CI run where Meta blocks everything must not wipe out a menu
      // scraped successfully earlier the same week
      if (result.isFallback) {
        const existing = data.restaurants.find((r) => r.name === result.name);
        if (
          existing &&
          !existing.isFallback &&
          (existing.menuDate
            ? isMenuFresh(existing.menuDate)
            : scrapedThisWeek(existing.scrapedAt))
        ) {
          console.log(`  SKIP: fallback card (keeping fresh previous menu)`);
          continue;
        }
      }
      // Preserve previous menuDate if new scrape has empty date —
      // but never resurrect a date from a past week onto a fresh result
      if (!result.menuDate) {
        const existing = data.restaurants.find((r) => r.name === result.name);
        if (existing && existing.menuDate && isMenuFresh(existing.menuDate)) {
          result.menuDate = existing.menuDate;
        }
      }
      upsertRestaurant(data, result);
      const totalItems = result.sections.reduce(
        (sum, s) => sum + s.items.length,
        0,
      );
      console.log(`  OK: ${totalItems} items`);
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
    }
  }

  // Sort: daily menu restaurants first (alphabetically), then static menu (alphabetically)
  const staticMenu = new Set([
    "DÖNER KEBAB HOUSE",
    "HQ Pippi Grill",
    "Mama Bowl",
    "Papa Cipolla",
  ]);
  data.restaurants.sort((a, b) => {
    const aStatic = staticMenu.has(a.name) ? 1 : 0;
    const bStatic = staticMenu.has(b.name) ? 1 : 0;
    if (aStatic !== bStatic) return aStatic - bStatic;
    return a.name.localeCompare(b.name, "cs");
  });
  writeData(data);
  console.log("Data saved to menu-data.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
