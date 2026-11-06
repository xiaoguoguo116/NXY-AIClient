const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:8090'));
    assert(page);
    const input = page.getByRole('textbox', { name: '输入问题', exact: true });
    assert.equal(await input.inputValue(), '');
    await page.getByRole('button', { name: '＋ 新建对话', exact: true }).click();
    await input.fill('出差流程');
    await page.getByRole('button', { name: '发送 ↑', exact: true }).click();
    await page.waitForFunction(() => {
      const c = document.querySelector('ragflow-chat');
      return !c.busy && c.messages.at(-1)?.role === 'assistant';
    }, undefined, { timeout: 150000 });
    const result = await page.evaluate(() => {
      const c = document.querySelector('ragflow-chat'), m = c.messages.at(-1);
      return { question: '出差流程', answer: m.content, record: m.optimization?.record_id,
        options: m.clarification?.options || [], session: c.sessionId, complete: m.complete,
        error: c.shadowRoot.querySelector('.error').textContent };
    });
    assert(result.complete && !result.error);
    assert(result.options.length >= 2 && result.options.length <= 5);
    const options = page.locator('.message.assistant').last().locator('.option');
    assert.equal(await options.count(), result.options.length);
    for (const option of await options.all()) assert(await option.isEnabled());
    await options.first().evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(__dirname, 'travel-ready.png') });
    fs.writeFileSync(path.join(__dirname, 'show-travel.json'), JSON.stringify({ cases: [result] }, null, 2));
    console.log(JSON.stringify({ ready: true, options: result.options.length, record: result.record }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
