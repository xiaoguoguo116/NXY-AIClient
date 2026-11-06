const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('tauri.localhost/home'));
    assert(page, 'Packaged home must load');
    await page.goto('http://tauri.localhost/home/message');
    await page.locator('.local-chat').waitFor();
    const data = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('em.local-chat.v1'));
      return { version: d.caseLabelsVersion, names: d.conversations.map(c => c.name), count: d.conversations.length };
    });
    assert.equal(data.version, 1);
    assert(data.names.every(name => !/模拟|测试|演示|示例/.test(name)));
    await page.locator('.conversation').filter({ hasText: '项目协作群' }).first().click();
    await page.evaluate(async () => { for (const action of ['unminimize', 'show', 'set_focus']) await window.__TAURI_INTERNALS__.invoke('plugin:window|' + action, { label: 'home' }); });
    await page.screenshot({ path: '.preview/verification-20261104/final-chat.png' });
    fs.writeFileSync('.preview/verification-20261104/final-check.json', JSON.stringify({ status: 'passed', ...data }, null, 2));
    console.log('PASS: final packaged client loads; business labels persist after restart');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
