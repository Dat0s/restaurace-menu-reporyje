const cheerio = require('cheerio');

async function scrapeMamaBowl() {
  const res = await fetch('https://mamabowl.cz/menu');
  const html = await res.text();
  const $ = cheerio.load(html);

  const sections = [];
  let currentSection = null;
  const nameQueue = [];

  $('main').find('h1, h6').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().trim();

    if (!text) return;

    if (tag === 'h1') {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: text.charAt(0).toUpperCase() + text.slice(1), items: [] };
      nameQueue.length = 0;
    } else if (tag === 'h6') {
      if (/^\d+,-$/.test(text)) {
        if (nameQueue.length > 0 && currentSection) {
          const name = nameQueue.shift();
          currentSection.items.push({ name, price: text.replace(',-', ' Kč') });
        }
      } else {
        nameQueue.push(text);
      }
    }
  });

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return {
    name: 'Mama Bowl',
    source: 'https://mamabowl.cz/menu',
    phone: '+420 704 246 868',
    menuDate: '',
    scrapedAt: new Date().toISOString(),
    sections
  };
}

module.exports = { scrapeMamaBowl };
