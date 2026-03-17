const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');

async function scrapeSvoboda() {
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

    await page.goto('https://www.instagram.com/svoboda_reznictvi/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Dismiss cookie consent dialog if present
    try {
      const cookieBtn = await page.waitForSelector(
        'button[tabindex="0"]:not([type="submit"])',
        { timeout: 5000 }
      );
      if (cookieBtn) {
        // Look for "Decline optional cookies" or "Allow all cookies" type buttons
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (/decline|reject|odmítnout|only.*essential/i.test(text)) {
            await btn.click();
            break;
          }
        }
        // If no decline found, try "Allow all" to dismiss
        if (await page.$('[role="dialog"]')) {
          for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (/allow all|accept|přijmout|souhlasím/i.test(text)) {
              await btn.click();
              break;
            }
          }
        }
      }
    } catch {
      // No cookie dialog, continue
    }

    await new Promise(r => setTimeout(r, 3000));

    // Extract the first (newest) image from the Instagram grid
    const imageUrl = await page.evaluate(() => {
      // Instagram grid images are inside article elements
      const imgs = Array.from(document.querySelectorAll('article img, main img'));
      for (const img of imgs) {
        const src = img.src || '';
        // Skip profile pictures (small) and icons
        if (src && src.includes('instagram') && !src.includes('s150x150') && !src.includes('44x44')) {
          return src;
        }
      }
      // Fallback: try any img with scontent in URL (Instagram CDN)
      const allImgs = Array.from(document.querySelectorAll('img'));
      for (const img of allImgs) {
        const src = img.src || '';
        if (src.includes('scontent') && img.width > 200) {
          return src;
        }
      }
      return '';
    });

    if (!imageUrl) {
      return fallbackResult();
    }

    // Download image with Instagram referer
    const imgResponse = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://www.instagram.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    // Run Czech OCR
    const { data: { text } } = await Tesseract.recognize(imgBuffer, 'ces');

    // Parse OCR text into menu items
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Pre-process: fix OCR artifacts in prices (e.g. "39kKč" → "39 Kč", "139Kč" → "139 Kč")
    // Also strip allergen numbers like (1,7,9) and standalone numbers like "1,10" or "1.27"
    const lines = rawLines
      .map(l => l.replace(/\s*\([0-9,\s]+\)\s*/g, '').trim())
      .map(l => l.replace(/(\d+)\s*k?[Kk][čcČ]/g, '$1 Kč'))
      .filter(l => l.length > 0);

    // Try to extract date range from header (e.g. "16.3. - 20.3. KW 4")
    let menuDate = '';
    for (const line of lines) {
      const rangeMatch = line.match(/(\d{1,2}\.\d{1,2}\.)\s*-\s*(\d{1,2}\.\d{1,2}\.)/);
      if (rangeMatch) {
        menuDate = rangeMatch[1] + ' - ' + rangeMatch[2];
        break;
      }
      const singleMatch = line.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/);
      if (singleMatch) {
        menuDate = singleMatch[1] + '.' + singleMatch[2] + '.' + singleMatch[3];
        break;
      }
    }

    // Day names to detect as section headers
    const dayNames = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek'];
    const dayDisplayNames = {
      'pondělí': 'Pondělí', 'úterý': 'Úterý', 'středa': 'Středa',
      'čtvrtek': 'Čtvrtek', 'pátek': 'Pátek'
    };

    // Lines to skip: header garbage, date lines, OCR noise
    const skipPatterns = [
      /^(řeznictví|svoboda|maso|masna)/i,
      /přeje.*chuť/i,
      /dobrou\s+chuť/i,
      /těšíme\s+se/i,
      /objednávk/i,
      /instagram/i,
      /denn[ií]\s*menu/i,
      /^[a-z]{1,4}$/i,                     // Short garbage like "MY", "4NIc"
      /^\d{1,2}\.\d{1,2}\.\s*-/,           // Date range lines
      /^[v»\-\d\s.,]{1,8}$/,               // Standalone numbers/punctuation
      /^KW\s*\d/i,                          // "KW 4" week number
    ];

    function shouldSkip(line) {
      return skipPatterns.some(p => p.test(line));
    }

    const sections = [];
    let currentSection = 'Polední menu';
    let currentItems = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (shouldSkip(line)) continue;

      // Check for day name headers (line starts with or is a day name)
      const lineLower = line.toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž]/gi, '');
      const dayMatch = dayNames.find(d => lineLower.startsWith(d));
      if (dayMatch) {
        if (currentItems.length > 0) {
          sections.push({ title: currentSection, items: currentItems });
        }
        currentSection = dayDisplayNames[dayMatch] || line;
        currentItems = [];
        continue;
      }

      // Match price at end of line: "item name 139 Kč"
      const priceMatch = line.match(/^(.+?)\s+(\d+)\s*Kč\s*$/);
      if (priceMatch) {
        const name = priceMatch[1].replace(/[.\-–—,]+$/, '').trim();
        if (name.length > 2) {
          currentItems.push({ name, price: priceMatch[2] + ' Kč' });
        }
        continue;
      }

      // Standalone price line - attach to previous item
      const standalonePrice = line.match(/^(\d+)\s*Kč\s*$/);
      if (standalonePrice && currentItems.length > 0 && !currentItems[currentItems.length - 1].price) {
        currentItems[currentItems.length - 1].price = standalonePrice[1] + ' Kč';
        continue;
      }

      // Regular food item line (permanent offerings like "pečené maso, ovarové maso")
      if (line.length > 10 && /[a-záčďéěíňóřšťúůýž]/i.test(line)) {
        currentItems.push({ name: line.replace(/[.\-–—,]+$/, '').trim(), price: '' });
      }
    }

    // Push last section
    if (currentItems.length > 0) {
      sections.push({ title: currentSection, items: currentItems });
    }

    // Remove empty sections
    const cleanSections = sections.filter(s => s.items.length > 0);

    if (cleanSections.length === 0) {
      return fallbackResult();
    }

    return {
      name: 'Řeznictví Svoboda',
      source: 'https://www.instagram.com/svoboda_reznictvi/',
      phone: '+420 251 625 847',
      menuDate,
      scrapedAt: new Date().toISOString(),
      sections: cleanSections
    };

  } finally {
    await browser.close();
  }
}

function fallbackResult() {
  return {
    name: 'Řeznictví Svoboda',
    source: 'https://www.instagram.com/svoboda_reznictvi/',
    phone: '+420 251 625 847',
    menuDate: '',
    scrapedAt: new Date().toISOString(),
    sections: [{
      title: 'Polední menu',
      items: [{ name: 'Menu nebylo nalezeno. Podívejte se na Instagram @svoboda_reznictvi', price: '' }]
    }]
  };
}

module.exports = { scrapeSvoboda };
