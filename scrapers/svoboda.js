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

    // Collect grid image URLs from network responses (works even behind login wall)
    const networkImages = [];
    page.on('response', response => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      // Grid post images use t51.71878, profile pics use t51.2885-19
      if (url.includes('scontent') && ct.includes('image') && !url.includes('t51.2885-19') && !url.includes('s150x150')) {
        networkImages.push(url);
      }
    });

    await page.goto('https://www.instagram.com/svoboda_reznictvi/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 3000));

    // First image collected from network is the newest post
    const imageUrl = networkImages[0] || '';
    console.log('  Instagram image URL:', imageUrl ? imageUrl.substring(0, 80) + '...' : 'NOT FOUND');
    console.log('  Grid images collected from network:', networkImages.length);

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

    if (!imgResponse.ok) {
      console.log('  Image download failed:', imgResponse.status);
      return fallbackResult();
    }

    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    if (imgBuffer.length < 5000) {
      console.log('  Image too small, likely not a menu:', imgBuffer.length, 'bytes');
      return fallbackResult();
    }

    // Run Czech OCR
    const { data: { text } } = await Tesseract.recognize(imgBuffer, 'ces');
    console.log('  OCR text length:', text.length);

    return parseMenuText(text);

  } finally {
    await browser.close();
  }
}

function parseMenuText(text) {
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Fix OCR artifacts in prices (e.g. "39kKč" → "39 Kč")
  // Strip allergen numbers like (1,7,9)
  const lines = rawLines
    .map(l => l.replace(/\s*\([0-9,\s]+\)\s*/g, '').trim())
    .map(l => l.replace(/(\d+)\s*k?[Kk][čcČ]/g, '$1 Kč'))
    .filter(l => l.length > 0);

  // Extract date range (e.g. "16.3. - 20.3. KW 4")
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

  const dayNames = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek'];
  const dayDisplayNames = {
    'pondělí': 'Pondělí', 'úterý': 'Úterý', 'středa': 'Středa',
    'čtvrtek': 'Čtvrtek', 'pátek': 'Pátek'
  };

  const skipPatterns = [
    /^(řeznictví|svoboda|maso|masna)/i,
    /přeje.*chuť/i,
    /dobrou\s+chuť/i,
    /těšíme\s+se/i,
    /objednávk/i,
    /instagram/i,
    /denn[ií]\s*menu/i,
    /^[a-z]{1,4}$/i,
    /^\d{1,2}\.\d{1,2}\.\s*-/,
    /^[v»\-\d\s.,]{1,8}$/,
    /^KW\s*\d/i,
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

    const priceMatch = line.match(/^(.+?)\s+(\d+)\s*Kč\s*$/);
    if (priceMatch) {
      const name = priceMatch[1].replace(/[.\-–—,]+$/, '').trim();
      if (name.length > 2) {
        currentItems.push({ name, price: priceMatch[2] + ' Kč' });
      }
      continue;
    }

    const standalonePrice = line.match(/^(\d+)\s*Kč\s*$/);
    if (standalonePrice && currentItems.length > 0 && !currentItems[currentItems.length - 1].price) {
      currentItems[currentItems.length - 1].price = standalonePrice[1] + ' Kč';
      continue;
    }

    if (line.length > 10 && /[a-záčďéěíňóřšťúůýž]/i.test(line)) {
      currentItems.push({ name: line.replace(/[.\-–—,]+$/, '').trim(), price: '' });
    }
  }

  if (currentItems.length > 0) {
    sections.push({ title: currentSection, items: currentItems });
  }

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
