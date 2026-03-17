async function scrapePohotovka() {
  const res = await fetch('https://pohotovka.cz/menu/menu.json', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://pohotovka.cz/'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch pohotovka menu: ' + res.status);

  const data = await res.json();
  const items = data.items || [];

  // Group by category, skip sold-out items (last === -1 or similar)
  const grouped = {};
  for (const item of items) {
    const cat = item.kategorie || 'Ostatní';
    if (!grouped[cat]) grouped[cat] = [];

    const name = (item.nazev || '').trim();
    const weight = (item.vaha || '').trim();
    const price = item.cena;

    grouped[cat].push({
      name: name + (weight ? ' (' + weight + ')' : ''),
      price: price + ' Kč',
      order: item.poradi || 99
    });
  }

  // Sort items within each category by order
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.order - b.order);
    grouped[cat].forEach(i => delete i.order);
  }

  // Desired section order
  const order = ['Polévky', 'Hlavní jídla', 'Snídaně & svačiny'];
  const sections = [];
  for (const cat of order) {
    if (grouped[cat] && grouped[cat].length > 0) {
      sections.push({ title: cat, items: grouped[cat] });
    }
  }
  // Add any remaining categories
  for (const [cat, catItems] of Object.entries(grouped)) {
    if (!order.includes(cat) && catItems.length > 0) {
      sections.push({ title: cat, items: catItems });
    }
  }

  // Extract date from generated timestamp
  const generated = data.generated_at || '';
  const dateMatch = generated.match(/(\d{4})-(\d{2})-(\d{2})/);
  const menuDate = dateMatch ? dateMatch[3] + '.' + dateMatch[2] + '.' + dateMatch[1] : '';

  return {
    name: 'Jídelna Pohotovka',
    source: 'https://pohotovka.cz/#menu',
    phone: '+420 775 104 350',
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections
  };
}

module.exports = { scrapePohotovka };
