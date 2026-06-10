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
const WATCHED = ["Kantýna STAPO", "Řeznictví Svoboda"];

async function checkLiveMenus() {
  const res = await fetch(`${LIVE_URL}?cb=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch of live menu data failed: ${res.status}`);
  const data = await res.json();
  return WATCHED.map((name) => checkRestaurant(data, name));
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
        .join(", ")}. ` +
        "Zkontroluj cookies (scrapers/py/README.md) nebo nahraj obrázek do menu-images/.",
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
