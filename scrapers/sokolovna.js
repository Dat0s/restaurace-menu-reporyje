const cheerio = require('cheerio');

async function scrapeSokolovna() {
  const res = await fetch('https://reporyjskasokolovna.cz/');
  const html = await res.text();
  const $ = cheerio.load(html);

  const nextDataScript = $('#__NEXT_DATA__').html();
  if (!nextDataScript) throw new Error('__NEXT_DATA__ not found');

  const nextData = JSON.parse(nextDataScript);
  const { menu, sections, categories } = nextData.props.app;

  // Find lunch menu sections (hurl contains "poledni-menu")
  const lunchSections = sections.filter(s =>
    s.hurl && s.hurl.toLowerCase().includes('poledni-menu')
  );

  if (lunchSections.length === 0) {
    return {
      name: 'Řeporyjská Sokolovna',
      source: 'https://reporyjskasokolovna.cz/',
      menuDate: 'Polední menu nenalezeno',
      scrapedAt: new Date().toISOString(),
      sections: []
    };
  }

  const sectionId = lunchSections[0]._id;

  // Get menu items for the lunch section
  const lunchItems = menu.filter(item =>
    item.section === sectionId && item.available !== false
  );

  // Build category map
  const catMap = {};
  if (categories) {
    for (const c of categories) {
      catMap[c._id] = c.name;
    }
  }

  // Group items by category
  const grouped = {};
  for (const item of lunchItems) {
    const catName = catMap[item.category] || 'Ostatní';
    if (!grouped[catName]) grouped[catName] = [];

    // Clean item name — remove prefixes like "PA-M1 :", "DEZ :", "PO-PA :", "PA-MIN SL ", "T2 :"
    // Some prefixes use ":" separator, some use just spaces with all-caps prefix
    let cleanName = item.name.replace(/^[A-ZÁ-Ž0-9][\w\s\-]*?:\s*/i, '').trim();
    // Remove remaining all-caps prefixes without colon (e.g. "PA-MIN SL Steak...")
    cleanName = cleanName.replace(/^[A-Z][A-Z0-9\-]+(?:\s+[A-Z]{1,3})?\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž])/, '').trim();

    // Price is in haléře (3900 = 39 Kč)
    const priceKc = Math.round(item.price / 100);

    grouped[catName].push({
      name: cleanName,
      price: priceKc + ' Kč'
    });
  }

  // Clean section titles: strip "POLEDNÍ MENU -" prefix, keep the rest
  const result = Object.entries(grouped).map(([title, items]) => {
    let clean = title.replace(/^POLEDNÍ MENU\s*-\s*/i, '').trim();
    return { title: clean || title, items };
  });

  // Section name contains the day info (e.g. "Polední menu-Pátek")
  const rawDate = lunchSections[0].name || '';
  // Extract just the day part: "Polední menu-Pátek" → "Pátek"
  const menuDate = rawDate.replace(/^polední\s+menu\s*-?\s*/i, '').trim() || rawDate;

  return {
    name: 'Řeporyjská Sokolovna',
    source: 'https://reporyjskasokolovna.cz/',
    phone: '+420 731 484 493',
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections: result
  };
}

module.exports = { scrapeSokolovna };
