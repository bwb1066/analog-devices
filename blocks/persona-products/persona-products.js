import store, { setThumb } from '../../scripts/commerce.js';
import config from '../../scripts/aep-config.js';

/**
 * persona-products — a commerce product rail that swaps its selection to match
 * the visitor's AEP audience (window.aepAudience), and re-prices when a demo
 * buyer logs in. Reacts to `p13n:change` (fired on persona switch, browsing
 * signals, and demo-panel buyer toggles), re-querying window.brandCommerce.
 *
 * Authoring: one row per persona — first cell the audience key (or `default`),
 * second cell a search query the commerce catalog is matched against.
 */

const AUD_GLOBAL = config.audienceGlobal || 'aepAudience';
const LIMIT = 4;

function readGroups(block) {
  const groups = {};
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/[\s/]+/g, '_');
    const query = valCell?.textContent.trim();
    if (key && query) groups[key] = query;
  });
  return groups;
}

function pill(product) {
  const el = document.createElement('span');
  el.className = 'persona-product-pill';
  if (product.stock_qty > 0) {
    el.classList.add('is-stock');
    el.textContent = 'In stock';
  } else {
    el.classList.add('is-lead');
    el.textContent = `Backordered · ${product.lead_time_days}d`;
  }
  return el;
}

function buildCard(product) {
  const href = product.sku
    ? `${store.pdpUrl}?sku=${encodeURIComponent(product.sku)}`
    : (product.product_url || '#');
  const card = document.createElement('article');
  card.className = 'persona-product-card';

  const media = document.createElement('a');
  media.className = 'persona-product-media';
  media.href = href;
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  setThumb(img, product.image_url);
  media.append(img, pill(product));

  const body = document.createElement('div');
  body.className = 'persona-product-body';
  const unit = store.resolvePrice(product, 1);
  const vol = (product.price_breaks || []).length
    ? ' <span class="persona-product-vol">volume pricing</span>' : '';
  body.innerHTML = `<p class="persona-product-eyebrow">${product.category || ''}</p>`
    + `<h3 class="persona-product-title"><a href="${href}">${product.name}</a></h3>`
    + `<p class="persona-product-price"><strong>${store.formatPrice(unit)}</strong>${vol}</p>`;

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'persona-product-add';
  add.textContent = store.ctaLabel || 'Add to quote';
  add.addEventListener('click', async () => {
    await store.addToQuote(product.sku, 1, 'web');
    add.textContent = 'Added ✓';
    add.classList.add('is-added');
    setTimeout(() => {
      add.textContent = store.ctaLabel || 'Add to quote';
      add.classList.remove('is-added');
    }, 1400);
  });
  body.append(add);
  card.append(media, body);
  return card;
}

export default function decorate(block) {
  const groups = readGroups(block);
  const keys = Object.keys(groups);
  if (!keys.length) return;

  block.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'persona-products-title';
  title.textContent = 'Recommended products';
  const grid = document.createElement('div');
  grid.className = 'persona-products-grid';
  block.append(title, grid);

  const pickKey = (aud) => {
    if (aud && groups[aud]) return aud;
    if (groups.default) return 'default';
    return keys[0];
  };

  let token = 0;
  const render = async (aud) => {
    const query = groups[pickKey(aud)];
    token += 1;
    const mine = token;
    const products = await store.search({ query, limit: LIMIT });
    if (mine !== token) return; // a newer render superseded this one
    grid.replaceChildren(...products.map(buildCard));
    block.classList.remove('is-updated');
    // eslint-disable-next-line no-void
    void block.offsetWidth;
    block.classList.add('is-updated');
  };

  render(window[AUD_GLOBAL]);
  document.addEventListener('p13n:change', (e) => render(e.detail?.audience || window[AUD_GLOBAL]));
}
