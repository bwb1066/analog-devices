/**
 * Brand Concierge glue — lazy-loads the portable widget from its canonical
 * home (github.com/bwb1066/brand-concierge, served off GitHub Pages) and
 * opens it. Nothing here is fetched until the user actually asks for it.
 *
 * The widget's own CSS auto-load looks for a <script src*="brand-concierge">
 * tag, which never exists when it's pulled in as a module — so WIDGET_BASE is
 * passed explicitly as `widgetBase` for it to resolve the stylesheet against.
 */

const WIDGET_BASE = 'https://bwb1066.github.io/brand-concierge/widget/';
const SITE_KEY = 'analog-devices';

// Public read-only credentials (anon key, no write access) — the same pair the
// config UI ships with.
const SUPABASE_URL = 'https://cyjquwhkmzyedkwuaffc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5anF1d2hrbXp5ZWRrd3VhZmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjY4MjcsImV4cCI6MjA5MDY0MjgyN30.GkMBLXBZr9u34m4uI6ZR-2ZniLZD3RkjropjQw058k4';

let loading = null;

/**
 * Import + init the widget once; repeat calls share the same promise.
 * @returns {Promise<Function>} the widget's `open(query)` entry point
 */
function loadWidget() {
  if (!loading) {
    loading = import(/* webpackIgnore: true */ `${WIDGET_BASE}brand-concierge.js`)
      .then((mod) => {
        mod.init({
          supabaseUrl: SUPABASE_URL,
          anonKey: SUPABASE_ANON_KEY,
          siteKey: SITE_KEY,
          widgetBase: WIDGET_BASE,
          // the sparkle action in the nav is the trigger — don't also float a
          // bubble over the page
          showTrigger: false,
        });
        return mod.default;
      })
      .catch((e) => {
        loading = null; // let a later click retry
        throw e;
      });
  }
  return loading;
}

/** Warm the module cache on hover/focus so the first click opens instantly. */
export function prefetch() {
  loadWidget().catch(() => { /* prefetch is best-effort */ });
}

/**
 * Open the concierge modal.
 * @param {string} [query] optional question to send immediately
 */
export default async function openConcierge(query) {
  const open = await loadWidget();
  await open(query);
}
