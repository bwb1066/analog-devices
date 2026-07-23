/*
 * industry-tabs
 * A tabbed "industry explorer". One tab per industry, authored either as a
 * nested table inside a single `industry-tabs` block (preferred — lets the
 * section keep a heading), or as consecutive `industry-tabs` blocks that get
 * grouped together. Both shapes parse to the same tab model.
 *
 * Desktop: a horizontal tab strip swaps a background image (subtle zoom-in)
 * overlaid with positioned hotspot toggles (label pills). Clicking a toggle
 * fades the others out and expands it into a floating popup card; closing the
 * card restores the toggles.
 *
 * Mobile: the tab strip becomes a dropdown; hotspots become numbered pins on
 * the image plus a matching numbered accordion list below it — expanding a row
 * reveals the same card content inline.
 *
 * Row shapes inside a tab (order-independent — detected by content):
 *   [ label | background image ]                      -> tab label + background
 *   [ portfolio cta link ]                             -> bottom "Browse …" CTA
 *   [ label | "x%, y%" | image | description | cta ]   -> a hotspot
 */

const POS_RE = /(\d+(?:\.\d+)?)\s*%\s*,\s*(\d+(?:\.\d+)?)\s*%/;
const MOBILE = window.matchMedia('(max-width: 899px)');

const EQ_ICON = '<svg class="industry-tab-hotspot-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="9" width="14" height="2.2" rx="1.1"/><rect x="5" y="13" width="14" height="2.2" rx="1.1"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CHEVRON = '<svg class="industry-tab-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function cellHas(cell, sel) {
  return cell ? cell.querySelector(sel) : null;
}

/* A tab is either a nested <table> (rows are <tr>/<td>, and the first row just
   repeats the block name) or a whole block (rows are nested divs). */
function rowsOf(container) {
  if (container.tagName === 'TABLE') {
    const rows = [...container.querySelectorAll(':scope > tbody > tr, :scope > tr')];
    const first = rows[0];
    const isNameRow = first && first.children.length === 1
      && /^industry-tabs?$/i.test(first.textContent.trim());
    return isNameRow ? rows.slice(1) : rows;
  }
  return [...container.querySelectorAll(':scope > div')];
}

function cellsOf(row) {
  return row.tagName === 'TR'
    ? [...row.children]
    : [...row.querySelectorAll(':scope > div')];
}

function parseHotspot(cells, row) {
  const posCell = cells.find((c) => POS_RE.test(c.textContent));
  const [, x, y] = posCell.textContent.match(POS_RE);
  const picture = row.querySelector('picture');
  const cta = row.querySelector('a');
  const label = cells[0]?.textContent.trim();

  const descCell = cells.find((c) => c !== cells[0]
    && c !== posCell
    && !cellHas(c, 'picture')
    && !cellHas(c, 'a')
    && c.textContent.trim());
  const desc = (descCell || cells[3])?.textContent.trim() || '';

  return { label, x: parseFloat(x), y: parseFloat(y), picture, desc, cta };
}

/* Sort background pictures into desktop back/front layers + a mobile image.
   EDS hashes uploaded filenames, so we key off alt text (or any surviving src
   hint) first — front / back / mobile — and fall back to authoring order
   (front, back, mobile) for whatever isn't tagged. */
function classifyBg(pics) {
  const slot = { back: null, front: null, mobile: null };
  const rest = [];
  for (const pic of pics) {
    const img = pic.querySelector('img');
    const hint = `${img?.getAttribute('alt') || ''} ${img?.getAttribute('src') || ''}`.toLowerCase();
    if (!slot.front && (/front/.test(hint) || /[-_]fr(?![a-z])/.test(hint))) slot.front = pic;
    else if (!slot.back && /back/.test(hint)) slot.back = pic;
    else if (!slot.mobile && (/mobile/.test(hint) || /[-_]m(ob|b)(?![a-z])/.test(hint))) slot.mobile = pic;
    else rest.push(pic);
  }
  for (const key of ['front', 'back', 'mobile']) {
    if (!slot[key] && rest.length) slot[key] = rest.shift();
  }
  return slot;
}

function parseTab(container) {
  const rows = rowsOf(container);
  const tab = { label: '', bgImages: [], cta: null, hotspots: [] };

  for (const row of rows) {
    const cells = cellsOf(row);
    if (cells.some((c) => POS_RE.test(c.textContent))) {
      tab.hotspots.push(parseHotspot(cells, row));
    } else if (row.querySelector('picture')) {
      tab.bgImages.push(...row.querySelectorAll('picture'));
      const t = cells[0]?.textContent.trim();
      if (t && !tab.label) tab.label = t;
      // The portfolio CTA is sometimes authored alongside the background images.
      const link = row.querySelector('a');
      if (link && !tab.cta && link.textContent.trim()) tab.cta = link;
    } else if (row.querySelector('a')) {
      tab.cta = row.querySelector('a');
      if (!tab.label) tab.label = cells[0]?.textContent.trim() || '';
    } else if (!tab.label) {
      tab.label = cells[0]?.textContent.trim() || '';
    }
  }
  tab.bg = classifyBg(tab.bgImages);
  return tab;
}

/* The card shown for a hotspot — reused for the desktop popup and the mobile
   accordion. Built fresh on open; the picture/cta nodes persist via the
   hotspot reference and move with the card. */
function buildCard(hotspot, onClose) {
  const card = document.createElement('div');
  card.className = 'industry-tab-card';

  if (onClose) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'industry-tab-card-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', onClose);
    card.append(close);
  }

  const body = document.createElement('div');
  body.className = 'industry-tab-card-body';

  if (hotspot.picture) {
    const media = document.createElement('div');
    media.className = 'industry-tab-card-media';
    media.append(hotspot.picture);
    body.append(media);
  }
  if (hotspot.label) {
    const title = document.createElement('h3');
    title.className = 'industry-tab-card-title';
    title.textContent = hotspot.label;
    body.append(title);
  }
  if (hotspot.desc) {
    const p = document.createElement('p');
    p.className = 'industry-tab-card-desc';
    p.textContent = hotspot.desc;
    body.append(p);
  }
  if (hotspot.cta) {
    hotspot.cta.classList.add('industry-tab-card-cta', 'btn');
    if (!hotspot.cta.textContent.trim()) hotspot.cta.textContent = 'Explore Solutions';
    body.append(hotspot.cta);
  }

  card.append(body);
  return card;
}

function clampCard(card, media, hotspot) {
  const pad = 16;
  const mb = media.getBoundingClientRect();
  const pw = card.offsetWidth;
  const ph = card.offsetHeight;
  const hx = (hotspot.x / 100) * mb.width;
  const hy = (hotspot.y / 100) * mb.height;

  let left = hx - pw / 2;
  let top = hy - ph / 2;
  left = Math.min(Math.max(pad, left), Math.max(pad, mb.width - pw - pad));
  top = Math.min(Math.max(pad, top), Math.max(pad, mb.height - ph - pad));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function buildPanel(tab, idx) {
  const panel = document.createElement('div');
  panel.className = 'industry-tab-panel';
  panel.id = `industry-panel-${idx}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `industry-tab-${idx}`);
  panel.hidden = idx !== 0;

  const media = document.createElement('div');
  media.className = 'industry-tab-media';

  const addLayer = (pic, cls) => {
    if (!pic) return;
    const layer = document.createElement('div');
    layer.className = `industry-tab-bg ${cls}`;
    layer.append(pic);
    media.append(layer);
  };
  addLayer(tab.bg.back, 'industry-tab-bg-back');
  addLayer(tab.bg.front, 'industry-tab-bg-front');
  addLayer(tab.bg.mobile, 'industry-tab-bg-mobile');
  // A dedicated mobile image has its pins baked in — suppress the rendered ones.
  if (tab.bg.mobile) media.classList.add('has-mobile-img');

  const hotspots = document.createElement('div');
  hotspots.className = 'industry-tab-hotspots';

  const list = document.createElement('div');
  list.className = 'industry-tab-accordion';

  let openIdx = null;

  const closeOpen = () => {
    if (openIdx === null) return;
    const prev = openIdx;
    openIdx = null;
    media.classList.remove('has-popup');
    media.querySelector(':scope > .industry-tab-card')?.remove();
    const item = list.children[prev];
    if (item) {
      item.classList.remove('is-open');
      item.querySelector('.industry-tab-accordion-panel').innerHTML = '';
      item.querySelector('.industry-tab-accordion-trigger').setAttribute('aria-expanded', 'false');
    }
    hotspots.children[prev]?.classList.remove('is-open');
  };

  const open = (i, returnFocusEl) => {
    if (openIdx === i) { closeOpen(); return; }
    closeOpen();
    openIdx = i;
    const hotspot = tab.hotspots[i];
    hotspots.children[i]?.classList.add('is-open');

    if (MOBILE.matches) {
      const item = list.children[i];
      const card = buildCard(hotspot, null);
      const cPanel = item.querySelector('.industry-tab-accordion-panel');
      cPanel.append(card);
      item.classList.add('is-open');
      item.querySelector('.industry-tab-accordion-trigger').setAttribute('aria-expanded', 'true');
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      const card = buildCard(hotspot, closeOpen);
      card.classList.add('is-popup');
      media.classList.add('has-popup');
      media.append(card);
      clampCard(card, media, hotspot);
      card.querySelector('.industry-tab-card-close').focus();
    }
    if (returnFocusEl) panel.returnFocusEl = returnFocusEl;
  };

  tab.hotspots.forEach((hotspot, i) => {
    // Pin on the image (label pill on desktop, number on mobile).
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'industry-tab-hotspot';
    pin.style.left = `${hotspot.x}%`;
    pin.style.top = `${hotspot.y}%`;
    pin.innerHTML = `<span class="industry-tab-hotspot-num">${i + 1}</span>`
      + `<span class="industry-tab-hotspot-label">${hotspot.label || ''}</span>${EQ_ICON}`;
    pin.setAttribute('aria-label', hotspot.label || `Open details ${i + 1}`);
    pin.addEventListener('click', () => open(i, pin));
    hotspots.append(pin);

    // Accordion row below the image (mobile).
    const item = document.createElement('div');
    item.className = 'industry-tab-accordion-item';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'industry-tab-accordion-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="industry-tab-accordion-num">${i + 1}.</span>`
      + `<span class="industry-tab-accordion-label">${hotspot.label || ''}</span>${CHEVRON}`;
    trigger.addEventListener('click', () => open(i, trigger));
    const accPanel = document.createElement('div');
    accPanel.className = 'industry-tab-accordion-panel';
    item.append(trigger, accPanel);
    list.append(item);
  });

  media.append(hotspots);
  panel.append(media, list);
  panel.closePopup = closeOpen;

  if (tab.cta) {
    tab.cta.classList.add('industry-tab-portfolio', 'btn');
    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'industry-tab-portfolio-wrap';
    ctaWrap.append(tab.cta);
    // Lives at panel level: overlays the image on desktop, flows below on mobile.
    panel.append(ctaWrap);
  }

  return panel;
}

function buildTabset(group) {
  const tabs = group.map(parseTab);
  // Data Center is pre-selected when present; otherwise the first tab.
  const initial = Math.max(0, tabs.findIndex((t) => /data\s*center/i.test(t.label)));
  const first = group[0];

  const root = document.createElement('div');
  root.className = 'industry-tabset';

  const tablist = document.createElement('div');
  tablist.className = 'industry-tab-list';
  tablist.setAttribute('role', 'tablist');

  // Mobile dropdown mirror of the tab strip.
  const select = document.createElement('select');
  select.className = 'industry-tab-select';
  select.setAttribute('aria-label', 'Select an industry');

  const panelStack = document.createElement('div');
  panelStack.className = 'industry-tab-panels';

  const buttons = [];
  const panels = [];
  const isBuilt = [];

  /* Panels are only assembled when their tab is first shown — building all ten
     up front costs ~500 DOM elements for content nobody has asked for yet. */
  const ensurePanel = (idx) => {
    if (isBuilt[idx]) return panels[idx];
    const panel = buildPanel(tabs[idx], idx);
    panel.hidden = panels[idx].hidden;
    panels[idx].replaceWith(panel);
    panels[idx] = panel;
    isBuilt[idx] = true;
    return panel;
  };

  const activate = (idx) => {
    ensurePanel(idx);
    buttons.forEach((b, i) => {
      const active = i === idx;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.tabIndex = active ? 0 : -1;
    });
    panels.forEach((p, i) => {
      if (i !== idx) p.closePopup?.();
      p.hidden = i !== idx;
    });
    if (select.selectedIndex !== idx) select.selectedIndex = idx;
    const media = panels[idx].querySelector('.industry-tab-media');
    media.classList.remove('is-zooming');
    void media.offsetWidth; // reflow so the zoom animation restarts each time
    media.classList.add('is-zooming');
  };

  tabs.forEach((tab, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'industry-tab-button';
    btn.id = `industry-tab-${idx}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `industry-panel-${idx}`);
    btn.setAttribute('aria-selected', idx === initial ? 'true' : 'false');
    btn.tabIndex = idx === initial ? 0 : -1;
    if (idx === initial) btn.classList.add('is-active');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => activate(idx));
    btn.addEventListener('keydown', (e) => {
      let next;
      if (e.key === 'ArrowRight') next = (idx + 1) % buttons.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + buttons.length) % buttons.length;
      else return;
      e.preventDefault();
      buttons[next].focus();
      activate(next);
    });
    buttons.push(btn);
    tablist.append(btn);

    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = tab.label;
    select.append(opt);

    // placeholder; ensurePanel swaps in the real panel on first activation
    const panel = document.createElement('div');
    panel.className = 'industry-tab-panel';
    panel.id = `industry-panel-${idx}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `industry-tab-${idx}`);
    panel.hidden = idx !== initial;
    panels.push(panel);
    panelStack.append(panel);
  });

  select.addEventListener('change', () => activate(select.selectedIndex));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openPanel = panels.find((p) => !p.hidden);
      openPanel?.closePopup?.();
    }
  });

  // Close any open card when crossing the layout breakpoint (the card belongs
  // to a different slot on each side of it).
  MOBILE.addEventListener('change', () => {
    panels.forEach((p) => p.closePopup?.());
  });

  const selectWrap = document.createElement('div');
  selectWrap.className = 'industry-tab-select-wrap';
  selectWrap.append(select);

  root.append(tablist, selectWrap, panelStack);

  first.replaceWith(root);
  group.slice(1).forEach((b) => b.remove());

  // Synchronous, not rAF: a page loaded in a background tab never gets a frame,
  // which would leave the opening tab's panel empty.
  activate(initial);
}

export default function init(el) {
  // Preferred shape: one nested table per tab, inside a single block.
  const tables = [...el.querySelectorAll('table')];
  if (tables.length) {
    buildTabset(tables);
    return;
  }

  const parent = el.parentElement;
  // A sibling block may have already absorbed and detached this one.
  if (!parent) return;
  const group = [...parent.querySelectorAll(':scope > .industry-tabs')];
  // Only the first block in a run assembles the whole tabset.
  if (group[0] !== el) return;
  buildTabset(group);
}
