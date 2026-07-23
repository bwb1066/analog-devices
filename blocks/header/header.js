import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';

const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';
const ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5H5l2.2 11a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.78L21 7.5H6"/></svg>';
const ICON_SPARKLE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2l1.7 5.1L18 8.7l-5.3 1.7L11 15l-1.7-4.6L4 8.7l5.3-1.6z"/><path d="M18.5 13.2l.85 2.45 2.45.85-2.45.85-.85 2.45-.85-2.45L15.2 16.5l2.45-.85z"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';

/* Search, cart, and brand-concierge (sparkle) actions — not authored; injected at
   the right of the primary nav. */
function buildPrimaryActions() {
  const wrap = document.createElement('div');
  wrap.className = 'primary-nav-actions';
  const actions = [
    ['search', 'Search', ICON_SEARCH],
    ['cart', 'Cart', ICON_CART],
    ['concierge', 'Brand Concierge', ICON_SPARKLE],
  ];
  for (const [cls, label, icon] of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nav-action nav-action-${cls}`;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = icon;
    wrap.append(btn);
  }
  return wrap;
}

/*
 * Header for the analog.com rebuild.
 *
 * Consumes the authored nav fragment, which is two sections of nested lists:
 *   section 0 — utility nav  (Account, Language & Region …)
 *   section 1 — primary nav  (Products, Software, AI … with deep sub-lists)
 *
 * Any top-level item that has a child <ul> becomes a dropdown/mega-panel that is
 * hidden until opened; leaf items stay plain links.
 */

/* Hamburger — only shown below the mobile breakpoint, where the nav collapses
   into a panel under the bar. */
function buildNavToggle(root) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-label', 'Open menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = ICON_MENU;
  btn.addEventListener('click', () => {
    const open = !root.classList.contains('is-nav-open');
    root.classList.toggle('is-nav-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    btn.innerHTML = open ? ICON_CLOSE : ICON_MENU;
    if (!open) root.querySelectorAll('li.is-open').forEach((li) => li.classList.remove('is-open'));
  });
  return btn;
}

function closeNav(root) {
  if (!root.classList.contains('is-nav-open')) return;
  root.classList.remove('is-nav-open');
  const btn = root.querySelector('.nav-toggle');
  if (!btn) return;
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = ICON_MENU;
}

function closeAll(root) {
  root.querySelectorAll('li.is-open').forEach((li) => {
    li.classList.remove('is-open');
    const t = li.querySelector(':scope > p [aria-expanded], :scope > p[aria-expanded], :scope > a[aria-expanded]');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
}

function wireDropdowns(topList, root) {
  for (const li of topList.querySelectorAll(':scope > li')) {
    const panel = li.querySelector(':scope > ul');
    if (!panel) continue; // leaf link — let it navigate
    li.classList.add('has-panel');
    const trigger = li.querySelector(':scope > p, :scope > a');
    if (!trigger) continue;
    const clickable = trigger.matches('a') ? trigger : (trigger.querySelector('a') || trigger);
    clickable.setAttribute('role', 'button');
    clickable.setAttribute('aria-expanded', 'false');
    clickable.addEventListener('click', (e) => {
      e.preventDefault();
      const open = li.classList.contains('is-open');
      closeAll(root);
      li.classList.toggle('is-open', !open);
      clickable.setAttribute('aria-expanded', String(!open));
    });
  }
}

function decorateNavSection(section, name, root) {
  section.classList.add(name);
  const topList = section.querySelector('ul');
  if (!topList) return;
  topList.classList.add(`${name}-list`);
  wireDropdowns(topList, root);
}

// strip authoring notes like "Log In (authentication control — no static URL)"
const cleanLabel = (s) => s.replace(/\s*\([^)]*\)\s*/g, '').trim();

/* Turn an SVG/PNG logo <img> into a mask so it can be themed to a solid color via
   CSS background-color (an <img>'s own fill can't be recolored). */
function maskedLogo(img, cls) {
  const span = document.createElement('span');
  span.className = cls;
  span.style.setProperty('--logo-src', `url("${img.currentSrc || img.src}")`);
  if (img.naturalWidth && img.naturalHeight) {
    span.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  }
  return span;
}

/* Utility strip: flatten the authored groups (Account, Language & Region) into a
   single inline row, ordered Language → Account to match the design, and tag each
   item so CSS can add the globe / $ / dividers / brand logo. */
function decorateUtility(section) {
  section.classList.add('utility-nav');
  const topList = section.querySelector('ul');
  if (!topList) return;
  topList.classList.add('utility-nav-list');

  const leaves = [];
  [...topList.querySelectorAll(':scope > li')].reverse().forEach((group) => {
    group.querySelectorAll(':scope > ul > li').forEach((leaf) => leaves.push(leaf));
  });

  for (const li of leaves) {
    const txt = li.textContent.replace(/\s+/g, ' ').trim();
    const img = li.querySelector('img');
    if (img) {
      li.classList.add('util-brand');
      const a = li.querySelector('a');
      const span = maskedLogo(img, 'util-brand-logo');
      if (a) { a.replaceChildren(span); li.replaceChildren(a); } else li.replaceChildren(span);
    } else if (/^eng/i.test(txt)) {
      li.classList.add('util-lang');
    } else if (/usd/i.test(txt)) {
      li.classList.add('util-currency');
    } else if (/log\s*in/i.test(txt)) {
      li.classList.add('util-auth', 'util-login');
      li.replaceChildren(document.createTextNode('Log In'));
    } else if (/sign\s*up/i.test(txt)) {
      li.classList.add('util-auth', 'util-signup');
      li.replaceChildren(document.createTextNode('Sign Up'));
    } else {
      li.replaceChildren(document.createTextNode(cleanLabel(txt)));
    }
  }
  topList.replaceChildren(...leaves);
}

/* Brand logo: authored as an SVG image; recolor it exactly to the brand blue with
   a mask (an <img>'s own fill can't be themed via CSS). */
function decorateBrand(section) {
  const img = section.querySelector(':scope > .default-content > p img, :scope > p img');
  if (!img) return;
  const p = img.closest('p');
  p.classList.add('brand');
  p.replaceChildren(maskedLogo(img, 'brand-logo'));
}

export default async function init(el) {
  const path = getMetadata('header') || HEADER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  fragment.classList.add('header-content');

  const sections = [...fragment.querySelectorAll(':scope > .section')];
  if (sections[0]) decorateUtility(sections[0]);
  if (sections[1]) {
    decorateBrand(sections[1]);
    decorateNavSection(sections[1], 'primary-nav', fragment);
    const bar = sections[1].querySelector('.default-content');
    bar?.prepend(buildNavToggle(fragment));
    bar?.append(buildPrimaryActions());
  }

  el.append(fragment);

  // Close any open dropdown (and the mobile panel) on outside click or Escape.
  document.addEventListener('click', (e) => {
    if (e.target.closest('header')) return;
    closeAll(fragment);
    closeNav(fragment);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAll(fragment);
    closeNav(fragment);
  });
}
