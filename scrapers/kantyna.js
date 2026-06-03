const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");

function isSupportedImageFormat(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true; // BMP
  return false;
}

async function scrapeKantyna() {
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
    if (process.env.FB_COOKIES) {
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
      console.log("  Redirected to login, using fallback");
      return fallbackResult();
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

    // Fetch each URL; skip thumbnails (< 30KB); OCR the rest
    const candidates = [];
    for (const imageUrl of allUrls) {
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
      if (!/polední\s*menu|jídelní\s*lístek/i.test(text)) continue;

      const parsed = parseMenuText(text);
      if (parsed) {
        console.log("  Found menu, date:", parsed.menuDate);
        candidates.push(parsed);
      }
    }

    if (candidates.length === 0) {
      console.log("  No menu found in images, using fallback");
      return fallbackResult();
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
  } finally {
    await browser.close();
  }
}

function parseMenuText(text) {
  const rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = rawLines
    .map((l) => l.replace(/\s*\([0-9,\s]+\)\s*/g, "").trim())
    .map((l) => l.replace(/(\d+)\s*k?[Kk][čcČ]/g, "$1 Kč"))
    .map((l) => l.replace(/\s+\d{1,2}(?:[,\s]+\d{1,2})+[\s.]*$/, "").trim())
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
        "  OCR result looks like garbage (no day sections, few/short items), using fallback",
      );
      return fallbackResult();
    }
  }

  if (cleanSections.length === 0) return fallbackResult();

  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: null,
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections: cleanSections,
  };
}

function fallbackResult() {
  return {
    name: "Kantýna STAPO",
    source: "https://www.facebook.com/groups/1396911425536833",
    phone: null,
    menuDate: "",
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Polední menu",
        items: [
          {
            name: "Menu nebylo nalezeno. Podívejte se na Facebook skupinu Kantýna STAPO",
            price: "",
          },
        ],
      },
    ],
  };
}

module.exports = { scrapeKantyna };
