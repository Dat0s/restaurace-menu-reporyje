const { scrapeKavarna } = require('./kavarna');
const { scrapeSokolovna } = require('./sokolovna');
const { scrapePivovar } = require('./pivovar');
const { scrapePapaCipolla } = require('./papacipolla');
const { scrapePippiGrill } = require('./pippigrill');
const { scrapeDoner } = require('./donerkebab');
const { scrapePohotovka } = require('./pohotovka');
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
    { name: 'DÖNER KEBAB HOUSE', fn: scrapeDoner }
  ];

  for (const { name, fn } of scrapers) {
    console.log(`Scraping ${name}...`);
    try {
      const result = await fn();
      upsertRestaurant(data, result);
      const totalItems = result.sections.reduce((sum, s) => sum + s.items.length, 0);
      console.log(`  OK: ${totalItems} items`);
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
    }
  }

  // Sort alphabetically, but keep DÖNER KEBAB HOUSE at the end
  data.restaurants.sort((a, b) => {
    const aLast = a.name === 'DÖNER KEBAB HOUSE';
    const bLast = b.name === 'DÖNER KEBAB HOUSE';
    if (aLast) return 1;
    if (bLast) return -1;
    return a.name.localeCompare(b.name, 'cs');
  });
  writeData(data);
  console.log('Data saved to menu-data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
