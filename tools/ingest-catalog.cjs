/**
 * Ingest the analog-devices catalog into the shared Brand Concierge backend
 * WITH embeddings, so the concierge recommends products (its cards are built
 * from vector similarity) AND they stay buyable (commerce fields included).
 * This REPLACES the rows the SQL seed wrote (the first chunk deletes-first),
 * because those had no embeddings.
 *
 * The brand-products POST endpoint computes the embedding server-side and
 * requires an admin token (the ADMIN_TOKEN function secret, or the Supabase
 * service-role key by default). It is NOT the public anon key — never commit it.
 *
 * Usage:
 *   ADMIN_TOKEN='<service-role-or-admin-token>' node tools/ingest-catalog.cjs
 */
const fs = require('fs');
const path = require('path');

const SITE = 'analog-devices';
const FN = 'https://cyjquwhkmzyedkwuaffc.supabase.co/functions/v1/brand-products';
// Public anon key — only satisfies the edge gateway; app auth is x-admin-token.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5anF1d2hrbXp5ZWRrd3VhZmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjY4MjcsImV4cCI6MjA5MDY0MjgyN30.GkMBLXBZr9u34m4uI6ZR-2ZniLZD3RkjropjQw058k4';
const CHUNK = 100; // < MAX_PRODUCTS (500); embeds in batches of 20 server-side

const ADMIN = process.env.ADMIN_TOKEN;
if (!ADMIN) {
  process.stderr.write('Set ADMIN_TOKEN (service-role key or ADMIN_TOKEN secret) in the env.\n');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve('tools/products.json'), 'utf8'));
const { products: cat } = JSON.parse(
  fs.readFileSync(path.resolve('drafts/data/analog-devices-catalog.json'), 'utf8'),
);
const bySku = new Map(cat.map((p) => [p.product_url, p]));

const payload = raw
  .filter((r) => r.productName && r.productPageUrl && r.productDescription)
  .map((r) => {
    const c = bySku.get(r.productPageUrl) || {};
    return {
      productName: r.productName,
      productPageUrl: r.productPageUrl,
      productDescription: r.productDescription,
      productImageUrl: r.productImageUrl || null,
      sku: c.sku,
      category: c.category,
      list_price: c.list_price,
      currency: 'USD',
      uom: c.uom || 'each',
      price_breaks: c.price_breaks,
      stock_qty: c.stock_qty,
      lead_time_days: c.lead_time_days,
      min_order_qty: c.min_order_qty || 1,
      active: true,
    };
  });

async function post(products, append) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: {
      apikey: ANON,
      authorization: `Bearer ${ANON}`,
      'x-admin-token': ADMIN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ site_key: SITE, products, append }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

(async () => {
  let total = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const append = i > 0; // first chunk replaces the catalog, rest append
    process.stdout.write(`Ingesting ${chunk.length} (append=${append})… `);
    // eslint-disable-next-line no-await-in-loop
    const r = await post(chunk, append);
    total += r.inserted || 0;
    process.stdout.write(`ok (${r.inserted})\n`);
  }
  process.stdout.write(`Done — ${total} products ingested with embeddings for ${SITE}.\n`);
})().catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
