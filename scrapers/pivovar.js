const puppeteer = require('puppeteer');

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

    // Find the daily menu image
    // The image is in a different Weblium resource group (6685145de189dbc54c372591)
    // vs the static site images (6413298202c80a000d678238)
    const data = await page.evaluate(() => {
      // Strategy 1: Find img/source with the dynamic resource group ID
      const allSources = Array.from(document.querySelectorAll('img, source'));
      const dynamicImgs = allSources
        .map(el => el.src || el.srcset || '')
        .filter(src => src.includes('6685145de189dbc54c372591'))
        .filter(src => src.includes('_optimized'));

      if (dynamicImgs.length > 0) {
        let url = dynamicImgs[dynamicImgs.length - 1]; // Last one is usually the img tag with full URL
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.endsWith('.webp') && !url.endsWith('.jpg') && !url.endsWith('.png')) url += '.webp';
        return { imageUrl: url };
      }

      // Strategy 2: Look for any image with a resource ID that changes (not from 6413298...)
      const staticPrefix = '6413298202c80a000d678238';
      const otherImgs = allSources
        .map(el => el.src || el.srcset || '')
        .filter(src => src.includes('res2.weblium.site') && !src.includes(staticPrefix) && src.length > 20);

      if (otherImgs.length > 0) {
        let url = otherImgs[0];
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.endsWith('.webp') && !url.endsWith('.jpg') && !url.endsWith('.png')) url += '.webp';
        return { imageUrl: url };
      }

      return { imageUrl: '' };
    });

    return {
      name: 'Pivovar Řeporyje',
      source: 'https://pivovarfood.cz/#catering',
      menuDate: 'Polední menu',
      scrapedAt: new Date().toISOString(),
      imageUrl: data.imageUrl || '',
      sections: [{
        title: 'Polední menu',
        items: data.imageUrl
          ? [{ name: '__IMAGE__', price: '', imageUrl: data.imageUrl }]
          : [{ name: 'Polední menu nebylo nalezeno. Podívejte se na pivovarfood.cz', price: '' }]
      }]
    };

  } finally {
    await browser.close();
  }
}

module.exports = { scrapePivovar };
