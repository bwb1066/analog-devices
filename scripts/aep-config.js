/**
 * Site-specific configuration for the Adobe Web SDK / AEP integration
 * (websdk.js, personalization.js, demo-panel.js). Centralizing these values
 * here is what makes those three modules portable across sites — they are
 * copied verbatim and only this file changes per site.
 */
export default {
  // The XDM tenant namespace every custom field goes under. An AEP tenant id
  // is assigned ONCE PER IMS ORG, not chosen per site. Left as a placeholder
  // until a real AEP schema exists for this org — events simply fail schema
  // validation (harmlessly) until it's corrected. When set, use the exact
  // same value as every other site sharing that org/datastream.
  tenantId: '_yourtenantid',

  // This replica's identifier, included on every tracked event so a
  // datastream/schema shared across multiple sites can be filtered per site.
  site: 'analog-devices',

  // The Brand Concierge widget dispatches this event on both user and
  // assistant turns, so chat tracking works as soon as both skills are wired.
  chatEventName: 'brand-concierge:message',

  // Label for the demo panel's persona-switch event (inspector-only).
  decisionScope: 'homepage',

  // Audience segments this site cares about. `match` classifies free text
  // (a chat turn, product name, page content — whatever a signal source
  // passes to `classify()`) into a segment; the demo panel uses `key`/`label`
  // to build its persona-switcher buttons.
  audiences: [
    {
      key: 'design_engineer',
      label: 'Design Engineer',
      match: /datasheet|reference design|eval(uation)? board|schematic|pinout|spice|ltspice|op[\s-]?amp|amplifier|\badc\b|\bdac\b|converter|signal chain|package|parametric/i,
    },
    {
      key: 'procurement',
      label: 'Procurement / Sourcing',
      match: /pric(e|ing)|availability|in stock|lead time|lifecycle|obsolet|buy|purchase|order|distributor|digikey|mouser|\bmoq\b|quote|quantity/i,
    },
    {
      key: 'systems_architect',
      label: 'Systems Architect',
      match: /system|architecture|application note|block diagram|design[\s-]?in|requirement|compare|comparison|roadmap|power budget|solution/i,
    },
    {
      key: 'ai_agent',
      label: 'AI Agent / Machine',
      match: /\bagent\b|\bmcp\b|bill of materials|\bbom\b|machine[\s-]?readable|structured data|\bapi\b|\bjson\b|parts list|drone|wearable/i,
    },
  ],

  // "Log in as" demo identity for the demo panel. Toggling it fires an
  // identity.authenticatedState event and calls window.brandCommerce.useBuyer(id).
  // `id` is the email the commerce_buyers row is keyed on (site_key+email), so
  // contract pricing (price_book) and the export-controlled entitlement resolve
  // server-side. See the commerce_buyers seed run for analog-devices.
  demoPersonas: [
    {
      id: 'buyer@aero-primecontractor.com',
      label: 'Aerospace Prime Contractor',
      note: 'contract pricing + export-controlled access',
      extra: { accountType: 'contract', segment: 'aerospace-defense' },
    },
  ],

  // Track the commerce store's add-to-quote as an AEP signal (both the
  // storefront blocks and the concierge add-to-quote bridge write one quote via
  // window.brandCommerce). Seed `counted` from the synchronous getQuote() so a
  // restored quote on page load isn't mistaken for a fresh add — otherwise the
  // very first real add-to-quote click gets silently swallowed.
  async wireExtraSignals({ classify, recordSignal, track }) {
    const { default: store } = await import('./commerce.js');
    const counted = new Set((store.getQuote()?.lines || []).map((l) => String(l.sku)));
    store.subscribe((quote) => {
      (quote?.lines || []).forEach((line) => {
        const sku = String(line.sku);
        if (counted.has(sku)) return;
        counted.add(sku);
        track('commerce.productListAdds', {
          standard: {
            commerce: { productListAdds: { value: 1 } },
            productListItems: [{
              SKU: sku,
              name: line.name,
              quantity: line.qty,
              priceTotal: { value: line.qty * line.unit_price },
            }],
          },
        });
        recordSignal(classify(line.name), 'commerce', { sku });
      });
    });
  },
};
