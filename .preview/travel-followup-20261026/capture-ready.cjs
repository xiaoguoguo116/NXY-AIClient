const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const child = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:8090'));
    await child.locator('.message.assistant').last().locator('.option').first().evaluate(el => el.scrollIntoView({ block: 'start' }));
    await child.screenshot({ path: path.join(__dirname, 'travel-ready.png') });
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
