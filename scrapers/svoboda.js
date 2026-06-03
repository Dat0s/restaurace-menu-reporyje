const Tesseract = require("tesseract.js");

const IG_HEADERS = {
  "X-IG-App-ID": "936619743392459",
  "X-ASBD-ID": "198387",
  "X-IG-WWW-Claim": "0",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "*/*",
  Referer: "https://www.instagram.com/",
};

async function scrapeSvoboda() {
  const apiRes = await fetch(
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=svoboda_reznictvi",
    { headers: IG_HEADERS },
  ).catch(() => null);

  if (!apiRes?.ok) {
    console.log("  Instagram API unavailable, using fallback");
    return fallbackResult();
  }

  const json = await apiRes.json();
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  console.log("  Found", edges.length, "posts");

  if (edges.length === 0) return fallbackResult();

  // display_url works for both GraphImage and GraphVideo (thumbnail)
  const imageUrls = edges.map((e) => e.node.display_url).filter(Boolean);

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

    const imgRes = await fetch(imageUrl, {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent": IG_HEADERS["User-Agent"],
      },
    }).catch(() => null);

    if (!imgRes?.ok) {
      console.log("  Image download failed:", imgRes?.status);
      continue;
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    if (imgBuffer.length < 5000) {
      console.log("  Image too small:", imgBuffer.length, "bytes");
      continue;
    }

    const {
      data: { text },
    } = await Tesseract.recognize(imgBuffer, "ces");
    console.log("  OCR text length:", text.length);

    if (!/denn[ií]\s*menu/i.test(text)) {
      console.log('  No "DENNÍ MENU" found, trying next post...');
      continue;
    }

    console.log('  Found "DENNÍ MENU" in image', idx + 1);
    const parsed = parseMenuText(text);
    if (parsed) return parsed;
    console.log("  parseMenuText returned null, trying next image...");
  }

  console.log("  No usable image found, using fallback");
  return fallbackResult();
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
    /^(řeznictví|svoboda|maso|masna)/i,
    /přeje.*chuť/i,
    /dobrou\s+chuť/i,
    /těšíme\s+se/i,
    /objednávk/i,
    /instagram/i,
    /denn[ií]\s*menu/i,
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

  let cleanSections = sections.filter((s) => s.items.length > 0);

  if (cleanSections.length === 0) return null;

  const hasDaySections = cleanSections.some((s) =>
    ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].includes(s.title),
  );

  if (hasDaySections) {
    cleanSections = cleanSections.filter((s) => s.title !== "Polední menu");
  } else {
    const allItems = cleanSections.flatMap((s) => s.items);
    const avgLen =
      allItems.reduce((sum, i) => sum + i.name.length, 0) /
      (allItems.length || 1);
    if (allItems.length < 3 || avgLen < 15) {
      console.log("  OCR result looks like garbage, using fallback");
      return fallbackResult();
    }
  }

  if (cleanSections.length === 0) return fallbackResult();

  return {
    name: "Řeznictví Svoboda",
    source: "https://www.instagram.com/svoboda_reznictvi/",
    phone: "+420 251 625 847",
    menuDate,
    scrapedAt: new Date().toISOString(),
    sections: cleanSections,
  };
}

function fallbackResult() {
  return {
    name: "Řeznictví Svoboda",
    source: "https://www.instagram.com/svoboda_reznictvi/",
    phone: "+420 251 625 847",
    menuDate: "",
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Polední menu",
        items: [
          {
            name: "Menu nebylo nalezeno. Podívejte se na Instagram @svoboda_reznictvi",
            price: "",
          },
        ],
      },
    ],
  };
}

module.exports = { scrapeSvoboda };
