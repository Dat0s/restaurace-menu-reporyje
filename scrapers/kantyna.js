const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");
const { runPythonScraper } = require("./py-bridge");
const { isMenuFresh } = require("./utils");

function isSupportedImageFormat(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true; // BMP
  return false;
}

// Discards results whose menu date belongs to a past week so a stale menu
// never silently stays on the site.
function freshOrNull(result, tierName) {
  if (!result) return null;
  if (isMenuFresh(result.menuDate)) return result;
  console.log(
    `  ${tierName} menu is stale (${result.menuDate}), trying next tier...`,
  );
  return null;
}

async function scrapeKantyna() {
  // Tier 1: best-effort automated scrape (Facebook group, usually blocked from CI)
  // Try with cookies first; if redirected to login (expired cookies), retry anonymously
  // (the group is public and accessible without a FB account from a residential IP).
  let auto = freshOrNull(await tryAutomated(true), "Puppeteer");
  if (!auto && process.env.FB_COOKIES) {
    auto = freshOrNull(await tryAutomated(false), "Puppeteer (anonymous)");
  }
  if (auto) return auto;

  // Tier 2: facebook-scraper (Python) feed of the group, OCR the post images
  console.log("  Puppeteer scrape failed, trying facebook-scraper (Python)...");
  const py = await runPythonScraper("fb_group_images.py");
  if (py && Array.isArray(py.images) && py.images.length > 0) {
    console.log("  Python tier returned", py.images.length, "image URL(s)");
    const urls = py.images.map((i) => i.url).filter(Boolean);
    const pyResult = freshOrNull(await ocrImageUrls(urls), "Python tier");
    if (pyResult) return pyResult;
  }

  // Tier 3: OCR a manually uploaded image from menu-images/kantyna.{jpg,jpeg,png}
  console.log("  Automated scrape failed, trying local menu image...");
  const local = freshOrNull(await ocrLocalImage("kantyna"), "Local image");
  if (local) return local;

  // Tier 4: friendly fallback card pointing at the Facebook group
  console.log("  No fresh menu found, using fallback");
  return fallbackResult();
}

async function tryAutomated(useCookies = true) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );

    // Inject saved Facebook session cookies if available (JSON or Netscape format)
    if (useCookies && process.env.FB_COOKIES) {
      let cookies = [];
      const raw = process.env.FB_COOKIES.trim();
      if (raw.startsWith("[") || raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        cookies = arr
          .filter((c) => c.name && c.value)
          .map((c) => ({
            domain: c.domain,
            path: c.path || "/",
            secure: !!c.secure,
            httpOnly: !!c.httpOnly,
            ...(c.expirationDate
              ? { expires: Math.floor(c.expirationDate) }
              : {}),
            name: c.name,
            value: c.value,
          }));
      } else {
        cookies = raw
          .split("\n")
          .filter((l) => l && !l.startsWith("#"))
          .map((l) => {
            const p = l.split("\t");
            if (p.length < 7) return null;
            const expires = parseInt(p[4]);
            return {
              domain: p[0],
              path: p[2],
              secure: p[3] === "TRUE",
              ...(expires > 0 ? { expires } : {}),
              name: p[5],
              value: p[6].trim(),
            };
          })
          .filter(Boolean);
      }
      await page.setCookie(...cookies);
      console.log("  Injected", cookies.length, "cookies");
    }

    // Set up interceptor BEFORE navigation so we don't miss images from initial load
    const interceptedUrls = [];
    page.on("response", (response) => {
      const url = response.url();
      const ct = response.headers()["content-type"] || "";
      if (
        (url.includes("scontent") || url.includes("fbcdn")) &&
        ct.startsWith("image/")
      )
        interceptedUrls.push(url);
    });

    // Load home page first to establish session context, then navigate to group
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    await page.goto("https://www.facebook.com/groups/1396911425536833", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Dismiss any remaining dialogs (notifications, etc.)
    try {
      const buttons = await page.$$('button, [role="button"]');
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (
          /not now|dismiss|close|decline|reject|odmítnout|zavřít/i.test(text)
        ) {
          await btn.click();
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch {}

    const debugInfo = await page
      .evaluate(() => ({ url: location.href, title: document.title }))
      .catch(() => ({ error: "evaluate failed" }));
    console.log("  Page state:", JSON.stringify(debugInfo));

    if (debugInfo.url && debugInfo.url.includes("/login")) {
      console.log("  Redirected to login");
      if (useCookies && process.env.FB_COOKIES) {
        console.log(
          "  Cookies may be expired — retrying anonymously (public group)...",
        );
        return null; // caller retries without cookies
      }
      return null;
    }

    // Scroll to trigger lazy-loading of post images
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Also collect any img[src] visible in DOM after scrolling
    const domUrls = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .map((img) => img.src || "")
          .filter(
            (src) =>
              (src.includes("scontent") || src.includes("fbcdn")) &&
              !src.includes("t51.2885-19"),
          ),
      )
      .catch(() => []);

    const allUrls = [...new Set([...interceptedUrls, ...domUrls])];
    console.log(
      "  Intercepted",
      interceptedUrls.length,
      "| DOM",
      domUrls.length,
      "| total",
      allUrls.length,
      "image URL(s)",
    );

    return ocrImageUrls(allUrls);
  } finally {
    await browser.close();
  }
}

// Fetch each URL; skip thumbnails (< 30KB); OCR the rest and return the
// candidate with the newest menu date. Shared by the puppeteer and Python tiers.
async function ocrImageUrls(imageUrls) {
  const candidates = [];
  for (const imageUrl of imageUrls) {
    let imgBuffer;
    try {
      const imgResponse = await fetch(imageUrl, {
        headers: { Referer: "https://www.facebook.com/" },
      });
      if (!imgResponse.ok) continue;
      imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    } catch {
      continue;
    }
    if (imgBuffer.length < 30000) continue;
    // Skip WebP and other formats Tesseract/Leptonica can't read
    if (!isSupportedImageFormat(imgBuffer)) continue;

    let text;
    try {
      ({
        data: { text },
      } = await Tesseract.recognize(imgBuffer, "ces"));
    } catch {
      continue;
    }
    // Matches both "polední menu" and the genitive "poledního menu" used on
    // posters like "CENA POLEDNÍHO MENU" (note: \w is ASCII-only in JS, so it
    // does not match "í" - the alternation is spelled out explicitly instead
    // of e.g. poledn\w*). A plain "polední" literal misses the genitive form
    // and silently discards an otherwise-valid, correctly-OCR'd menu image.
    if (!/poledn(í|ího)\s*menu|jídelní\s*lístek/i.test(text)) continue;

    const parsed = parseMenuText(text);
    if (parsed) {
      console.log("  Found menu, date:", parsed.menuDate);
      candidates.push(parsed);
    }
  }

  if (candidates.length === 0) {
    console.log("  No menu found in images");
    return null;
  }

  candidates.sort((a, b) => {
    const toDate = (d) => {
      const m = d.match(/(\d{1,2})\.(\d{1,2})/);
      return m ? parseInt(m[2]) * 100 + parseInt(m[1]) : 0;
    };
    return toDate(b.menuDate) - toDate(a.menuDate);
  });
  console.log("  Best candidate date:", candidates[0].menuDate);
  return candidates[0];
}

function parseMenuText(text) {
  const rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = rawLines
    .map((l) => l.replace(/\s*\([0-9,\s]+\)\s*/g, "").trim())
    .map((l) => l.replace(/(\d+)\s*k?[Kk][čcČ]/g, "$1 Kč"))
    // Strip trailing allergen-column codes OCR'd onto the dish line
    // (e.g. "...knedlík 15357", "...salátem 13:7"). Guard the price line
    // "CENA POLEDNÍHO MENU 119" so the default price is still extractable.
    .map((l) =>
      /cena\s+poledního\s+menu/i.test(l)
        ? l
        : l.replace(/\s+\d[\d\s.,:]*$/, "").trim(),
    )
    .filter((l) => l.length > 0);

  // Extract default price from "CENA POLEDNÍHO MENU 119"
  let defaultPrice = "";
  for (const line of lines) {
    const m = line.match(/cena\s+poledního\s+menu\s+(\d+)/i);
    if (m) {
      defaultPrice = m[1] + " Kč";
      break;
    }
  }

  // Extract date range (e.g. "2.6. – 6.6." or "2.6- 6.6.")
  let menuDate = "";
  for (const line of lines) {
    const rangeMatch = line.match(
      /(\d{1,2}\.\d{1,2}\.?)\s*[-–—]\s*(\d{1,2}\.\d{1,2})/,
    );
    if (rangeMatch) {
      menuDate =
        rangeMatch[1].replace(/\.$/, "") +
        ". - " +
        rangeMatch[2].replace(/\.$/, "") +
        ".";
      break;
    }
    const singleMatch = line.match(
      /(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/,
    );
    if (singleMatch) {
      menuDate = singleMatch[1] + "." + singleMatch[2] + "." + singleMatch[3];
      break;
    }
  }

  const dayNames = ["pondělí", "úterý", "středa", "čtvrtek", "pátek"];
  const dayDisplayNames = {
    pondělí: "Pondělí",
    úterý: "Úterý",
    středa: "Středa",
    čtvrtek: "Čtvrtek",
    pátek: "Pátek",
  };

  const skipPatterns = [
    /^(kantýna|stapo)/i,
    /přeje.*chuť/i,
    /dobrou\s+chuť/i,
    /těšíme\s+se/i,
    /objednávk/i,
    /facebook/i,
    /polední\s*menu/i,
    /jídelní\s*lístek/i,
    /^[a-z]{1,4}$/i,
    /^\d{1,2}\.\d{1,2}\.?\s*[-–—]/,
    /^[v»\-\d\s.,]{1,8}$/,
    /^KW\s*\d/i,
    /^K\d+\s*$/i,
    /řeporyje/i,
    /^menu\s*box/i,
    /^nově\s+otevřen/i,
    /^cena\s+poledního\s+menu/i,
    /^[\d,\s]+$/,
  ];

  function shouldSkip(line) {
    return skipPatterns.some((p) => p.test(line));
  }

  const sections = [];
  let currentSection = "Polední menu";
  let currentItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (shouldSkip(line)) continue;

    const lineLower = line.toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž]/gi, "");
    const dayMatch = dayNames.find((d) => lineLower.startsWith(d));
    if (dayMatch) {
      if (currentItems.length > 0) {
        sections.push({ title: currentSection, items: currentItems });
      }
      currentSection = dayDisplayNames[dayMatch] || line;
      currentItems = [];
      continue;
    }

    const priceMatch = line.match(/^(.+?)\s+(\d+)\s*Kč\s*$/);
    if (priceMatch) {
      const name = priceMatch[1].replace(/[.\-–—,:]+$/, "").trim();
      if (name.length > 2) {
        currentItems.push({ name, price: priceMatch[2] + " Kč" });
      }
      continue;
    }

    const standalonePrice = line.match(/^(\d+)\s*Kč\s*$/);
    if (
      standalonePrice &&
      currentItems.length > 0 &&
      !currentItems[currentItems.length - 1].price
    ) {
      currentItems[currentItems.length - 1].price = standalonePrice[1] + " Kč";
      continue;
    }

    if (line.length > 10 && /[a-záčďéěíňóřšťúůýž]/i.test(line)) {
      currentItems.push({
        name: line.replace(/[.\-–—,:]+$/, "").trim(),
        price: defaultPrice,
      });
    }
  }

  if (currentItems.length > 0) {
    sections.push({ title: currentSection, items: currentItems });
  }

  for (const s of sections) {
    for (const item of s.items) {
      if (item.name) {
        item.name = item.name.charAt(0).toUpperCase() + item.name.slice(1);
      }
    }
  }

  let cleanSections = sections.filter((s) => s.items.length > 0);

  if (cleanSections.length === 0) return null;

  const hasDaySections = cleanSections.some((s) =>
    ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].includes(s.title),
  );

  if (hasDaySections) {
    // "Polední menu" only collected OCR garbage before the first day header — drop it
    cleanSections = cleanSections.filter((s) => s.title !== "Polední menu");
  } else {
    const allItems = cleanSections.flatMap((s) => s.items);
    const avgLen =
      allItems.reduce((sum, i) => sum + i.name.length, 0) /
      (allItems.length || 1);
    if (allItems.length < 3 || avgLen < 15) {
      console.log(
        "  OCR result looks like garbage (no day sections, few/short items)",
      );
      return null;
    }
  }

  if (cleanSections.length === 0) return null;

  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: "+420 739 657 009",
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections: cleanSections,
  };
}

function fallbackResult() {
  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: "+420 739 657 009",
    menuDate: "",
    isFallback: true,
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Polední menu",
        items: [
          {
            prefix:
              "Dnešní menu se nepodařilo načíst — aktuální nabídku najdete na ",
            name: "Facebooku Kantýny STAPO",
            price: "",
            link: "https://www.facebook.com/groups/1396911425536833",
          },
        ],
      },
    ],
  };
}

// Tier 2 fallback: OCR a menu image manually uploaded to menu-images/<name>.{jpg,jpeg,png}
async function ocrLocalImage(baseName) {
  const dir = path.join(__dirname, "..", "menu-images");
  let imgPath = null;
  for (const ext of ["jpg", "jpeg", "png"]) {
    const candidate = path.join(dir, `${baseName}.${ext}`);
    if (fs.existsSync(candidate)) {
      imgPath = candidate;
      break;
    }
  }
  if (!imgPath) return null;

  console.log("  Found local menu image:", imgPath);
  let buf;
  try {
    buf = fs.readFileSync(imgPath);
  } catch (e) {
    console.log("  Could not read local image:", e.message);
    return null;
  }
  if (!isSupportedImageFormat(buf)) {
    console.log("  Local image is not a supported format (need JPEG/PNG)");
    return null;
  }

  let text;
  try {
    ({
      data: { text },
    } = await Tesseract.recognize(buf, "ces"));
  } catch (e) {
    console.log("  OCR of local image failed:", e.message);
    return null;
  }

  const parsed = parseMenuText(text);
  if (parsed) {
    console.log("  Parsed menu from local image, date:", parsed.menuDate);
  } else {
    console.log("  parseMenuText found no menu in local image");
  }
  return parsed;
}

module.exports = { scrapeKantyna };
