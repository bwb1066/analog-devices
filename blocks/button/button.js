/**
 * Button: one or more authored links (e.g. "Data Sheet (Rev. 0)") rendered as
 * ADI call-to-action buttons. Rows/cells are flattened to a single button row;
 * a link to a PDF gets a `button-download` class for the document treatment.
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
}
