/*
 * what-we-do-cards
 * Row 0: intro (heading + subtext).
 * Row 1: a set of tables, each a card [ id label | image + title link ].
 * Renders the intro above a row of horizontal image + title cards.
 */

export default function init(el) {
  const rows = [...el.querySelectorAll(':scope > div')];
  rows[0]?.classList.add('wwd-intro');

  const cardsRow = rows[1];
  if (!cardsRow) return;
  cardsRow.classList.add('wwd-cards');
  const container = cardsRow.querySelector(':scope > div') || cardsRow;

  const cards = [...container.querySelectorAll('table')].map((table) => {
    const picture = table.querySelector('picture');
    const link = table.querySelector('a');

    const card = document.createElement(link ? 'a' : 'div');
    card.className = 'wwd-card';
    if (link) card.href = link.getAttribute('href');

    const media = document.createElement('div');
    media.className = 'wwd-card-media';
    if (picture) media.append(picture);

    const title = document.createElement('span');
    title.className = 'wwd-card-title';
    title.textContent = (link ? link.textContent : table.textContent).trim();

    card.append(media, title);
    return card;
  });

  container.replaceChildren(...cards);
}
