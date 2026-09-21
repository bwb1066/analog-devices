import config from '../../scripts/aep-config.js';

/**
 * persona-articles — a thought-leadership panel that swaps its cards to match
 * the visitor's current AEP audience (window.aepAudience). It reacts to the
 * `p13n:change` event, which fires both on a manual demo-panel persona switch
 * and when browsing signals shift the leading audience (see personalization.js).
 *
 * Authoring: one row per persona — first cell the audience key (e.g.
 * `design_engineer`, or `default` for the anonymous/fallback set), second cell
 * the articles as alternating <p> lines: a paragraph containing a link (the
 * title), optionally followed by a plain paragraph (its one-line description).
 */

const AUD_GLOBAL = config.audienceGlobal || 'aepAudience';
const LABELS = Object.fromEntries((config.audiences || []).map((a) => [a.key, a.label]));

function readGroups(block) {
  const groups = {};
  [...block.children].forEach((row) => {
    const [keyCell, contentCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/[\s/]+/g, '_');
    if (!key || !contentCell) return;
    const ps = [...contentCell.querySelectorAll(':scope > p')];
    const cards = [];
    let i = 0;
    while (i < ps.length) {
      const a = ps[i].querySelector('a');
      if (a) {
        const card = { title: a.textContent.trim(), href: a.getAttribute('href'), dek: '' };
        if (ps[i + 1] && !ps[i + 1].querySelector('a')) {
          card.dek = ps[i + 1].textContent.trim();
          i += 1;
        }
        cards.push(card);
      }
      i += 1;
    }
    if (cards.length) groups[key] = cards;
  });
  return groups;
}

function cardEl({ title, href, dek }) {
  const a = document.createElement('a');
  a.className = 'persona-article-card';
  a.href = href;
  a.innerHTML = `<span class="persona-article-title">${title}</span>${
    dek ? `<span class="persona-article-dek">${dek}</span>` : ''
  }<span class="persona-article-cta">Read more →</span>`;
  return a;
}

export default function decorate(block) {
  const groups = readGroups(block);
  const keys = Object.keys(groups);
  if (!keys.length) return;

  block.replaceChildren();
  const head = document.createElement('div');
  head.className = 'persona-articles-head';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'persona-articles-eyebrow';
  const title = document.createElement('h2');
  title.className = 'persona-articles-title';
  title.textContent = 'Insights & thought leadership';
  head.append(eyebrow, title);
  const grid = document.createElement('div');
  grid.className = 'persona-articles-grid';
  block.append(head, grid);

  const pickKey = (aud) => {
    if (aud && groups[aud]) return aud;
    if (groups.default) return 'default';
    return keys[0];
  };

  const render = (aud) => {
    const key = pickKey(aud);
    const label = LABELS[key];
    eyebrow.textContent = label ? `Personalized for ${label}` : 'For every engineer';
    grid.replaceChildren(...groups[key].map(cardEl));
    block.dataset.audience = key;
    // brief highlight so the swap is visible when the persona changes
    block.classList.remove('is-updated');
    // eslint-disable-next-line no-void
    void block.offsetWidth;
    block.classList.add('is-updated');
  };

  render(window[AUD_GLOBAL]);
  document.addEventListener('p13n:change', (e) => render(e.detail?.audience || window[AUD_GLOBAL]));
}
