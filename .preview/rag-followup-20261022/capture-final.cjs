const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:8090'));
    const report = require('./rag-startup-result.json');
    const first = report.checks.find(c => c.label === 'broad-question');
    await page.evaluate(async id => {
      const chat = document.querySelector('ragflow-chat');
      await chat.runBusy(() => chat.loadSession(id));
      chat.shadowRoot.querySelector('.clarify').scrollIntoView({block:'start'});
    }, first.sessionId);
    await page.locator('.clarify').screenshot({path: path.join(__dirname, 'five-options.png'), timeout:10000});
    console.log('Saved verified desktop followup options screenshot.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
