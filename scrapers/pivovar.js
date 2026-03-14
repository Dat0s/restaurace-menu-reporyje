const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');

async function scrapePivovar() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.goto('https://pivovarfood.cz/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Scroll to bottom to trigger all lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 3000));
    // Scroll back up near the menu section
    await page.evaluate(() => {
      const catering = document.getElementById('catering');
      if (catering) catering.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Find the daily menu image (dynamic Weblium resource group)
    const imageUrl = await page.evaluate(() => {
      const allSources = Array.from(document.querySelectorAll('img, source'));
      const dynamicImgs = allSources
        .map(el => el.src || el.srcset || '')
        .filter(src => src.includes('6685145de189dbc54c372591'))
        .filter(src => src.includes('_optimized'));

      if (dynamicImgs.length > 0) {
        let url = dynamicImgs[dynamicImgs.length - 1];
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.endsWith('.webp') && !url.endsWith('.jpg') && !url.endsWith('.png')) url += '.webp';
        return url;
      }

      const staticPrefix = '6413298202c80a000d678238';
      const otherImgs = allSources
        .map(el => el.src || el.srcset || '')
        .filter(src => src.includes('res2.weblium.site') && !src.includes(staticPrefix) && src.length > 20);

      if (otherImgs.length > 0) {
        let url = otherImgs[0];
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.endsWith('.webp') && !url.endsWith('.jpg') && !url.endsWith('.png')) url += '.webp';
        return url;
      }

      return '';
    });

    if (!imageUrl) {
      return fallbackResult();
    }

    // Download image and run OCR
    const imgResponse = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const { data: { text } } = await Tesseract.recognize(imgBuffer, 'ces');

    // Parse OCR text into menu items
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Pre-process: strip allergen info like (1,7,9) and clean up
    const lines = rawLines.map(l => l.replace(/\s*\([0-9,\s]+\)\s*/g, '').trim()).filter(l => l.length > 0);

    // Try to extract date from header line (e.g. "Polední menu 14.03.2026")
    let menuDate = 'Polední menu';
    for (const line of lines) {
      const dateMatch = line.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/);
      if (dateMatch) {
        menuDate = line.replace(/\s+/g, ' ');
        break;
      }
    }

    // Lines to skip: headers, footers, garbage OCR artifacts
    const skipPatterns = [
      /^(polední\s+menu|obědové|pivovar|restaurace)/i,
      /přeje.*chuť/i,
      /od\s+\d{1,2}:\d{2}/i,
      /^\d{1,2}:\d{2}\s/,
      /^[v»\-\d\s]{1,8}$/,
      /^dd$/i,
      /pivovar/i,
    ];

    function shouldSkip(line) {
      if (line === menuDate) return true;
      return skipPatterns.some(p => p.test(line));
    }

    // Extract items with prices
    const items = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (shouldSkip(line)) continue;

      // Skip "Dezerty:" header but keep dessert items
      if (/^dezert[yí]?\s*:?\s*$/i.test(line)) continue;

      // Match: "Item name 60Kč" or "Item name 155 Kč" (price at end, with or without space)
      const priceInLine = line.match(/^(.+?)\s+(\d+)\s*[Kk][čc]\s*$/);
      if (priceInLine) {
        const name = priceInLine[1].replace(/[.\-–—,]+$/, '').trim();
        if (name.length > 2) {
          items.push({ name, price: priceInLine[2] + ' Kč' });
        }
        continue;
      }

      // Standalone price line like "170Kč" or "170 Kč" - attach to previous item
      const standalonePrice = line.match(/^(\d+)\s*[Kk][čc]\s*$/);
      if (standalonePrice && items.length > 0 && !items[items.length - 1].price) {
        items[items.length - 1].price = standalonePrice[1] + ' Kč';
        continue;
      }

      // Check if next line is a standalone price - then this line is the item name
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextIsPrice = /^\d+\s*[Kk][čc]\s*$/.test(nextLine);

      if (nextIsPrice && line.length > 3) {
        items.push({ name: line.replace(/[.\-–—,]+$/, '').trim(), price: '' });
        continue;
      }

      // Regular food item line (longer text, likely a dish name)
      if (line.length > 5 && /[a-záčďéěíňóřšťúůýž]/i.test(line)) {
        items.push({ name: line.replace(/[.\-–—,]+$/, '').trim(), price: '' });
      }
    }

    // Remove items with no price and very short names (likely OCR noise)
    const cleanItems = items.filter(it => it.price || it.name.length > 10);

    // If OCR produced no usable items, return fallback
    if (cleanItems.length === 0) {
      return fallbackResult();
    }

    const sections = [{ title: 'Polední menu', items: cleanItems }];

    return {
      name: 'Pivovar Řeporyje',
      source: 'https://pivovarfood.cz/#catering',
      menuDate,
      scrapedAt: new Date().toISOString(),
      sections
    };

  } finally {
    await browser.close();
  }
}

function fallbackResult() {
  return {
    name: 'Pivovar Řeporyje',
    source: 'https://pivovarfood.cz/#catering',
    menuDate: 'Polední menu',
    scrapedAt: new Date().toISOString(),
    sections: [{
      title: 'Polední menu',
      items: [{ name: 'Polední menu nebylo nalezeno. Podívejte se na pivovarfood.cz', price: '' }]
    }]
  };
}

module.exports = { scrapePivovar };
