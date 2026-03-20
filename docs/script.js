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

  // Current day name for multi-day restaurants
  var dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  var dayOrder = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
  var todayName = dayNames[new Date().getDay()];

  // Render cards
  for (var ri = 0; ri < data.restaurants.length; ri++) {
    var r = data.restaurants[ri];
    var card = document.createElement('article');
    card.className = 'card';

    var isMultiDay = r.name === 'Pivovar Řeporyje' || r.name === 'Řeznictví Svoboda';

    // Check if this restaurant has a today section
    var hasTodaySection = false;
    if (isMultiDay) {
      for (var si = 0; si < r.sections.length; si++) {
        if (r.sections[si].title === todayName) { hasTodaySection = true; break; }
      }
    }

    // Categorize sections
    var nonDaySections = []; // e.g. "Polední menu"
    var daySections = [];    // day-named sections

    for (var si = 0; si < r.sections.length; si++) {
      var s = r.sections[si];
      var dayIdx = dayOrder.indexOf(s.title);
      if (isMultiDay && dayIdx >= 0) {
        daySections.push({ section: s, dayIdx: dayIdx, isToday: s.title === todayName });
      } else {
        nonDaySections.push({ section: s, isToday: false, isOtherDay: false });
      }
    }

    // Sort day sections by day order (Po, Út, St, Čt, Pá)
    daySections.sort(function(a, b) { return a.dayIdx - b.dayIdx; });

    var sectionsHtml = '';

    // For multi-day restaurants on weekend: show "no menu today" message
    if (isMultiDay && !hasTodaySection) {
      sectionsHtml += '<div class="no-menu-today">Na dnes není žádné denní menu</div>';
    }

    // Render non-day sections first (e.g. "Polední menu")
    sectionsHtml += renderSections(nonDaySections, r.sections.length);

    if (isMultiDay && daySections.length > 0) {
      // Render all days in order, but wrap in a structure where today is outside collapsed
      for (var di = 0; di < daySections.length; di++) {
        var ds = daySections[di];
        if (ds.isToday) {
          sectionsHtml += renderSections([{ section: ds.section, isToday: true, isOtherDay: false }], r.sections.length);
        }
      }
      // Collapsed: all non-today days in correct order
      var otherDays = [];
      for (var di = 0; di < daySections.length; di++) {
        if (!daySections[di].isToday) {
          otherDays.push({ section: daySections[di].section, isToday: false, isOtherDay: true });
        }
      }
      if (otherDays.length > 0) {
        sectionsHtml += '<div class="collapsed-days" hidden>';
        sectionsHtml += renderSections(otherDays, r.sections.length);
        sectionsHtml += '</div>';
        var btnLabel = hasTodaySection ? 'Zobrazit celý týden' : 'Zobrazit týdenní menu';
        sectionsHtml += '<button class="expand-btn expand-days-btn" type="button">+ ' + btnLabel + '</button>';
      }
    } else if (!isMultiDay) {
      // Regular restaurant: render all sections as-is
      // (nonDaySections already rendered above, but for non-multi-day all sections are in nonDaySections)
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

  // ── Truncate cards with 10+ priced items ──
  // Count priced items across all visible sections. After the 10th priced item,
  // hide remaining items within the current section + hide all subsequent sections.
  var cards = main.querySelectorAll('.card');
  for (var ci = 0; ci < cards.length; ci++) {
    var cardEl = cards[ci];
    var allItems = cardEl.querySelectorAll('.card-body > .menu-section .menu-item');
    var totalPriced = 0;
    for (var ii = 0; ii < allItems.length; ii++) {
      var p = allItems[ii].querySelector('.price');
      if (p && p.textContent.trim()) totalPriced++;
    }
    if (totalPriced <= 10) continue;

    // Walk through visible sections and hide items/sections after 10th priced item
    var visibleSections = cardEl.querySelectorAll('.card-body > .menu-section');
    var pricedSeen = 0;
    var cutoff = false;

    for (var si = 0; si < visibleSections.length; si++) {
      var section = visibleSections[si];
      if (cutoff) {
        section.classList.add('truncated-section');
        continue;
      }
      var items = section.querySelectorAll('.menu-item');
      for (var ii = 0; ii < items.length; ii++) {
        var priceEl = items[ii].querySelector('.price');
        if (priceEl && priceEl.textContent.trim()) {
          pricedSeen++;
          if (pricedSeen > 10) {
            items[ii].classList.add('truncated-item');
            if (!cutoff) cutoff = true;
          }
        } else if (cutoff) {
          items[ii].classList.add('truncated-item');
        }
      }
    }

    var hiddenCount = totalPriced - Math.min(pricedSeen, 10);
    if (hiddenCount > 0) {
      var btn = document.createElement('button');
      btn.className = 'expand-btn expand-items-btn';
      btn.type = 'button';
      btn.textContent = '+ Zobrazit ' + (hiddenCount === 1 ? 'další 1 jídlo' :
        hiddenCount < 5 ? 'další ' + hiddenCount + ' jídla' :
        'dalších ' + hiddenCount + ' jídel');
      var cardBody = cardEl.querySelector('.card-body');
      cardBody.appendChild(btn);

      btn.addEventListener('click', (function(card, button) {
        return function() {
          var items = card.querySelectorAll('.truncated-item');
          for (var i = 0; i < items.length; i++) items[i].classList.remove('truncated-item');
          var secs = card.querySelectorAll('.truncated-section');
          for (var i = 0; i < secs.length; i++) secs[i].classList.remove('truncated-section');
          button.remove();
        };
      })(cardEl, btn));
    }
  }

  // ── Expand days buttons ──
  var dayBtns = main.querySelectorAll('.expand-days-btn');
  for (var bi = 0; bi < dayBtns.length; bi++) {
    dayBtns[bi].addEventListener('click', (function(btn) {
      return function() {
        var cardBody = btn.closest('.card-body');
        var collapsed = cardBody.querySelector('.collapsed-days');
        if (collapsed) {
          collapsed.hidden = false;
        }
        btn.remove();
      };
    })(dayBtns[bi]));
  }

  // Auto-refresh every 12 hours
  setTimeout(function () { location.reload(); }, 12 * 60 * 60 * 1000);

  function renderSections(entries, totalSections) {
    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var s = entries[i].section;
      var isToday = entries[i].isToday;
      var isOtherDay = entries[i].isOtherDay;

      var sectionClass = 'menu-section';
      if (isToday) sectionClass += ' today-section';
      if (isOtherDay) sectionClass += ' dimmed-section';

      html += '<section class="' + sectionClass + '">';

      var skipTitle = /^polední\s+menu$/i.test(s.title) && totalSections === 1;
      if (!skipTitle) {
        var titleHtml = '<h3 class="section-title">' + escapeHtml(s.title);
        if (isToday) titleHtml += ' <span class="today-badge">DNES</span>';
        titleHtml += '</h3>';
        html += titleHtml;
      }
      for (var ii = 0; ii < s.items.length; ii++) {
        var item = s.items[ii];
        var cls = 'menu-item' + (item.soldOut ? ' sold-out' : '');
        html +=
          '<div class="' + cls + '">' +
            '<span class="name">' + escapeHtml(item.name) + '</span>' +
            '<span class="price">' + escapeHtml(item.soldOut ? 'Vyprodáno' : (item.price || '')) + '</span>' +
          '</div>';
      }
      html += '</section>';
    }
    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
