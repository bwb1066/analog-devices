/*
 * main-hero-carousel
 * Each top-level row is a slide: [ background image | heading + text + CTA ].
 * Slides sit in a flex track that translates horizontally (0.75s) between slides,
 * auto-advancing every 10s. Dot controls live inside each slide's content so they
 * slide with it and keep consistent spacing below the CTA.
 */

export default function init(el) {
  const slides = [...el.querySelectorAll(':scope > div')];
  if (!slides.length) return;

  const track = document.createElement('div');
  track.className = 'hero-track';

  let current = 0;
  let timer;

  const go = (i) => {
    current = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
  };

  const restart = () => {
    if (slides.length < 2) return;
    clearInterval(timer);
    timer = setInterval(() => go(current + 1), 10000);
  };

  slides.forEach((slide, i) => {
    slide.classList.add('hero-slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    const cells = slide.querySelectorAll(':scope > div');
    cells[0]?.classList.add('hero-media');
    const content = cells[1];
    content?.classList.add('hero-content');

    if (slides.length > 1 && content) {
      const dots = document.createElement('div');
      dots.className = 'hero-dots';
      // a group of controls, not a tablist — plain buttons aren't valid tabs
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', 'Choose a slide');
      slides.forEach((_, j) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'hero-dot';
        dot.setAttribute('aria-label', `Go to slide ${j + 1}`);
        if (j === i) dot.classList.add('is-active');
        dot.addEventListener('click', () => { go(j); restart(); });
        dots.append(dot);
      });
      content.append(dots);
    }

    track.append(slide);
  });

  el.append(track);

  el.addEventListener('mouseenter', () => clearInterval(timer));
  el.addEventListener('mouseleave', restart);
  restart();
}
