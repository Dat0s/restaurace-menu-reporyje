const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'docs', 'menu-data.json');

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch {
    return { lastUpdated: null, restaurants: [] };
  }
}

function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function upsertRestaurant(data, restaurant) {
  const idx = data.restaurants.findIndex(r => r.name === restaurant.name);
  if (idx >= 0) {
    data.restaurants[idx] = restaurant;
  } else {
    data.restaurants.push(restaurant);
  }
  return data;
}

module.exports = { readData, writeData, upsertRestaurant, DATA_PATH };
