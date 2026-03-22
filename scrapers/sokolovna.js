const cheerio = require('cheerio');

async function fetchNextData(url) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const script = $('#__NEXT_DATA__').html();
  if (!script) throw new Error('__NEXT_DATA__ not found at ' + url);
  return JSON.parse(script).props.app;
}

async function scrapeSokolovna() {
  const isSunday = new Date().getDay() === 0;

  // Fetch all three section pages (each has different menu items in __NEXT_DATA__)
  const [mainData, burgerData, wingData] = await Promise.all([
    fetchNextData('https://reporyjskasokolovna.cz/'),
    fetchNextData('https://reporyjskasokolovna.cz/section:celodenni-burger-menu'),
    fetchNextData('https://reporyjskasokolovna.cz/section:wing-it')
  ]);

  // Build category map from all pages (merge)
  const catMap = {};
  for (const data of [mainData, burgerData, wingData]) {
    if (data.categories) {
      for (const c of data.categories) {
        catMap[c._id] = (c.name || '').trim();
      }
    }
  }

  // Helper: group items by category from a given dataset and section ID
  function groupByCategory(data, sectionId) {
    const items = data.menu.filter(item =>
      item.section === sectionId && item.available !== false
    );
    const grouped = {};
    for (const item of items) {
      const catName = catMap[item.category] || 'Ostatní';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push({
        name: item.name,
        price: Math.round(item.price / 100) + ' Kč'
      });
    }
    return grouped;
  }

  const result = [];

  // --- Polední menu ---
  const lunchSections = mainData.sections.filter(s =>
    s.hurl && s.hurl.toLowerCase().includes('poledni-menu')
  );

  let menuDate = '';
  if (lunchSections.length > 0) {
    const lunchGrouped = groupByCategory(mainData, lunchSections[0]._id);

    // Clean lunch item names (prefixes like "PA-M1 :", "PO-PA :")
    for (const items of Object.values(lunchGrouped)) {
      for (const item of items) {
        let clean = item.name.replace(/^[A-ZÁ-Ž0-9][\w\s\-]*?:\s*/i, '').trim();
        clean = clean.replace(/^[A-Z][A-Z0-9\-]+(?:\s+[A-Z]{1,3})?\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž])/, '').trim();
        item.name = clean;
      }
    }

    for (const [title, items] of Object.entries(lunchGrouped)) {
      let clean = title.replace(/^POLEDNÍ MENU\s*-\s*/i, '').trim();
      result.push({ title: clean || title, items });
    }

    const rawDate = lunchSections[0].name || '';
    menuDate = rawDate.replace(/^polední\s+menu\s*-?\s*/i, '').trim() || rawDate;
  }

  // --- Celodenní burger menu ---
  const burgerSection = burgerData.sections.find(s => s.hurl && s.hurl.includes('burger'));
  if (burgerSection) {
    const burgerGrouped = groupByCategory(burgerData, burgerSection._id);
    const wantedBurger = [
      'BURGER',
      'BURGER SAMOSTATNĚ BEZ HRANOLEK A EXTRA OMÁČKY',
      'MENU Kuřecí speciality',
      'SALÁTY',
      'MOUČNÍK'
    ];
    // Merge BURGER items into the CELODENNÍ BURGER MENU header section
    const burgerItems = burgerGrouped['BURGER'] || [];
    result.push({ title: 'CELODENNÍ BURGER MENU', items: burgerItems });
    for (const cat of wantedBurger.slice(1)) {
      const items = burgerGrouped[cat] || [];
      if (items.length > 0) {
        result.push({ title: cat, items });
      }
    }
  }

  // --- Wing It ---
  const wingSection = wingData.sections.find(s => s.hurl && s.hurl.includes('wing-it'));
  if (wingSection) {
    const wingGrouped = groupByCategory(wingData, wingSection._id);
    const wantedWing = [
      'Wing It! COMBO Menu',
      'Wing It!  Wings Strips Popcorn',
      'Wing It!  Smažený květák'
    ];
    for (const cat of wantedWing) {
      const items = wingGrouped[cat] || [];
      if (items.length > 0) {
        result.push({ title: cat.replace(/\s+/g, ' '), items });
      }
    }
  }

  // On Sundays, prepend "Zavřeno" section
  if (isSunday) {
    result.unshift({
      title: '',
      items: [{ name: 'Na dnes není žádné denní menu', price: '' }]
    });
  }

  return {
    name: 'Řeporyjská Sokolovna',
    source: 'https://reporyjskasokolovna.cz/',
    phone: '+420 731 484 493',
    menuDate: menuDate || 'Polední menu nenalezeno',
    scrapedAt: new Date().toISOString(),
    sections: result
  };
}

module.exports = { scrapeSokolovna };
