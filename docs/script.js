(async function () {
  const res = await fetch('menu-data.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) {
    document.getElementById('restaurants').innerHTML = '<p>Nepodařilo se načíst data.</p>';
    return;
  }

  const data = await res.json();
  const main = document.getElementById('restaurants');

  // Stale warning
  if (data.lastUpdated) {
    const age = Date.now() - new Date(data.lastUpdated).getTime();
    const hours = age / (1000 * 60 * 60);
    document.getElementById('lastUpdated').textContent =
      'Aktualizováno: ' + new Date(data.lastUpdated).toLocaleString('cs-CZ');
    if (hours > 24) {
      const warn = document.createElement('div');
      warn.className = 'stale-warning';
      warn.textContent = '\u26A0 Data mohou být neaktuální (poslední aktualizace před více než 24 hodinami)';
      main.before(warn);
    }
  }

  // Render cards
  for (const r of data.restaurants) {
    const card = document.createElement('div');
    card.className = 'card';

    let sectionsHtml = '';
    for (const s of r.sections) {
      // Don't show "Polední menu" as section title - it's already in the page heading
      const skipTitle = /^polední\s+menu$/i.test(s.title);
      if (!skipTitle) {
        sectionsHtml += '<div class="section-title">' + escapeHtml(s.title) + '</div>';
      }
      for (const item of s.items) {
        sectionsHtml +=
          '<div class="menu-item">' +
            '<span class="name">' + escapeHtml(item.name) + '</span>' +
            '<span class="price">' + escapeHtml(item.price || '') + '</span>' +
          '</div>';
      }
    }

    const scrapedTime = r.scrapedAt
      ? new Date(r.scrapedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
      : '';

    // Don't show menuDate if it's just "Polední menu" or empty
    const showDate = r.menuDate && !/^polední\s+menu$/i.test(r.menuDate);

    // Phone link
    const phoneHtml = r.phone
      ? '<a href="tel:' + escapeHtml(r.phone) + '">' + escapeHtml(r.phone) + '</a>'
      : '';

    card.innerHTML =
      '<div class="card-header">' +
        '<h2>' + escapeHtml(r.name) + '</h2>' +
        (showDate ? '<div class="card-date">' + escapeHtml(r.menuDate) + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' + sectionsHtml + '</div>' +
      '<div class="card-footer">' +
        '<a href="' + escapeHtml(r.source) + '" target="_blank" rel="noopener">Zdroj</a>' +
        (phoneHtml ? '<span>' + phoneHtml + '</span>' : '') +
        '<span>Staženo ' + escapeHtml(scrapedTime) + '</span>' +
      '</div>';

    main.appendChild(card);
  }

  // Auto-refresh every 12 hours
  setTimeout(function () { location.reload(); }, 12 * 60 * 60 * 1000);

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
