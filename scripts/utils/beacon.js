/**
 * Visit alerts: sends a few anonymous events to the visit-alerts Worker,
 * which pushes them to the site owner's phone (Pushover). Only on *.aem.live,
 * so .aem.page, localhost and DA previews never notify.
 *
 *   view    the page was visible for 3s (filters link scanners/previews)
 *   click   a button, mailto/tel, or a link leaving the site
 *   prompt  a Brand Concierge user prompt (its text)
 *   event   anything a block reports:
 *             document.dispatchEvent(new CustomEvent('beacon:event',
 *               { detail: { label: 'Tab: Capabilities' } }));
 *   leave   the page was hidden/closed
 *
 * Opt out per site with page metadata `visit-alerts: off`.
 */
import { getMetadata } from '../ak.js';

const ENDPOINT = 'https://visit-alerts.bwb1066.workers.dev/e';
const VISIBLE_MS = 3000;

function send(type, data = {}) {
  const body = JSON.stringify({
    type, path: window.location.pathname, title: document.title, ...data,
  });
  try {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
  } catch { /* never break the page */ }
}

function whenSeen(fn) {
  let timer;
  const check = () => {
    clearTimeout(timer);
    if (document.visibilityState === 'visible') {
      timer = setTimeout(() => {
        document.removeEventListener('visibilitychange', check);
        fn();
      }, VISIBLE_MS);
    }
  };
  document.addEventListener('visibilitychange', check);
  check();
}

function linkLabel(a) {
  const text = (a.textContent || a.getAttribute('aria-label') || a.title || '').trim();
  return text || a.href;
}

function onClick(e) {
  const a = e.target.closest?.('a[href]');
  if (!a) return;
  const url = new URL(a.href, window.location.href);
  const leaves = !/^https?:$/.test(url.protocol) || url.host !== window.location.host;
  if (!leaves && !a.matches('.btn, [class*="btn-"], .button')) return;
  send('click', { label: linkLabel(a) });
}

export default function initBeacon() {
  if (!window.location.hostname.endsWith('.aem.live')) return;
  if (getMetadata('visit-alerts') === 'off' || navigator.webdriver) return;

  whenSeen(() => {
    send('view');
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('beacon:event', (e) => {
      if (e.detail?.label) send('event', { label: e.detail.label });
    });
    document.addEventListener('brand-concierge:message', (e) => {
      if (e.detail?.role === 'user' && e.detail.prompt) send('prompt', { text: e.detail.prompt });
    });
    window.addEventListener('pagehide', () => send('leave'));
  });
}
