/**
 * Local-PC scraper for the two Meta-walled restaurants (Kantýna, Svoboda).
 * Run by the "ReporyjeMenuScrape" Windows scheduled task (7–11 h Mon/Tue/Fri,
 * see scripts/local-scrape.ps1). The residential IP + cookies from
 * %LOCALAPPDATA%\reporyje-menu\ succeed where CI datacenter IPs often fail.
 *
 * Exit 0 = menus fresh or successfully updated; exit 1 = scrape attempted but
 * no fresh menu obtained (e-mail alert is handled by notify.yml at ~11:15).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { checkLiveMenus } = require("../scripts/check-freshness");
const {
  readData,
  writeData,
  upsertRestaurant,
  isMenuFresh,
} = require("./utils");

const WATCHED = ["Kantýna STAPO", "Řeznictví Svoboda"];

function loadLocalCookies() {
  const dir = path.join(process.env.LOCALAPPDATA || "", "reporyje-menu");
  const files = [
    ["fb_cookies.txt", "FB_COOKIES"],
    ["ig_cookies.txt", "IG_COOKIES"],
  ];
  for (const [file, envName] of files) {
    const p = path.join(dir, file);
    if (!process.env[envName] && fs.existsSync(p)) {
      process.env[envName] = fs.readFileSync(p, "utf-8");
      console.log(`Loaded ${envName} from ${p}`);
    }
  }
}

async function main() {
  let stale;
  if (process.env.FORCE_SCRAPE) {
    console.log("FORCE_SCRAPE set — skipping day guard and freshness check");
    loadLocalCookies();
    stale = [...WATCHED];
  } else {
    const day = new Date().getDay();
    if (day === 3 || day === 4) {
      console.log("Středa/čtvrtek — menu se nemění, přeskakuji");
      return 0;
    }
    loadLocalCookies();
    const results = await checkLiveMenus();
    for (const r of results) {
      console.log(`${r.ok ? "OK   " : "STALE"} ${r.name}: ${r.reason}`);
    }
    stale = results.filter((r) => !r.ok).map((r) => r.name);
  }

  if (stale.length === 0) {
    console.log("Všechna menu na webu jsou aktuální — není co dělat");
    return 0;
  }

  // Lazy requires: only pull in puppeteer/tesseract when actually scraping
  const scrapers = {
    "Kantýna STAPO": () => require("./kantyna").scrapeKantyna(),
    "Řeznictví Svoboda": () => require("./svoboda").scrapeSvoboda(),
  };

  const data = readData();
  let updated = 0;
  for (const name of stale) {
    console.log(`Scraping ${name} locally...`);
    try {
      const result = await scrapers[name]();
      if (
        result &&
        !result.isFallback &&
        result.sections &&
        result.sections.length > 0 &&
        isMenuFresh(result.menuDate)
      ) {
        upsertRestaurant(data, result);
        updated++;
        console.log(`  OK: fresh menu (${result.menuDate || "bez data"})`);
      } else {
        console.log("  FAIL: no fresh menu obtained");
      }
    } catch (e) {
      console.log(`  FAIL: ${e.message}`);
    }
  }

  if (updated === 0) {
    console.log(
      "Žádné čerstvé menu se nepodařilo získat — data nechávám beze změny",
    );
    return 1;
  }

  writeData(data);
  execFileSync(
    process.execPath,
    [path.join(__dirname, "..", "scripts", "prerender.js")],
    { stdio: "inherit" },
  );
  console.log(`Aktualizováno ${updated} restaurací v menu-data.json`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
