/**
 * Pre-renders menu HTML into index.html from menu-data.json.
 * Crawlers that don't execute JS see full restaurant content.
 * Client-side script.js replaces this with interactive version.
 */
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const dataPath = path.join(docsDir, 'menu-data.json');
const htmlPath = path.join(docsDir, 'index.html');

const START_MARKER = '<!-- PRE-RENDERED-MENU -->';
const END_MARKER = '<!-- /PRE-RENDERED-MENU -->';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateMenuHtml(data) {
  const lines = [];

  if (data.lastUpdated) {
    const d = new Date(data.lastUpdated);
    lines.push('<p class="updated">Aktualizováno: ' + d.toLocaleString('cs-CZ') + '</p>');
  }

  for (const r of data.restaurants) {
    lines.push('<article class="card">');
    lines.push('<header class="card-header">');
    lines.push('<h2>' + escapeHtml(r.name) + '</h2>');
    if (r.menuDate) {
      lines.push('<div class="card-date">' + escapeHtml(r.menuDate) + '</div>');
    }
    lines.push('</header>');
    lines.push('<div class="card-body">');

    for (const s of r.sections) {
      lines.push('<section class="menu-section">');
      const skipTitle = /^polední\s+menu$/i.test(s.title) && r.sections.length === 1;
      if (!skipTitle) {
        lines.push('<h3 class="section-title">' + escapeHtml(s.title) + '</h3>');
      }
      for (const item of s.items) {
        const cls = item.soldOut ? 'menu-item sold-out' : 'menu-item';
        const price = item.soldOut ? 'Vyprodáno' : (item.price || '');
        lines.push('<div class="' + cls + '">');
        lines.push('<span class="name">' + escapeHtml(item.name) + '</span>');
        lines.push('<span class="price">' + escapeHtml(price) + '</span>');
        lines.push('</div>');
      }
      lines.push('</section>');
    }

    lines.push('</div>');

    // Footer
    const scrapedTime = r.scrapedAt
      ? new Date(r.scrapedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
      : '';
    const phoneHtml = r.phone
      ? '<span>Tel. <a href="tel:' + escapeHtml(r.phone) + '">' + escapeHtml(r.phone) + '</a></span>'
      : '';
    lines.push('<footer class="card-footer">');
    lines.push('<a href="' + escapeHtml(r.source) + '" target="_blank" rel="noopener">Zdroj</a>');
    if (phoneHtml) lines.push(phoneHtml);
    lines.push('<span>Staženo ' + escapeHtml(scrapedTime) + '</span>');
    lines.push('</footer>');
    lines.push('</article>');
  }

  return lines.join('\n      ');
}

// Read data and HTML
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
let html = fs.readFileSync(htmlPath, 'utf-8');

const menuHtml = generateMenuHtml(data);
const replacement = START_MARKER + '\n      ' + menuHtml + '\n      ' + END_MARKER;

if (html.includes(START_MARKER) && html.includes(END_MARKER)) {
  // Replace existing pre-rendered content
  const regex = new RegExp(
    START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  html = html.replace(regex, replacement);
} else {
  // Insert before </main> (after noscript)
  html = html.replace('</main>', '      ' + replacement + '\n    </main>');
}

fs.writeFileSync(htmlPath, html, 'utf-8');
console.log('Pre-rendered ' + data.restaurants.length + ' restaurants into index.html');
