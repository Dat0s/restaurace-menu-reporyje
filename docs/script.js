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
      var warn = document.createElement('div');
      warn.className = 'stale-warning';
      warn.textContent = '\u26A0 Data mohou být neaktuální (poslední aktualizace před více než 24 hodinami)';
      main.before(warn);
    }
  }

  // Current day name for Pivovar highlighting
  var dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  var todayName = dayNames[new Date().getDay()];

  // Render cards
  for (var ri = 0; ri < data.restaurants.length; ri++) {
    var r = data.restaurants[ri];
    var card = document.createElement('article');
    card.className = 'card';

    var isPivovar = r.name === 'Pivovar Řeporyje' || r.name === 'Řeznictví Svoboda';

    var sectionsHtml = '';
    for (var si = 0; si < r.sections.length; si++) {
      var s = r.sections[si];
      // Check if this section matches today (for Pivovar)
      var isToday = isPivovar && s.title === todayName;
      var isDimmed = isPivovar && !isToday && dayNames.indexOf(s.title) > 0;

      var sectionClass = 'menu-section';
      if (isToday) sectionClass += ' today-section';
      if (isDimmed) sectionClass += ' dimmed-section';

      sectionsHtml += '<section class="' + sectionClass + '">';

      // Don't show "Polední menu" if it's the only section
      var skipTitle = /^polední\s+menu$/i.test(s.title) && r.sections.length === 1;
      if (!skipTitle) {
        var titleHtml = '<h3 class="section-title">' + escapeHtml(s.title);
        if (isToday) titleHtml += ' <span class="today-badge">DNES</span>';
        titleHtml += '</h3>';
        sectionsHtml += titleHtml;
      }
      for (var ii = 0; ii < s.items.length; ii++) {
        var item = s.items[ii];
        var cls = 'menu-item' + (item.soldOut ? ' sold-out' : '');
        sectionsHtml +=
          '<div class="' + cls + '">' +
            '<span class="name">' + escapeHtml(item.name) + '</span>' +
            '<span class="price">' + escapeHtml(item.soldOut ? 'Vyprodáno' : (item.price || '')) + '</span>' +
          '</div>';
      }
      sectionsHtml += '</section>';
    }

    var scrapedTime = r.scrapedAt
      ? new Date(r.scrapedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
      : '';

    // Don't show menuDate if it's just "Polední menu" or empty
    var showDate = r.menuDate && !/^polední\s+menu$/i.test(r.menuDate);

    // Phone link
    var phoneHtml = r.phone
      ? '<a href="tel:' + escapeHtml(r.phone) + '">' + escapeHtml(r.phone) + '</a>'
      : '';

    card.innerHTML =
      '<header class="card-header">' +
        '<h2>' + escapeHtml(r.name) + '</h2>' +
        (showDate ? '<div class="card-date">' + escapeHtml(r.menuDate) + '</div>' : '') +
      '</header>' +
      '<div class="card-body">' + sectionsHtml + '</div>' +
      '<footer class="card-footer">' +
        '<a href="' + escapeHtml(r.source) + '" target="_blank" rel="noopener">Zdroj</a>' +
        (phoneHtml ? '<span>' + phoneHtml + '</span>' : '') +
        '<span>Staženo ' + escapeHtml(scrapedTime) + '</span>' +
      '</footer>';

    main.appendChild(card);
  }

  // Auto-refresh every 12 hours
  setTimeout(function () { location.reload(); }, 12 * 60 * 60 * 1000);

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
