/**
 * Product-page overview (analog.com style): when the button block shares a
 * section with an h1, the h1 and a bold-only paragraph right after it
 * ("RECOMMENDED FOR NEW DESIGNS") become a title row with a status badge.
 * @param {Element} el The block element
 */
function decorateOverview(el) {
  const section = el.closest('.section');
  const h1 = section?.querySelector('.default-content > h1');
  if (!h1) return;
  section.classList.add('product-overview');
  const title = document.createElement('div');
  title.className = 'product-title';
  h1.before(title);
  title.append(h1);
  const next = title.nextElementSibling;
  const strong = next?.matches('p') && next.querySelector(':scope > strong:only-child');
  if (strong && next.textContent.trim() === strong.textContent.trim()) {
    next.className = 'product-badge';
    title.append(next);
  }
  // an h1 authored bold renders like any other h1
  const bold = h1.querySelector(':scope > strong:only-child');
  if (bold) bold.replaceWith(...bold.childNodes);
}

/**
 * Button: one or more authored links (e.g. "Data Sheet (Rev. 0)") rendered as
 * ADI call-to-action buttons. The first is solid ADI blue, the rest are ghost
 * buttons; a link to a PDF opens in a new tab.
 * @param {Element} el The block element
 */
export default function init(el) {
  const links = [...el.querySelectorAll('a')];
  const row = document.createElement('div');
  row.className = 'button-row';
  links.forEach((a) => {
    a.className = 'button-link';
    if (/\.pdf($|[?#])/i.test(a.href)) {
      a.classList.add('button-download');
      a.target = '_blank';
      a.rel = 'noopener';
    }
    row.append(a);
  });
  el.replaceChildren(row);
  decorateOverview(el);
}
