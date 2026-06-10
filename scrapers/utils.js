const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "docs", "menu-data.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch {
    return { lastUpdated: null, restaurants: [] };
  }
}

function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function upsertRestaurant(data, restaurant) {
  const idx = data.restaurants.findIndex((r) => r.name === restaurant.name);
  if (idx >= 0) {
    data.restaurants[idx] = restaurant;
  } else {
    data.restaurants.push(restaurant);
  }
  return data;
}

// Returns false when menuDate clearly refers to a past week (before Monday of
// the current week) so stale OCR results are discarded instead of displayed.
// Empty or unparseable dates return true — we can't judge them, keep current behavior.
// Handles the formats parseMenuText produces: "2.6. - 6.6.", "1.6.2026", "8.6."
function isMenuFresh(menuDate, now = new Date()) {
  if (!menuDate) return true;

  let day, month, year;
  const range = menuDate.match(
    /(\d{1,2})\.\s*(\d{1,2})\.?\s*[-–—]\s*(\d{1,2})\.\s*(\d{1,2})/,
  );
  if (range) {
    // For a week range, freshness is decided by the end date
    day = parseInt(range[3]);
    month = parseInt(range[4]);
  } else {
    const single = menuDate.match(/(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{4})?/);
    if (!single) return true;
    day = parseInt(single[1]);
    month = parseInt(single[2]);
    if (single[3]) year = parseInt(single[3]);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return true;

  let date;
  if (year) {
    date = new Date(year, month - 1, day);
  } else {
    // No year on the menu — pick the candidate year closest to today
    // (handles December menus seen in January and vice versa)
    const y = now.getFullYear();
    date = [y - 1, y, y + 1]
      .map((cy) => new Date(cy, month - 1, day))
      .sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
  }

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const upper = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);

  return date >= monday && date <= upper;
}

module.exports = {
  readData,
  writeData,
  upsertRestaurant,
  isMenuFresh,
  DATA_PATH,
};
