import store from '../../scripts/commerce.js';

/**
 * product-detail — the interactive commerce panel for a single product: full
 * spec sheet, live availability (stock or lead time), a quantity-break price
 * grid, and a quantity-aware Add-to-quote. This is the "one turn answers
 * availability + volume price + lead time" moment made visible on the page.
 *
 * Authoring contract:
 *   | product-detail |
 *   | sku | 42722 |
 *
 * Tenant-generic: the spec sheet renders whatever keys a product's `specs`
 * map carries, so the same block serves any catalog.
 * @param {Element} block The block element
 */

function readSku(block) {
  let sku = '';
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = row.children;
    if (keyCell?.textContent.trim().toLowerCase() === 'sku') sku = valCell?.textContent.trim() || '';
  });
  return sku;
}

function specSheet(product) {
  const dl = document.createElement('dl');
  dl.className = 'product-detail-specs';
  Object.entries(product.specs || {})
    .filter(([, v]) => v && !/^n\/a$/i.test(v))
    .forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
  return dl;
}

function priceGrid(product, activeQty) {
  const table = document.createElement('table');
  table.className = 'product-detail-breaks';
  table.innerHTML = '<thead><tr><th>Quantity</th><th>Unit price</th></tr></thead>';
  const tbody = document.createElement('tbody');
  const rows = store.priceTable(product);
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    const label = next ? `${row.min_qty}–${next.min_qty - 1}` : `${row.min_qty}+`;
    const active = activeQty >= row.min_qty && (!next || activeQty < next.min_qty);
    const tr = document.createElement('tr');
    if (active) tr.className = 'is-active';
    tr.innerHTML = `<td>${label}</td><td>${store.formatPrice(row.unit_price)}</td>`;
    tbody.append(tr);
  });
  table.append(tbody);
  return table;
}

export default async function decorate(block) {
  // Dynamic PDP: ?sku=<sku> in the URL wins, so one page template serves every
  // catalog product; the authored `sku` row is the fallback/default.
  const urlSku = (typeof window !== 'undefined')
    ? new URLSearchParams(window.location.search).get('sku') : null;
  const sku = urlSku || readSku(block);
  const product = await store.getProduct(sku);

  if (!product) {
    block.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'product-detail-notice';
    notice.textContent = sku
      ? `Item #${sku} is not available in this catalog view.`
      : 'No product specified.';
    block.append(notice);
    return;
  }

  const buyer = store.getBuyer();
  let qty = product.min_order_qty || 1;

  const panel = document.createElement('div');
  panel.className = 'product-detail-inner';

  const head = document.createElement('div');
  head.className = 'product-detail-head';
  head.innerHTML = `
    <p class="product-detail-eyebrow">${product.category || ''}</p>
    <h1 class="product-detail-name">${product.name}</h1>
    <p class="product-detail-sku">Item #${product.sku}</p>
    <p class="product-detail-desc">${product.description || ''}</p>`;

  if (product.restricted) {
    const flag = document.createElement('p');
    flag.className = 'product-detail-restricted';
    flag.textContent = `${product.restriction || 'DEA controlled substance — DEA account and entitlement required'}. Shown because your entitlement is active.`;
    head.append(flag);
  }

  const avail = document.createElement('p');
  avail.className = 'product-detail-avail';
  if (product.stock_qty > 0) {
    avail.innerHTML = `<span class="is-stock">In stock</span> · ${product.stock_qty} available${product.lead_time_days ? ` · ${product.lead_time_days}-day lead beyond stock` : ''}`;
  } else {
    avail.innerHTML = `<span class="is-lead">Backordered</span> · ${product.lead_time_days}-day lead time`;
  }

  const buy = document.createElement('div');
  buy.className = 'product-detail-buy';

  const priceLine = document.createElement('p');
  priceLine.className = 'product-detail-price';

  const grid = document.createElement('div');
  grid.className = 'product-detail-grid-wrap';

  const controls = document.createElement('div');
  controls.className = 'product-detail-controls';
  controls.innerHTML = `
    <label class="product-detail-qtylabel">Qty
      <input type="number" class="product-detail-qty" min="${product.min_order_qty || 1}" value="${qty}">
    </label>
    <button type="button" class="product-detail-add">Add to quote</button>`;

  const qtyInput = controls.querySelector('.product-detail-qty');
  const addBtn = controls.querySelector('.product-detail-add');

  const refresh = () => {
    const unit = store.resolvePrice(product, qty, buyer);
    priceLine.innerHTML = `<strong>${store.formatPrice(unit)}</strong> <span>/ ${product.uom || 'each'} at qty ${qty}</span>`;
    grid.replaceChildren(priceGrid(product, qty));
  };

  qtyInput.addEventListener('input', () => {
    qty = Math.max(product.min_order_qty || 1, parseInt(qtyInput.value, 10) || 1);
    refresh();
  });
  addBtn.addEventListener('click', async () => {
    await store.addToQuote(product.sku, qty, 'web');
    addBtn.textContent = 'Added ✓';
    addBtn.classList.add('is-added');
    setTimeout(() => {
      addBtn.textContent = 'Add to quote';
      addBtn.classList.remove('is-added');
    }, 1400);
  });

  buy.append(priceLine, avail, grid, controls);
  panel.append(head, specSheet(product), buy);
  block.replaceChildren(panel);
  refresh();
}
