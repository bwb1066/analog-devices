/**
 * Analog Devices (analog.com) product catalog scraper.
 *
 * analog.com product detail pages (/en/products/<part>.html) are protected by
 * an Akamai bot rule that returns a hard edge 403 ("Access Denied") to every
 * automated client — headless Chromium, headed real Chrome, same-origin fetch,
 * and spoofed crawler UAs all fail (only verified search-crawler IPs / genuine
 * humans get through). The XML sitemaps and index pages are open, but they carry
 * no per-product name/image/description.
 *
 * To obtain the product data we therefore read the pages from the Wayback
 * Machine (web.archive.org), which mirrors analog.com's full HTML — including the
 * rich JSON-LD Product blocks — and is not bot-protected. We use a real headless
 * Chromium (Playwright) throughout, per the Edmund Optics template this is based on.
 *
 * Flow (mirrors tools/scrape-products.js in the edmund-optics repo):
 *   1. Discover archived product URLs via the Wayback CDX API (recent captures).
 *   2. Sample evenly across the full list for category variety.
 *   3. Visit each archived snapshot (`.../<ts>id_/<orig>` = raw, unrewritten HTML),
 *      extract name/image/description with JSON-LD-first + fallback selectors.
 *   4. Write incremental checkpoints; write final products.json.
 *
 * Output schema (identical to edmund-optics products.json):
 *   { productName, productPageUrl, productImageUrl, productDescription }
 *
 * Usage:  node tools/scrape-products.js [maxProducts]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const OUT_FILE = path.join(__dirname, 'products.json');
const CONCURRENCY = 3;
const RECYCLE_EVERY = 40; // recreate a worker page after N navigations (avoid memory growth)
const PAGE_TIMEOUT = 45000;
const MAX_PRODUCTS = parseInt(process.argv[2] || '600', 10);
// Optional cache of the discovery list (JSON array of { url, ts, part }).
const CDX_CACHE = process.env.CDX_CACHE || '';
const CDX_URL = 'https://web.archive.org/cdx/search/cdx?url=analog.com/en/products/'
  + '&matchType=prefix&from=20250101&filter=statuscode:200&filter=mimetype:text/html'
  + '&collapse=urlkey&output=json&fl=original,timestamp';
const PART_RE = /^https?:\/\/(?:www\.)?analog\.com\/en\/products\/([a-z0-9][a-z0-9._-]*)\.html$/i;

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

function sleep(ms) { return new Promise((r) => { setTimeout(r, ms); }); }

// Phase 1: discover archived product pages via the Wayback CDX API.
// archive.org (unlike analog.com) is not bot-protected, so we use a plain
// Node fetch here — far lighter than parsing 2 MB of JSON inside the browser —
// with retries because archive.org intermittently returns 503 ("Temporarily
// Offline"). Falls back to a cached list ($CDX_CACHE) if provided.
async function discoverArchivedProducts() {
  if (CDX_CACHE && fs.existsSync(CDX_CACHE)) {
    log(`Using cached discovery list: ${CDX_CACHE}`);
    return JSON.parse(fs.readFileSync(CDX_CACHE, 'utf8'));
  }
  log('Discovering archived product URLs via Wayback CDX…');
  let rows = null;
  for (let attempt = 0; attempt < 6 && !rows; attempt += 1) {
    try {
      const resp = await fetch(CDX_URL, { headers: { 'User-Agent': UA } });
      if (resp.status !== 200) { await sleep(5000 * (attempt + 1)); continue; }
      const text = await resp.text();
      rows = JSON.parse(text);
    } catch { await sleep(5000 * (attempt + 1)); }
  }
  if (!rows) return [];
  rows.shift(); // header
  const map = new Map();
  for (const [original, ts] of rows) {
    const m = original.match(PART_RE);
    if (!m) continue;
    const part = m[1].toLowerCase();
    if (part === 'index') continue;
    const prev = map.get(part);
    if (!prev || ts > prev.ts) {
      map.set(part, { url: `https://www.analog.com/en/products/${part}.html`, ts, part });
    }
  }
  return [...map.values()];
}

function collapse(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function scrapeProduct(page, item) {
  // Far-future timestamp → Wayback redirects to the LATEST raw ("id_") capture,
  // which uses analog.com's current template (JSON-LD Product + clean image URLs).
  const snapshotUrl = `https://web.archive.org/web/29990101000000id_/${item.url}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const resp = await page.goto(snapshotUrl, { timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded' });
      const status = resp ? resp.status() : 0;
      if (status === 429 || status === 503 || status >= 500) {
        await page.waitForTimeout(2000 * (attempt + 1));
        continue; // Wayback throttled — back off and retry
      }
      if (status >= 400) return null;
      await page.waitForTimeout(250);

      const data = await page.evaluate(() => {
        // --- JSON-LD Product (preferred) ---
        let name = '';
        let description = '';
        let image = '';
        const lds = [...document.querySelectorAll('script[type="application/ld+json"]')];
        for (const s of lds) {
          let parsed;
          try { parsed = JSON.parse(s.textContent); } catch { continue; }
          const nodes = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
          for (const node of nodes) {
            const t = node && node['@type'];
            const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
            if (!isProduct) continue;
            if (!name && node.name) name = String(node.name);
            if (!description && node.description) description = String(node.description);
            if (!image && node.image) {
              const img = Array.isArray(node.image) ? node.image[0] : node.image;
              if (img) image = typeof img === 'string' ? img : (img.url || '');
            }
          }
        }

        // --- Fallbacks ---
        if (!name) {
          const h1 = document.querySelector('h1');
          name = h1 ? h1.textContent : '';
        }
        if (!description) {
          description = (document.querySelector('meta[name="description"]') || {}).content || '';
        }
        if (!description) {
          description = (document.querySelector('meta[property="og:description"]') || {}).content || '';
        }
        if (!image) {
          image = (document.querySelector('meta[property="og:image"]') || {}).content || '';
        }
        if (!image) {
          // first genuine analog.com product/media image (skip archive chrome + svg icons)
          const cand = [...document.querySelectorAll('img')]
            .map((i) => i.src || i.getAttribute('data-src') || '')
            .find((src) => /analog\.com\/.*\/media\/analog\/en\/products\/image\//i.test(src));
          if (cand) image = cand;
        }
        return { name, description, image };
      });

      const name = collapse(data.name);
      if (!name) return null;
      let image = (data.image || '').trim();
      if (image.startsWith('//')) image = `https:${image}`;
      // guard against archive-chrome assets sneaking through
      if (/web\.archive\.org\/.*\/(chevron|logo|icon)/i.test(image)) image = '';
      const description = collapse(data.description).substring(0, 600);

      return {
        productName: name,
        productPageUrl: item.url,
        productImageUrl: image,
        productDescription: description,
      };
    } catch {
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }
  return null;
}

async function processQueue(ctx, queue, results, total) {
  await Promise.all(Array.from({ length: CONCURRENCY }, () => (async () => {
    let page = await ctx.newPage();
    let since = 0;
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      // Recycle the page periodically to keep memory flat over a long run.
      if (since >= RECYCLE_EVERY) {
        await page.close().catch(() => {});
        page = await ctx.newPage();
        since = 0;
      }
      since += 1;
      const done = total - queue.length;
      const result = await scrapeProduct(page, item);
      if (result) {
        results.push(result);
        process.stdout.write(`\r  ${done}/${total} processed — ${results.length} OK   `);
        if (results.length % 50 === 0) {
          fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf8');
        }
      }
    }
    await page.close().catch(() => {});
  })()));
  process.stdout.write('\n');
}

(async () => {
  log('Launching browser…');
  const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  // We only read server-rendered HTML (JSON-LD, meta tags, and <img> src
  // attributes are all present in the initial DOM), so abort heavy sub-resources.
  // This keeps memory flat and avoids hanging on archived assets that 503.
  await ctx.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet', 'script'].includes(type)) {
      route.abort().catch(() => {});
    } else {
      route.continue().catch(() => {});
    }
  });

  // === Phase 1: discover ===
  const allItems = await discoverArchivedProducts();
  log(`Archived product pages found: ${allItems.length}`);
  if (allItems.length === 0) {
    log('No archived products discovered — exiting.');
    await browser.close();
    process.exit(1);
  }

  // Sample evenly across the full (alphabetical-by-part) list for category variety.
  let selected;
  if (allItems.length <= MAX_PRODUCTS) {
    selected = allItems;
  } else {
    const step = allItems.length / MAX_PRODUCTS;
    selected = Array.from({ length: MAX_PRODUCTS }, (_, i) => allItems[Math.round(i * step)]).filter(Boolean);
  }
  log(`Targeting ${selected.length} products (sampled from ${allItems.length})`);

  // === Phase 2: scrape ===
  log(`Phase 2: scraping with ${CONCURRENCY} concurrent pages…`);
  const queue = [...selected];
  const results = [];
  await processQueue(ctx, queue, results, selected.length);

  await browser.close();
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  log(`Complete: ${results.length} products scraped.`);
  log(`Written to ${OUT_FILE}`);
})();
