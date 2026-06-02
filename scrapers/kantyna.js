const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");

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

    // Establish session cookies at facebook.com before navigating to group
    await page.goto("https://www.facebook.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    await page.goto("https://www.facebook.com/groups/1396911425536833", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Dismiss login / cookie / notification dialogs
    try {
      const buttons = await page.$$('button, [role="button"]');
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (
          /not now|dismiss|close|decline|reject|allow|odmítnout|zavřít|přijmout/i.test(
            text,
          )
        ) {
          await btn.click();
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch {}

    // Scroll to trigger lazy-loaded posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 1500));
    }

    const debugInfo = await page
      .evaluate(() => ({
        url: location.href,
        title: document.title,
        articleCount: document.querySelectorAll('[role="article"]').length,
        imgCount: document.querySelectorAll("img").length,
      }))
      .catch(() => ({ error: "evaluate failed" }));
    console.log("  Page state:", JSON.stringify(debugInfo));

    // Find the post whose visible text contains the menu keyword
    const imageUrls = await page.evaluate(() => {
      const articles = Array.from(
        document.querySelectorAll('[role="article"]'),
      );
      for (const article of articles) {
        const text = article.textContent || "";
        if (/polední\s*menu|jídelní\s*lístek/i.test(text)) {
          const imgs = Array.from(article.querySelectorAll("img"));
          return imgs
            .filter((img) => {
              const src = img.src || "";
              return (
                (src.includes("scontent") || src.includes("fbcdn")) &&
                img.width > 100
              );
            })
            .map((img) => img.src);
        }
      }
      return [];
    });

    console.log("  Found", imageUrls.length, "candidate image(s)");

    if (imageUrls.length === 0) {
      console.log("  No menu post found in visible feed, returning null");
      return null;
    }

    for (let idx = 0; idx < imageUrls.length; idx++) {
      const imageUrl = imageUrls[idx];
      console.log(
        "  Trying image",
        idx + 1,
        "/",
        imageUrls.length,
        ":",
        imageUrl.substring(0, 80) + "...",
      );

      const imgResponse = await fetch(imageUrl, {
        headers: {
          Referer: "https://www.facebook.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });

      if (!imgResponse.ok) {
        console.log("  Image download failed:", imgResponse.status);
        continue;
      }

      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

      if (imgBuffer.length < 5000) {
        console.log(
          "  Image too small, likely not a menu:",
          imgBuffer.length,
          "bytes",
        );
        continue;
      }

      const {
        data: { text },
      } = await Tesseract.recognize(imgBuffer, "ces");
      console.log("  OCR text length:", text.length);

      if (!/polední\s*menu|jídelní\s*lístek/i.test(text)) {
        console.log("  Menu keyword not found in OCR text, trying next...");
        continue;
      }

      console.log("  Menu keyword confirmed in OCR — parsing");
      return parseMenuText(text);
    }

    console.log("  No usable menu image found");
    return null;
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
    .filter((l) => l.length > 0);

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
      const name = priceMatch[1].replace(/[.\-–—,]+$/, "").trim();
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
        name: line.replace(/[.\-–—,]+$/, "").trim(),
        price: "",
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

  const cleanSections = sections.filter((s) => s.items.length > 0);

  if (cleanSections.length === 0) return null;

  // Quality check: no day sections + few/short items = OCR garbage → use fallback
  const hasDaySections = cleanSections.some((s) =>
    ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].includes(s.title),
  );
  if (!hasDaySections) {
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
