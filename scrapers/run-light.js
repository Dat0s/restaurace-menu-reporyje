const { scrapeKavarna } = require('./kavarna');
const { scrapeSokolovna } = require('./sokolovna');
const { scrapePivovar } = require('./pivovar');
const { readData, writeData, upsertRestaurant } = require('./utils');

async function main() {
  const data = readData();

  const scrapers = [
    { name: 'Kavárna na Náměstí', fn: scrapeKavarna },
    { name: 'Řeporyjská Sokolovna', fn: scrapeSokolovna },
    { name: 'Pivovar Řeporyje', fn: scrapePivovar }
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

  data.restaurants.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  writeData(data);
  console.log('Data saved to menu-data.json');
}

main().catch(e => { console.error(e); process.exit(1); });
