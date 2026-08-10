(async function () {
  const res = await fetch("menu-data.json?t=" + Date.now(), {
    cache: "no-store",
  });
  if (!res.ok) {
    document.getElementById("restaurants").innerHTML =
      "<p>Nepodařilo se načíst data.</p>";
    return;
  }

  const data = await res.json();
  const main = document.getElementById("restaurants");

  // Clear pre-rendered static content (replaced by interactive version below)
  main.innerHTML = "";

  // Stale warning
  if (data.lastUpdated) {
    const age = Date.now() - new Date(data.lastUpdated).getTime();
    const hours = age / (1000 * 60 * 60);
    document.getElementById("lastUpdated").textContent =
      "Aktualizováno: " + new Date(data.lastUpdated).toLocaleString("cs-CZ");
    if (hours > 24) {
      var warn = document.createElement("div");
      warn.className = "stale-warning";
      warn.textContent =
        "\u26A0 Data mohou být neaktuální (poslední aktualizace před více než 24 hodinami)";
      main.before(warn);
    }
  }

  // Current day name for multi-day restaurants
  var dayNames = [
    "Neděle",
    "Pondělí",
    "Úterý",
    "Středa",
    "Čtvrtek",
    "Pátek",
    "Sobota",
  ];
  var dayOrder = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
  var todayName = dayNames[new Date().getDay()];
  var isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  // Render cards
  for (var ri = 0; ri < data.restaurants.length; ri++) {
    var r = data.restaurants[ri];
    var card = document.createElement("article");
    card.className = "card";

    var isMultiDay =
      r.name === "Pivovar Řeporyje" ||
      r.name === "Řeznictví Svoboda" ||
      r.name === "Kantýna STAPO";
    var isWeekendClosure = r.name === "Řeznictví Svoboda" && isWeekend;

    // Check if this restaurant has a today section
    var hasTodaySection = false;
    if (isMultiDay) {
      for (var si = 0; si < r.sections.length; si++) {
        if (r.sections[si].title === todayName) {
          hasTodaySection = true;
          break;
        }
      }
    }

    // Categorize sections into: daily header (e.g. "Polední menu"), day-named, and static (rest)
    var dailyHeaderSections = []; // e.g. "Polední menu" - shown before today
    var daySections = []; // day-named sections (Po-Pá)
    var staticSections = []; // e.g. "Ukrajinské speciality" - shown after daily

    var dailyHeaderNames = ["polední menu"];

    for (var si = 0; si < r.sections.length; si++) {
      var s = r.sections[si];
      var dayIdx = dayOrder.indexOf(s.title);
      if (isMultiDay && dayIdx >= 0) {
        daySections.push({
          section: s,
          dayIdx: dayIdx,
          isToday: s.title === todayName,
        });
      } else if (
        isMultiDay &&
        dailyHeaderNames.indexOf(s.title.toLowerCase()) >= 0
      ) {
        dailyHeaderSections.push({
          section: s,
          isToday: false,
          isOtherDay: false,
        });
      } else {
        staticSections.push({ section: s, isToday: false, isOtherDay: false });
      }
    }

    // Sort day sections by day order (Po, Út, St, Čt, Pá)
    daySections.sort(function (a, b) {
      return a.dayIdx - b.dayIdx;
    });

    var sectionsHtml = "";

    // For multi-day restaurants on weekend: show "no menu today" message
    if (
      isMultiDay &&
      !hasTodaySection &&
      (daySections.length > 0 || isWeekendClosure)
    ) {
      sectionsHtml +=
        '<div class="no-menu-today">Na dnes není žádné denní menu</div>';
    }

    // Render daily header sections first (e.g. "Polední menu") — skipped on weekend closure or when closed today.
    // Fallback cards (isFallback) carry their message in a "Polední menu" section with no day sections,
    // so they must render even for multi-day restaurants that have no today section.
    if (!isWeekendClosure && (!isMultiDay || hasTodaySection || r.isFallback)) {
      sectionsHtml += renderSections(dailyHeaderSections, r.sections.length);
    }

    if (isMultiDay && daySections.length > 0) {
      // Render today without highlight (shown plain when it's the only visible day)
      for (var di = 0; di < daySections.length; di++) {
        var ds = daySections[di];
        if (ds.isToday) {
          sectionsHtml += renderSections(
            [
              {
                section: ds.section,
                isToday: false,
                isOtherDay: false,
                markAsToday: true,
                hideTitle: true,
              },
            ],
            r.sections.length,
          );
        }
      }
      // Collapsed: all non-today days in correct order
      var otherDays = [];
      for (var di = 0; di < daySections.length; di++) {
        if (!daySections[di].isToday) {
          otherDays.push({
            section: daySections[di].section,
            isToday: false,
            isOtherDay: true,
          });
        }
      }
      if (!hasTodaySection) {
        sectionsHtml += '<div class="closed-notice">Dnes je zavřeno</div>';
      }
      if (otherDays.length > 0) {
        sectionsHtml += '<div class="collapsed-days" hidden>';
        sectionsHtml += renderSections(otherDays, r.sections.length);
        sectionsHtml += "</div>";
        var btnLabel = hasTodaySection
          ? "Zobrazit celý týden"
          : "Zobrazit týdenní menu";
        sectionsHtml +=
          '<button class="expand-btn expand-days-btn" type="button">+ ' +
          btnLabel +
          "</button>";
      }
    } else if (isWeekendClosure) {
      // Weekend: show "Dnes je zavřeno" immediately, collapse the Instagram link behind button
      sectionsHtml += '<div class="closed-notice">Dnes je zavřeno</div>';
      var closureSections = dailyHeaderSections.concat(staticSections);
      if (closureSections.length > 0) {
        sectionsHtml += '<div class="collapsed-days" hidden>';
        sectionsHtml += renderSections(closureSections, r.sections.length);
        sectionsHtml += "</div>";
        sectionsHtml +=
          '<button class="expand-btn expand-days-btn" type="button">+ Zobrazit týdenní menu</button>';
        staticSections = [];
      }
    } else if (!isMultiDay) {
      // Check if restaurant is closed (has "Otevírací doba" section with "Zavřeno")
      var closedSection = null;
      var menuSections = [];
      for (var si2 = 0; si2 < staticSections.length; si2++) {
        var sec = staticSections[si2].section;
        if (
          sec.items.some(function (it) {
            return it.name
              .toLowerCase()
              .includes("na dnes není žádné denní menu");
          })
        ) {
          closedSection = staticSections[si2];
        } else {
          menuSections.push(staticSections[si2]);
        }
      }
      if (closedSection) {
        // Show closed message (same style as multi-day restaurants), hide menu behind expand button
        sectionsHtml +=
          '<div class="no-menu-today">Na dnes není žádné denní menu</div>';
        sectionsHtml += '<div class="closed-notice">Dnes je zavřeno</div>';
        if (menuSections.length > 0) {
          sectionsHtml += '<div class="collapsed-days" hidden>';
          sectionsHtml += renderSections(menuSections, r.sections.length);
          sectionsHtml += "</div>";
          sectionsHtml +=
            '<button class="expand-btn expand-days-btn" type="button">+ Zobrazit týdenní menu</button>';
        }
        staticSections = []; // already rendered
      }
    }

    // Render static/permanent sections last (e.g. Ukrajinské speciality, Hlavní jídla, Dezerty)
    if (!isWeekendClosure) {
      sectionsHtml += renderSections(staticSections, r.sections.length);
    }

    var scrapedTime = r.scrapedAt
      ? new Date(r.scrapedAt).toLocaleTimeString("cs-CZ", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    // Unified date display: daily menu restaurants show date, static keep "Stálé menu"
    var staticMenuNames = [
      "DÖNER KEBAB HOUSE",
      "HQ Pippi Grill",
      "Papa Cipolla",
      "Mama Bowl",
    ];
    var isStaticMenu = staticMenuNames.indexOf(r.name) >= 0;
    var displayDate = "";
    if (r.isFallback) {
      displayDate = "";
    } else if (isMultiDay) {
      if (r.menuDate) {
        var multiDayDateLower =
          r.menuDate.charAt(0).toLowerCase() + r.menuDate.slice(1);
        displayDate =
          "Na webu restaurace je k dispozici menu z " + multiDayDateLower;
      }
    } else if (isStaticMenu) {
      displayDate = r.menuDate || "Stálé menu";
    } else {
      var now = new Date();
      var todayFormatted =
        todayName +
        " " +
        now.getDate() +
        "." +
        (now.getMonth() + 1) +
        "." +
        now.getFullYear();
      // Try to detect if scraped menuDate matches today by extracting day.month
      var menuIsToday = false;
      var dateMatch = r.menuDate
        ? r.menuDate.match(/(\d{1,2})\s*\.\s*(\d{1,2})/)
        : null;
      if (dateMatch) {
        var menuDay = parseInt(dateMatch[1], 10);
        var menuMonth = parseInt(dateMatch[2], 10);
        menuIsToday =
          menuDay === now.getDate() && menuMonth === now.getMonth() + 1;
      }
      if (r.menuDate && !dateMatch) {
        // menuDate holds a status message (e.g. "Polední menu nenalezeno"), not a date — show as-is
        displayDate = r.menuDate;
      } else {
        var dateStr = menuIsToday
          ? todayFormatted
          : r.menuDate || todayFormatted;
        var dateStrLower = dateStr.charAt(0).toLowerCase() + dateStr.slice(1);
        displayDate =
          "Na webu restaurace je k dispozici menu z " + dateStrLower;
      }
    }

    // Phone link
    var phoneHtml = r.phone
      ? 'Tel. <a href="tel:' +
        escapeHtml(r.phone) +
        '">' +
        escapeHtml(r.phone) +
        "</a>"
      : "";

    card.innerHTML =
      '<header class="card-header">' +
      "<h2>" +
      escapeHtml(r.name) +
      "</h2>" +
      '<div class="card-date">' +
      escapeHtml(displayDate) +
      "</div>" +
      "</header>" +
      '<div class="card-body">' +
      sectionsHtml +
      "</div>" +
      '<footer class="card-footer">' +
      '<a href="' +
      escapeHtml(r.source) +
      '" target="_blank" rel="noopener">Zdroj</a>' +
      (phoneHtml ? "<span>" + phoneHtml + "</span>" : "") +
      "<span>Staženo " +
      escapeHtml(scrapedTime) +
      "</span>" +
      "</footer>";

    main.appendChild(card);
  }

  // ── Truncate cards with 11+ priced items ──
  // Count priced items across all visible sections. After the 11th priced item,
  // hide remaining items within the current section + hide all subsequent sections.
  var cards = main.querySelectorAll(".card");
  for (var ci = 0; ci < cards.length; ci++) {
    var cardEl = cards[ci];
    var allItems = cardEl.querySelectorAll(
      ".card-body > .menu-section .menu-item",
    );
    var totalPriced = 0;
    for (var ii = 0; ii < allItems.length; ii++) {
      var p = allItems[ii].querySelector(".price");
      if (p && p.textContent.trim()) totalPriced++;
    }
    if (totalPriced <= 11) continue;

    // Walk through visible sections and hide items/sections after 10th priced item
    var visibleSections = cardEl.querySelectorAll(".card-body > .menu-section");
    var pricedSeen = 0;
    var cutoff = false;

    for (var si = 0; si < visibleSections.length; si++) {
      var section = visibleSections[si];
      if (cutoff) {
        section.classList.add("truncated-section");
        continue;
      }
      var items = section.querySelectorAll(".menu-item");
      for (var ii = 0; ii < items.length; ii++) {
        var priceEl = items[ii].querySelector(".price");
        if (priceEl && priceEl.textContent.trim()) {
          pricedSeen++;
          if (pricedSeen > 11) {
            items[ii].classList.add("truncated-item");
            if (!cutoff) cutoff = true;
          }
        } else if (cutoff) {
          items[ii].classList.add("truncated-item");
        }
      }
    }

    // Hide sections where all items are truncated (only title remains visible)
    var visibleSectionsAfter = cardEl.querySelectorAll(
      ".card-body > .menu-section:not(.truncated-section)",
    );
    for (var si2 = 0; si2 < visibleSectionsAfter.length; si2++) {
      var sec = visibleSectionsAfter[si2];
      var visItems = sec.querySelectorAll(".menu-item:not(.truncated-item)");
      if (visItems.length === 0) {
        sec.classList.add("truncated-section");
      }
    }

    var hiddenCount = totalPriced - Math.min(pricedSeen, 11);
    if (hiddenCount > 0) {
      var btn = document.createElement("button");
      btn.className = "expand-btn expand-items-btn";
      btn.type = "button";
      btn.textContent =
        "+ Zobrazit " +
        (hiddenCount === 1
          ? "další 1 jídlo"
          : hiddenCount < 5
            ? "další " + hiddenCount + " jídla"
            : "dalších " + hiddenCount + " jídel");
      var cardBody = cardEl.querySelector(".card-body");
      cardBody.appendChild(btn);

      btn.addEventListener(
        "click",
        (function (card, button) {
          return function () {
            var items = card.querySelectorAll(".truncated-item");
            for (var i = 0; i < items.length; i++)
              items[i].classList.remove("truncated-item");
            var secs = card.querySelectorAll(".truncated-section");
            for (var i = 0; i < secs.length; i++)
              secs[i].classList.remove("truncated-section");
            button.remove();
          };
        })(cardEl, btn),
      );
    }
  }

  // ── Expand days buttons ──
  var dayOrderMap = { Pondělí: 1, Úterý: 2, Středa: 3, Čtvrtek: 4, Pátek: 5 };
  var dayBtns = main.querySelectorAll(".expand-days-btn");
  for (var bi = 0; bi < dayBtns.length; bi++) {
    dayBtns[bi].addEventListener(
      "click",
      (function (btn) {
        return function () {
          var cardBody = btn.closest(".card-body");
          var collapsed = cardBody.querySelector(".collapsed-days");
          if (!collapsed) {
            btn.remove();
            return;
          }

          // Move closed notice right after the no-menu-today message
          var closedNotice = collapsed.querySelector(".closed-notice");
          if (closedNotice) {
            var noMenuMsg = cardBody.querySelector(".no-menu-today");
            if (noMenuMsg) {
              noMenuMsg.after(closedNotice);
            } else {
              cardBody.insertBefore(closedNotice, cardBody.firstChild);
            }
          }
          var collapsedSections = collapsed.querySelectorAll(".menu-section");
          for (var i = 0; i < collapsedSections.length; i++) {
            collapsedSections[i].classList.remove("dimmed-section");
            cardBody.appendChild(collapsedSections[i]);
          }
          collapsed.remove();

          // Activate today highlight and restore hidden title
          var todaySection = cardBody.querySelector(
            ".menu-section[data-today]",
          );
          if (todaySection) {
            todaySection.classList.add("today-section");
            // Restore day title if it was hidden
            var dayTitle = todaySection.getAttribute("data-day-title");
            if (dayTitle && !todaySection.querySelector(".section-title")) {
              var titleHtml =
                '<h3 class="section-title">' +
                dayTitle +
                ' <span class="today-badge">DNES</span></h3>';
              todaySection.insertAdjacentHTML("afterbegin", titleHtml);
            } else {
              var titleEl = todaySection.querySelector(".section-title");
              if (titleEl && !titleEl.querySelector(".today-badge")) {
                titleEl.insertAdjacentHTML(
                  "beforeend",
                  ' <span class="today-badge">DNES</span>',
                );
              }
            }
          }

          // Now sort all day sections in card-body by day order (Po–Pá)
          var allSections = cardBody.querySelectorAll(".menu-section");
          var nonDays = [];
          var days = [];
          for (var i = 0; i < allSections.length; i++) {
            var title =
              allSections[i]
                .querySelector(".section-title")
                ?.textContent?.replace(/ DNES$/, "") || "";
            if (dayOrderMap[title]) {
              days.push({ el: allSections[i], order: dayOrderMap[title] });
            } else {
              nonDays.push(allSections[i]);
            }
          }
          days.sort(function (a, b) {
            return a.order - b.order;
          });

          // Re-append in order: notices first, then non-day sections, then days Po–Pá, then buttons
          var notices = [];
          var buttons = [];
          for (var i = 0; i < cardBody.children.length; i++) {
            var child = cardBody.children[i];
            if (child.tagName !== "SECTION") {
              if (
                child.classList.contains("no-menu-today") ||
                child.classList.contains("closed-notice")
              ) {
                notices.push(child);
              } else {
                buttons.push(child);
              }
            }
          }

          for (var i = 0; i < notices.length; i++)
            cardBody.appendChild(notices[i]);
          for (var i = 0; i < nonDays.length; i++)
            cardBody.appendChild(nonDays[i]);
          for (var i = 0; i < days.length; i++)
            cardBody.appendChild(days[i].el);
          for (var i = 0; i < buttons.length; i++)
            cardBody.appendChild(buttons[i]);

          btn.remove();
        };
      })(dayBtns[bi]),
    );
  }

  // Auto-refresh every 12 hours
  setTimeout(
    function () {
      location.reload();
    },
    12 * 60 * 60 * 1000,
  );

  function renderSections(entries, totalSections) {
    var html = "";
    for (var i = 0; i < entries.length; i++) {
      var s = entries[i].section;
      var isToday = entries[i].isToday;
      var isOtherDay = entries[i].isOtherDay;
      var markAsToday = entries[i].markAsToday;
      var hideTitle = entries[i].hideTitle;

      var sectionClass = "menu-section";
      if (isToday) sectionClass += " today-section";
      if (isOtherDay) sectionClass += " dimmed-section";

      var attrs = markAsToday ? ' data-today="1"' : "";
      if (hideTitle) attrs += ' data-day-title="' + escapeHtml(s.title) + '"';
      html += '<section class="' + sectionClass + '"' + attrs + ">";

      var skipTitle =
        hideTitle || (/^polední\s+menu$/i.test(s.title) && totalSections === 1);
      if (!skipTitle) {
        var titleHtml = '<h3 class="section-title">' + escapeHtml(s.title);
        if (isToday) titleHtml += ' <span class="today-badge">DNES</span>';
        titleHtml += "</h3>";
        html += titleHtml;
      }
      for (var ii = 0; ii < s.items.length; ii++) {
        var item = s.items[ii];
        var cls = "menu-item" + (item.soldOut ? " sold-out" : "");
        var safeLink =
          item.link && /^https?:\/\//i.test(item.link) ? item.link : null;
        var nameHtml =
          (item.prefix ? escapeHtml(item.prefix) : "") +
          (safeLink
            ? '<a href="' +
              escapeHtml(safeLink) +
              '" target="_blank" rel="noopener">' +
              escapeHtml(item.name) +
              "</a>"
            : escapeHtml(item.name));
        html +=
          '<div class="' +
          cls +
          '">' +
          '<span class="name">' +
          nameHtml +
          "</span>" +
          '<span class="price">' +
          escapeHtml(item.soldOut ? "Vyprodáno" : item.price || "") +
          "</span>" +
          (item.description
            ? '<div class="item-desc">' +
              escapeHtml(item.description) +
              "</div>"
            : "") +
          "</div>";
      }
      html += "</section>";
    }
    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
