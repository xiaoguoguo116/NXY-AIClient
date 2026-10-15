const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const pages = () => browser.contexts().flatMap(context => context.pages());
    const page = pages().find(page => page.url().includes('/home'));
    await page.locator('.home__sider-nav [aria-label="应用"]').click();
    await page.getByRole('heading', { name: 'Markdown 文档上传智能体', exact: true }).waitFor();
    const search = page.locator('.application-center__search input');
    await search.fill('markdown');
    assert.equal(await page.getByRole('button', { name: '打开 RAGFlow', exact: true }).count(), 0);
    await page.getByRole('button', { name: '打开智能体', exact: true }).click();
    await page.getByRole('button', { name: '返回应用中心', exact: true }).waitFor();
    let child;
    for (let attempt = 0; attempt < 30; attempt++) {
      child = pages().find(page => page.url().startsWith('http://127.0.0.1:8092/'));
      if (child) break;
      await page.waitForTimeout(500);
    }
    assert(child, '8092 must open as a native child WebView');
    await child.waitForLoadState('domcontentloaded');
    console.log('Embedded page title:', await child.title());
    assert((await child.locator('body').innerText()).length > 30, 'agent UI must render');
    console.log('Upload inputs:', await child.locator('input[type="file"]').count());
    assert(await child.locator('input[type="file"]').count() > 0, 'upload control must exist');
    await child.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-markdown-agent.png' });
    const access = await child.evaluate(async () => {
      if (!window.__TAURI_INTERNALS__) return 'no-ipc';
      try {
        await window.__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file', { path: 'D:/ai/NXY-AIClient/README.md' });
        return 'allowed';
      } catch { return 'denied'; }
    });
    assert.notEqual(access, 'allowed', 'embedded service must not gain host filesystem privileges');
    await page.locator('.home__sider-nav [aria-label="消息"]').click();
    await page.locator('.local-chat').waitFor({ state: 'visible' });
    await page.locator('.home__sider-nav [aria-label="应用"]').click();
    await page.getByRole('button', { name: '返回应用中心', exact: true }).click();
    await page.locator('.embedded-toolbar').waitFor({ state: 'detached' });
    await search.fill('');
    await page.getByRole('button', { name: '打开 RAGFlow', exact: true }).waitFor();
    await page.getByRole('button', { name: '打开智能体', exact: true }).waitFor();
    await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-markdown-card.png' });
    console.log('PASS: search, native embedding, navigation, return, and isolated remote permissions');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
