const puppeteer = require('puppeteer');
const path = require('path');

async function generateOgImage() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      font-family: 'Montserrat', sans-serif;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .accent-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: #004d92;
    }
    .accent-bottom {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: #004d92;
    }
    .logo {
      font-size: 42px;
      font-weight: 700;
      color: #004d92;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .logo .dot { color: #ecb800; }
    .tagline {
      font-size: 11px;
      font-weight: 500;
      color: #999;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 48px;
    }
    .title {
      font-size: 52px;
      font-weight: 800;
      color: #1a1a1a;
      text-align: center;
      line-height: 1.2;
      margin-bottom: 20px;
    }
    .subtitle {
      font-size: 20px;
      font-weight: 500;
      color: #666;
      text-align: center;
    }
    .restaurants {
      margin-top: 36px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 900px;
    }
    .restaurants span {
      background: #f0f4f8;
      color: #004d92;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
    }
  </style>
</head>
<body>
  <div class="accent-top"></div>
  <div class="accent-bottom"></div>
  <div class="logo">ŘEPORYJE<span class="dot">.</span>INFO</div>
  <div class="tagline">Srozumitelné a ověřené informace o Řeporyjích</div>
  <div class="title">Polední menu v Řeporyjích</div>
  <div class="subtitle">Aktuální denní nabídka 8 restaurací &bull; Aktualizováno každých 15 minut</div>
  <div class="restaurants">
    <span>Jídelna Pohotovka</span>
    <span>Bistro a Kavárna Na náměstí</span>
    <span>Pivovar Řeporyje</span>
    <span>Řeporyjská Sokolovna</span>
    <span>Řeznictví Svoboda</span>
    <span>DÖNER KEBAB HOUSE</span>
    <span>HQ Pippi Grill</span>
    <span>Papa Cipolla</span>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Wait for fonts to load
  await new Promise(r => setTimeout(r, 2000));

  const outputPath = path.join(__dirname, '..', 'docs', 'og-image.png');
  await page.screenshot({ path: outputPath, type: 'png' });
  console.log('OG image saved to', outputPath);

  await browser.close();
}

generateOgImage().catch(e => { console.error(e); process.exit(1); });
