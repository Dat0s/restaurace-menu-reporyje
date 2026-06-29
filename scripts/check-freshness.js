/**
 * Checks the LIVE site (jidlo.reporyje.info) for stale Kantýna/Svoboda menus.
 * Used by .github/workflows/notify.yml (exit 1 → workflow fails → GitHub
 * e-mails the owner) and by scrapers/run-local.js to decide whether the
 * local scheduled task needs to scrape at all.
 *
 * No npm dependencies — runs with bare Node 20+ (built-in fetch).
 */
const { isMenuFresh } = require("../scrapers/utils");

const LIVE_URL = "https://jidlo.reporyje.info/menu-data.json";

// Static-menu restaurants never change — skip freshness check for those.
const STATIC_MENUS = new Set([
  "DÖNER KEBAB HOUSE",
  "HQ Pippi Grill",
  "Mama Bowl",
  "Papa Cipolla",
]);

async function checkLiveMenus() {
  const res = await fetch(`${LIVE_URL}?cb=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch of live menu data failed: ${res.status}`);
  const data = await res.json();
  const dynamic = (data.restaurants || []).filter(
    (r) => !STATIC_MENUS.has(r.name),
  );
  return dynamic.map((r) => checkRestaurant(data, r.name));
}

function checkRestaurant(data, name) {
  const r = (data.restaurants || []).find((x) => x.name === name);
  if (!r) return { name, ok: false, reason: "chybí v datech" };
  if (r.isFallback)
    return {
      name,
      ok: false,
      reason: "fallback karta (menu se nepodařilo stáhnout)",
    };
  if (!isMenuFresh(r.menuDate))
    return { name, ok: false, reason: `staré menu (${r.menuDate})` };
  return {
    name,
    ok: true,
    reason: `aktuální menu (${r.menuDate || "bez data"})`,
  };
}

async function main() {
  const results = await checkLiveMenus();
  for (const r of results) {
    console.log(`${r.ok ? "OK   " : "STALE"} ${r.name}: ${r.reason}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `\nMenu na jidlo.reporyje.info není aktuální: ${failed
        .map((r) => r.name)
        .join(", ")}.`,
    );
    process.exit(1);
  }
  console.log("\nVšechna sledovaná menu jsou aktuální.");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { checkLiveMenus, checkRestaurant };
