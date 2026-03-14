const cheerio = require('cheerio');

async function scrapeKavarna() {
  const res = await fetch('https://kavarnananamesti.cz/');
  const html = await res.text();
  const $ = cheerio.load(html);

  // Structure: #Menu container has col-md-6 columns
  // Each column starts with span.menu-header (section name or date)
  // Followed by ul with li > div.linewrapper containing .text-upper divs (name, price)

  // First menu-header is the date (e.g. "Sobota 14. 3.")
  const firstHeader = $('span.menu-header').first().text().trim();
  const menuDate = firstHeader || 'Datum nenalezeno';

  const sections = [];
  let currentSection = null;

  // Iterate through all menu-header spans and their following ul lists
  $('span.menu-header').each((_, headerEl) => {
    const title = $(headerEl).text().trim();

    // Skip if this looks like a date (first section header) - use it as overall date
    // but also create a section for its items
    const sectionName = title;

    // Find the next ul sibling after this header
    const $col = $(headerEl).parent().is('div') ? $(headerEl).closest('.col-md-6, [class*=col-]') : $(headerEl).parent();
    const items = [];

    // Get the ul that follows this header within the same column
    let $ul = $(headerEl).nextAll('ul').first();
    // If header is not direct sibling of ul, try through hr
    if (!$ul.length) {
      $ul = $(headerEl).next('hr').length ? $(headerEl).next('hr').nextAll('ul').first() : $();
    }

    $ul.find('li').each((_, li) => {
      const textUpper = $(li).find('.text-upper, .text-upper');
      if (textUpper.length >= 2) {
        const name = $(textUpper[0]).text().trim();
        const price = $(textUpper[textUpper.length - 1]).text().trim();
        if (name && price) {
          items.push({ name, price: price.replace(',-', ' Kč') });
        }
      }
    });

    // Filter out non-food sections
    const excluded = ['malá jídla', 'dezerty', 'káva', 'alkoholické nápoje', 'nealkoholické nápoje'];
    if (items.length > 0 && !excluded.some(e => sectionName.toLowerCase().includes(e))) {
      sections.push({ title: sectionName, items });
    }
  });

  return {
    name: 'Kavárna na Náměstí',
    source: 'https://kavarnananamesti.cz/#Menu',
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections
  };
}

module.exports = { scrapeKavarna };
