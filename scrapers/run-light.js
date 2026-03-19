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
    { name: 'Kavárna na Náměstí', fn: scrapeKavarna },
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

  // Sort alphabetically, with pinned restaurants at the end
  const pinOrder = { 'Řeporyjská Sokolovna': 1, 'HQ Pippi Grill': 2, 'DÖNER KEBAB HOUSE': 3, 'Papa Cipolla': 4 };
  data.restaurants.sort((a, b) => {
    const aPin = pinOrder[a.name] || 0;
    const bPin = pinOrder[b.name] || 0;
    if (aPin !== bPin) return aPin - bPin;
    return a.name.localeCompare(b.name, 'cs');
  });
  writeData(data);
  console.log('Data saved to menu-data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
