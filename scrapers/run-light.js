const { scrapeKavarna } = require('./kavarna');
const { scrapeSokolovna } = require('./sokolovna');
const { scrapePivovar } = require('./pivovar');
const { scrapePapaCipolla } = require('./papacipolla');
const { scrapePippiGrill } = require('./pippigrill');
const { scrapeDoner } = require('./donerkebab');
const { scrapePohotovka } = require('./pohotovka');
const { scrapeSvoboda } = require('./svoboda');
const { readData, writeData, upsertRestaurant } = require('./utils');

async function main() {
  const data = readData();

  const scrapers = [
    { name: 'Bistro a Kavárna Na náměstí', fn: scrapeKavarna },
    { name: 'Řeporyjská Sokolovna', fn: scrapeSokolovna },
    { name: 'Pivovar Řeporyje', fn: scrapePivovar },
    { name: 'Papa Cipolla', fn: scrapePapaCipolla },
    { name: 'HQ Pippi Grill', fn: scrapePippiGrill },
    { name: 'Jídelna Pohotovka', fn: scrapePohotovka },
    { name: 'Řeznictví Svoboda', fn: scrapeSvoboda },
    { name: 'DÖNER KEBAB HOUSE', fn: scrapeDoner }
  ];

  for (const { name, fn } of scrapers) {
    console.log(`Scraping ${name}...`);
    try {
      const result = await fn();
      if (!result) {
        console.log(`  SKIP: no data (keeping previous)`);
        continue;
      }
      upsertRestaurant(data, result);
      const totalItems = result.sections.reduce((sum, s) => sum + s.items.length, 0);
      console.log(`  OK: ${totalItems} items`);
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
    }
  }

  // Sort: daily menu restaurants first (alphabetically), then static menu (alphabetically)
  const staticMenu = new Set(['DÖNER KEBAB HOUSE', 'HQ Pippi Grill', 'Papa Cipolla']);
  data.restaurants.sort((a, b) => {
    const aStatic = staticMenu.has(a.name) ? 1 : 0;
    const bStatic = staticMenu.has(b.name) ? 1 : 0;
    if (aStatic !== bStatic) return aStatic - bStatic;
    return a.name.localeCompare(b.name, 'cs');
  });
  writeData(data);
  console.log('Data saved to menu-data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
