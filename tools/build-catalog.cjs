/**
 * Turn a raw product scrape (the {productName, productPageUrl, productImageUrl,
 * productDescription} array that scrape-products.js emits) into the catalog
 * JSON the LOCAL commerce adapter reads — `{ products: [ ... ] }` where each
 * product has the shape commerce.js/product-cards/product-detail expect:
 *   { sku, name, description, category, image_url, product_url, list_price,
 *     uom, specs, price_breaks, stock_qty, lead_time_days, min_order_qty,
 *     restricted }
 *
 * Prices, stock, lead times and volume breaks are SYNTHESIZED deterministically
 * from a hash of the SKU (stable across re-runs) — this is demo pricing, not
 * real commerce data. Swap in a real feed here if/when one exists.
 *
 * Usage:
 *   node tools/build-catalog.js <site-key> [inFile] [outFile]
 *   node tools/build-catalog.js analog-devices \
 *     tools/products.json drafts/data/analog-devices-catalog.json
 */
const fs = require('fs');
const path = require('path');

const SITE = process.argv[2];
if (!SITE) {
  process.stderr.write('Usage: node tools/build-catalog.js <site-key> [inFile] [outFile]\n');
  process.exit(1);
}
const IN_FILE = path.resolve(process.argv[3] || 'tools/products.json');
const OUT_FILE = path.resolve(process.argv[4] || `drafts/data/${SITE}-catalog.json`);

// Deterministic 32-bit hash → stable pseudo-random per SKU.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand(seed, min, max) {
  return min + (hash(seed) % 1000) / 1000 * (max - min);
}

// Derive a SKU + a coarse category from the product page URL. The last path
// segment (minus extension) is the part number on most catalog sites; the
// segment before it is a usable category. Override the regex per site if the
// URL shape differs.
function skuFromUrl(url, name) {
  try {
    const parts = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const base = last.replace(/\.[a-z0-9]+$/i, '');
    if (base) return base.toUpperCase();
  } catch { /* fall through */ }
  return `SKU-${hash(name || url).toString(36).toUpperCase()}`;
}
function categoryFromUrl(url) {
  try {
    const parts = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const seg = parts[parts.length - 2] || '';
    return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch { return ''; }
}

function synthesize(sku) {
  const base = Math.round(rand(`price:${sku}`, 5, 500) * 100) / 100;
  const price = Math.max(1, base);
  return {
    list_price: price,
    price_breaks: [
      { min_qty: 25, unit_price: Math.round(price * 0.93 * 100) / 100 },
      { min_qty: 100, unit_price: Math.round(price * 0.85 * 100) / 100 },
      { min_qty: 1000, unit_price: Math.round(price * 0.72 * 100) / 100 },
    ],
    stock_qty: Math.round(rand(`stock:${sku}`, 0, 5000)),
    lead_time_days: hash(`lead:${sku}`) % 5 === 0 ? (hash(`ld:${sku}`) % 21) + 7 : 0,
    min_order_qty: 1,
  };
}

const raw = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
const rows = Array.isArray(raw) ? raw : (raw.products || []);
const seen = new Set();
const products = [];
for (const r of rows) {
  const name = (r.productName || '').trim();
  const url = r.productPageUrl || '';
  if (!name || !url) continue;
  const sku = skuFromUrl(url, name);
  if (seen.has(sku)) continue;
  seen.add(sku);
  products.push({
    sku,
    name,
    description: (r.productDescription || '').trim(),
    category: categoryFromUrl(url),
    image_url: r.productImageUrl || '',
    product_url: url,
    uom: 'each',
    specs: {},
    restricted: false,
    ...synthesize(sku),
  });
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ products }, null, 2), 'utf8');
process.stdout.write(`Wrote ${products.length} products → ${OUT_FILE}\n`);
