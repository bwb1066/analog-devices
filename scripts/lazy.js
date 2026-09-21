import ENV from './utils/env.js';
import initWebSDK from './websdk.js';
import initPersonalization from './personalization.js';

async function loadSidekick() {
  const getSk = () => document.querySelector('aem-sidekick');

  const sk = getSk() || await new Promise((resolve) => {
    document.addEventListener('sidekick-ready', () => resolve(getSk()));
  });
  if (sk) import('../tools/sidekick/sidekick.js').then((mod) => mod.default(sk));
}

(async function loadLazy() {
  const demoPanel = await import('./demo-panel.js');
  if (demoPanel.demoEnabled()) demoPanel.default();

  initWebSDK();
  initPersonalization();

  import('./utils/lazyhash.js');
  import('./utils/favicon.js');
  import('./utils/footer.js').then(({ default: footer }) => footer());

  // Author facing tools
  if (ENV !== 'prod') {
    import('../tools/scheduler/scheduler.js');
    loadSidekick();
  }
}());
