const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");
const { runPythonScraper } = require("./py-bridge");
const { isMenuFresh } = require("./utils");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const IG_FETCH_HEADERS = {
  "X-IG-App-ID": "936619743392459",
  "X-ASBD-ID": "198387",
  "X-IG-WWW-Claim": "0",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": USER_AGENT,
  Accept: "*/*",
  Referer: "https://www.instagram.com/",
};

function parseIgCookies(raw) {
  raw = raw.trim();
  if (raw.startsWith("[") || raw.startsWith("{")) {
    const arr = Array.isArray(JSON.parse(raw))
      ? JSON.parse(raw)
      : [JSON.parse(raw)];
    return arr
      .filter((c) => c.name && c.value)
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".instagram.com",
        path: c.path || "/",
        secure: c.secure !== false,
        ...(c.expirationDate ? { expires: Math.floor(c.expirationDate) } : {}),
      }));
  }
  return raw
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const p = l.split("\t");
      if (p.length < 7) return null;
      const expires = parseInt(p[4]);
      return {
        name: p[5],
        value: p[6].trim(),
        domain: p[0] || ".instagram.com",
        path: p[2] || "/",
        secure: p[3] === "TRUE",
        ...(expires > 0 ? { expires } : {}),
      };
    })
    .filter(Boolean);
}

// Pulls post image URLs out of an intercepted Instagram API/GraphQL response.
// Handles both the legacy web_profile_info shape (edge_owner_to_timeline_media)
// and the newer GraphQL timeline shape (image_versions2 candidates).
function extractPostImageUrls(json) {
  const urls = [];
  const edgeSets = [
    json?.data?.user?.edge_owner_to_timeline_media?.edges,
    json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges,
  ];
  for (const edges of edgeSets) {
    if (!Array.isArray(edges)) continue;
    for (const e of edges) {
      const node = e?.node;
      if (!node) continue;
      const candidates = [
        node.display_url,
        node.image_versions2?.candidates?.[0]?.url,
        node.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url,
      ];
      const url = candidates.find(Boolean);
      if (url) urls.push(url);
    }
  }
  // Plain feed/user responses have items[] instead of edges[]
  if (Array.isArray(json?.items)) {
    for (const item of json.items) {
      const url =
        item?.image_versions2?.candidates?.[0]?.url ??
        item?.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url;
      if (url) urls.push(url);
    }
  }
  return urls;
}

async function scrapeSvoboda() {
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    console.log("  Weekend — Řeznictví Svoboda is closed, skipping scrape");
    return weekendResult();
  }

  // Tier 1: best-effort automated scrape (usually blocked from CI datacenter IPs)
  const auto = freshOrNull(await tryAutomated(), "Automated");
  if (auto) return auto;

  // Tier 2: instaloader (Python) profile feed, OCR the post images
  console.log("  Automated scrape failed, trying instaloader (Python)...");
  const py = await runPythonScraper("ig_profile_images.py");
  if (py && Array.isArray(py.images) && py.images.length > 0) {
    console.log("  Python tier returned", py.images.length, "image URL(s)");
    const urls = py.images.map((i) => i.url).filter(Boolean);
    const pyResult = freshOrNull(
      await ocrImages(urls, "python"),
      "Python tier",
    );
    if (pyResult) return pyResult;
  }

  // Tier 3: OCR a manually uploaded image from menu-images/svoboda.{jpg,jpeg,png}
  console.log("  Python tier failed, trying local menu image...");
  const local = freshOrNull(await ocrLocalImage("svoboda"), "Local image");
  if (local) return local;

  // Tier 4: friendly fallback card pointing at Instagram
  console.log("  No fresh menu found, using fallback");
  return fallbackResult();
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

async function tryAutomated() {
  // Strategy 1: direct fetch API without auth (fast, works from home IPs)
  const fetchResult = await tryFetchStrategy({});
  if (fetchResult) return fetchResult;

  // Strategy 2: fetch API with IG session cookies (bypasses CI IP rate-limits)
  if (process.env.IG_COOKIES) {
    console.log("  Trying authenticated fetch with IG_COOKIES...");
    const igCookies = parseIgCookies(process.env.IG_COOKIES);
    const cookieStr = igCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrfToken =
      igCookies.find((c) => c.name === "csrftoken")?.value || "";
    const authResult = await tryFetchStrategy({ cookieStr, csrfToken });
    if (authResult) return authResult;
  }

  // Strategy 3: puppeteer — intercepts the API call Instagram's own JS makes
  console.log("  Fetch blocked, trying puppeteer...");
  let pupResult = await tryPuppeteerStrategy(true);

  // Strategy 4: a dead session poisons even the profile view (redirect to
  // login), while anonymous browsing sometimes gets through — retry clean
  if (!pupResult && process.env.IG_COOKIES) {
    console.log("  Retrying puppeteer anonymously (without cookies)...");
    pupResult = await tryPuppeteerStrategy(false);
  }
  return pupResult;
}

async function tryFetchStrategy({ cookieStr, csrfToken } = {}) {
  const extraHeaders = cookieStr
    ? { Cookie: cookieStr, "X-CSRFToken": csrfToken }
    : {};

  const apiRes = await fetch(
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=svoboda_reznictvi",
    { headers: { ...IG_FETCH_HEADERS, ...extraHeaders } },
  ).catch(() => null);

  if (!apiRes?.ok) {
    console.log(
      "  Instagram fetch API failed:",
      apiRes?.status ?? "network error",
    );
    return null;
  }

  const json = await apiRes.json();
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  console.log("  Fetch: found", edges.length, "posts");
  if (edges.length === 0) return null;

  const imageUrls = edges.map((e) => e.node.display_url).filter(Boolean);
  return ocrImages(imageUrls, "fetch");
}

async function tryPuppeteerStrategy(useCookies = true) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent(USER_AGENT);

    // Inject saved IG session cookies — a logged-in session reliably gets the
    // profile page (anonymous views hit the login wall most of the time)
    if (useCookies && process.env.IG_COOKIES) {
      const cookies = parseIgCookies(process.env.IG_COOKIES);
      await page.setCookie(...cookies);
      console.log("  Injected", cookies.length, "IG cookies");
    }

    // Intercept Instagram's own API/GraphQL calls — Instagram's JS makes these
    // requests from within the browser with proper fingerprinting headers
    const profileImages = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes("/api/v1/users/web_profile_info/") ||
        url.includes("/api/v1/feed/user/") ||
        url.includes("/graphql/query")
      ) {
        try {
          const json = await response.json().catch(() => null);
          if (json) profileImages.push(...extractPostImageUrls(json));
        } catch {}
      }
    });

    await page.goto("https://www.instagram.com/svoboda_reznictvi/", {
      waitUntil: "networkidle2",
      timeout: 45000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Login wall detection: an invalid/expired session gets redirected off the
    // profile URL (to / or /accounts/login). Surface this loudly — it means
    // ig_cookies.txt must be re-exported (see scrapers/py/README.md §4).
    const finalUrl = page.url();
    if (!finalUrl.includes("/svoboda_reznictvi")) {
      console.log("  Redirected to", finalUrl);
      if (useCookies && process.env.IG_COOKIES) {
        console.log(
          "  IG SESSION INVALID/EXPIRED — re-export ig_cookies.txt " +
            "(scrapers/py/README.md §4)",
        );
      }
      return null;
    }

    // Scroll to trigger any lazy-loaded API calls
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Last resort: grab the profile grid thumbnails straight from the DOM,
    // preferring the largest srcset candidate for OCR-able resolution
    if (profileImages.length === 0) {
      const domUrls = await page
        .evaluate(() =>
          Array.from(document.querySelectorAll("main img"))
            .map((img) => {
              const srcset = img.srcset
                ? img.srcset
                    .split(",")
                    .map((s) => s.trim().split(" ")[0])
                    .pop()
                : null;
              return srcset || img.src;
            })
            .filter((u) => u && u.includes("cdninstagram")),
        )
        .catch(() => []);
      profileImages.push(...domUrls);
      if (domUrls.length > 0) {
        console.log("  Collected", domUrls.length, "image URL(s) from DOM");
      }
    }

    console.log(
      "  Puppeteer: intercepted",
      profileImages.length,
      "image URL(s)",
    );

    if (profileImages.length === 0) {
      console.log("  No images intercepted via puppeteer");
      return null;
    }

    return ocrImages(profileImages, "puppeteer");
  } finally {
    await browser.close();
  }
}

async function ocrImages(imageUrls, source) {
  for (let idx = 0; idx < imageUrls.length; idx++) {
    const imageUrl = imageUrls[idx];
    console.log(
      " ",
      source,
      "trying image",
      idx + 1,
      "/",
      imageUrls.length,
      ":",
      imageUrl.substring(0, 80) + "...",
    );

    const imgRes = await fetch(imageUrl, {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent": USER_AGENT,
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
      console.log('  No "DENNÍ MENU" found, trying next...');
      continue;
    }

    console.log('  Found "DENNÍ MENU" in image', idx + 1);
    const parsed = parseMenuText(text);
    if (parsed) return parsed;
    console.log("  parseMenuText returned null, trying next...");
  }

  return null;
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
      return null;
    }
  }

  if (cleanSections.length === 0) return null;

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
    isFallback: true,
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Polední menu",
        items: [
          {
            prefix: "Menu nebylo nalezeno. Podívejte se na Instagram ",
            name: "@svoboda_reznictvi",
            price: "",
            link: "https://www.instagram.com/svoboda_reznictvi/",
          },
        ],
      },
    ],
  };
}

function isSupportedImageFormat(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true; // PNG
  return false;
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

function weekendResult() {
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
            name: "Podívejte se na Instagram @svoboda_reznictvi",
            price: "",
            link: "https://www.instagram.com/svoboda_reznictvi/",
          },
        ],
      },
    ],
  };
}

module.exports = { scrapeSvoboda, tryPuppeteerStrategy };
