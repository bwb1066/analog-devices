import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const FOOTER_PATH = '/fragments/nav/footer';

/* Brand icons, keyed by the authored link text. */
const SOCIAL_ICONS = {
  engineerzone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.2 5.2h17.6v11.2H12l-5 3.6v-3.6H3.2z" stroke-linejoin="round"/><text x="12" y="12.6" text-anchor="middle" font-size="7" font-family="sans-serif" fill="currentColor" stroke="none">EZ</text></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9.75h4v11.25H3zM10 9.75h3.83v1.54h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.14V21h-4v-4.98c0-1.19-.02-2.72-1.65-2.72-1.66 0-1.91 1.3-1.91 2.64V21h-4z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>',
  // evenodd so the play triangle punches a hole rather than filling over the body
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10.2 15.1V8.9L15.5 12z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.6L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03zm-1.12 16.06h1.77L7.67 4.84H5.77z"/></svg>',
};

const iconFor = (text) => {
  const key = Object.keys(SOCIAL_ICONS).find((k) => text.toLowerCase().includes(k));
  return key ? SOCIAL_ICONS[key] : null;
};

/* Turn an SVG/PNG logo <img> into a mask so it can be themed to a solid color
   via CSS background-color (an <img>'s own fill can't be recolored). */
function maskedLogo(img, cls) {
  const span = document.createElement('span');
  span.className = cls;
  span.style.setProperty('--logo-src', `url("${img.currentSrc || img.src}")`);
  if (img.naturalWidth && img.naturalHeight) {
    span.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  }
  return span;
}

const ICON_CHEVRON = '<svg class="footer-col-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

/* A plain link column: heading + list of links. */
function decorateLinkColumn(col, heading, links) {
  col.classList.add('footer-col');
  heading?.classList.add('footer-col-heading');
  links?.classList.add('footer-col-links');
}

/* Below the breakpoint the link columns collapse behind their heading. The
   toggle is always wired; CSS decides whether it does anything. */
function makeCollapsible(col, heading) {
  if (!heading) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'footer-col-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `<span>${heading.textContent.trim()}</span>${ICON_CHEVRON}`;
  btn.addEventListener('click', () => {
    const open = !col.classList.contains('is-open');
    col.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
  heading.replaceChildren(btn);
}

/* myAnalog: a blurb plus a button, rather than a list of links. */
function decorateMyAnalog(col, heading, links) {
  decorateLinkColumn(col, heading, links);
  col.classList.add('footer-myanalog');
  for (const li of [...links?.children || []]) {
    const a = li.querySelector('a');
    if (a) a.classList.add('footer-myanalog-cta', 'btn');
    else li.classList.add('footer-myanalog-text');
  }
}

/* The myAnalog wordmark + "Log In | Sign Up" pair that sits below the columns. */
function decorateAccount(col, img, links) {
  col.classList.add('footer-account');
  img.closest('p').replaceChildren(maskedLogo(img, 'footer-account-logo'));
  const li = links?.querySelector('li');
  if (!li) return;
  links.classList.add('footer-account-links');
  const parts = li.textContent.split('|').map((s) => s.trim()).filter(Boolean);
  li.replaceChildren(...parts.map((label) => {
    const span = document.createElement('span');
    span.className = 'footer-account-link';
    span.textContent = /log\s*in/i.test(label) ? 'Log In' : label;
    return span;
  }));
}

/* "ENG $ USD" — split so CSS can hang the globe and currency glyphs off each. */
function decorateLocale(col) {
  col.classList.add('footer-locale');
  const p = col.querySelector(':scope > p');
  if (!p) return;
  const [, lang = '', currency = ''] = p.textContent.trim().match(/^(\S+)\s*\$?\s*(\S*)$/) || [];
  p.replaceChildren();
  if (lang) {
    const span = document.createElement('span');
    span.className = 'footer-locale-lang';
    span.textContent = lang;
    p.append(span);
  }
  if (currency) {
    const span = document.createElement('span');
    span.className = 'footer-locale-currency';
    span.textContent = currency;
    p.append(span);
  }
}

/* Social: the authored text links become a row of brand icons. */
function decorateSocial(col, heading, links) {
  col.classList.add('footer-social');
  heading?.remove();
  links?.classList.add('footer-social-links');
  // a video URL here would have been autoblocked into an embed — never wanted
  links?.querySelectorAll('.video, iframe').forEach((embed) => embed.closest('li')?.remove());
  for (const a of [...links?.querySelectorAll('a') || []]) {
    const label = a.textContent.trim();
    const icon = iconFor(label);
    if (!icon) continue;
    a.innerHTML = `${icon}<span class="footer-social-label">${label}</span>`;
    a.setAttribute('aria-label', label);
    a.classList.add('footer-social-link');
    // the EZ mark draws letters — hide the art so it can't contradict the name
    a.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  }
}

/**
 * loads and decorates the footer
 * - first section → 4 columns (ADI logo, About ADI, Find Help, myAnalog), then a
 *   utility row of account + locale on the left and social icons on the right
 * - last section  → legal links + copyright bar
 * @param {Element} el The footer element
 */
export default async function init(el) {
  const { locale } = getConfig();
  const path = getMetadata('footer') || FOOTER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  fragment.classList.add('footer-content');

  const sections = [...fragment.querySelectorAll(':scope > .section')];
  const columns = sections[0];
  const bottom = sections[sections.length - 1];

  if (columns) {
    columns.classList.add('footer-columns');
    const list = columns.querySelector('ul');
    if (list) {
      list.classList.add('footer-columns-list');
      for (const col of [...list.querySelectorAll(':scope > li')]) {
        const heading = col.querySelector(':scope > p');
        const links = col.querySelector(':scope > ul');
        const img = col.querySelector(':scope > p img');
        const label = (heading?.textContent || '').trim();

        if (img && !links) {
          col.classList.add('footer-brand');
          heading.replaceChildren(maskedLogo(img, 'footer-brand-logo'));
        } else if (img) {
          decorateAccount(col, img, links);
        } else if (!links && /eng|usd/i.test(label)) {
          decorateLocale(col);
        } else if (/^social$/i.test(label)) {
          decorateSocial(col, heading, links);
        } else if (/myanalog/i.test(label)) {
          decorateMyAnalog(col, heading, links);
        } else if (links || label) {
          decorateLinkColumn(col, heading, links);
          makeCollapsible(col, heading);
        } else {
          col.remove();
        }
      }
    }
  }

  if (bottom && bottom !== columns) {
    bottom.classList.add('footer-bottom');
  }
  if (bottom) {
    const legal = bottom.querySelector('ul');
    if (legal) {
      legal.classList.add('footer-legal');
      // drop the "Legal" group heading — the bar shows the links inline
      const heading = legal.querySelector(':scope > li > p');
      if (heading) heading.remove();
    }
    const copyright = bottom.querySelector(':scope > .default-content > p');
    if (copyright) copyright.classList.add('footer-copyright');
  }

  el.append(fragment);
}
