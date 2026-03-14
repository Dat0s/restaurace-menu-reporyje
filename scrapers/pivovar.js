const cheerio = require('cheerio');

async function scrapePivovar() {
  const res = await fetch('https://pivovarfood.cz/menu');
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  const seenNames = new Set();

  // Menu items are in containers with class containing "list-with-media__text-top"
  // Each container has item name + price concatenated, price matches "NNN,-"
  // Also try broader approach: find any element whose text has name + price pattern

  $('[class*="list-with-media__text-top"]').each((_, el) => {
    const text = $(el).text().trim();
    // Split name from price — price is at the end: "NNN,-" or "NNN,-/NNN,-"
    const match = text.match(/^(.+?)(\d{1,3},-(?:\/\d{1,3},-)?)$/);
    if (match) {
      const name = match[1].trim();
      const price = match[2];
      // Skip broken items: name too short, just a number, or price suspiciously low
      if (name && name.length > 3 && !/^\d+$/.test(name) && !seenNames.has(name)) {
        seenNames.add(name);
        items.push({
          name,
          price: price.replace(/,-/g, ' Kč').replace('/', ' / ')
        });
      }
    }
  });

  // Fallback: broader regex search on all leaf elements
  if (items.length < 5) {
    $('*').each((_, el) => {
      const $el = $(el);
      if ($el.children().length > 2) return;
      const text = $el.text().trim();
      if (text.length > 10 && text.length < 250) {
        const match = text.match(/^(.+?)\s+(\d{1,3},-(?:\/\d{1,3},-)?)$/);
        if (match && !seenNames.has(match[1].trim())) {
          seenNames.add(match[1].trim());
          items.push({
            name: match[1].trim(),
            price: match[2].replace(/,-/g, ' Kč').replace('/', ' / ')
          });
        }
      }
    });
  }

  return {
    name: 'Pivovar Řeporyje',
    source: 'https://pivovarfood.cz/menu',
    menuDate: 'Stálé menu',
    scrapedAt: new Date().toISOString(),
    sections: [{ title: 'Menu', items }]
  };
}

module.exports = { scrapePivovar };
