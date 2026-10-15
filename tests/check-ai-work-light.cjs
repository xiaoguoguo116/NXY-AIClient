const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const output = 'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const pages = () => browser.contexts().flatMap(context => context.pages());
    const page = pages().find(page => page.url().includes('/home'));
    await page.locator('.home__sider-nav [aria-label="AI Work"]').click();
    await page.getByRole('button', { name: '任务助手', exact: true }).click();
    await page.locator('.workbench').waitFor({ state: 'visible' });
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await page.locator('.ai-work-light').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.screenshot({ path: output + 'em-task-light.png' });
    await page.getByRole('button', { name: '知识问答', exact: true }).click();
    let child;
    for (let i = 0; i < 30; i++) {
      child = pages().find(page => page.url().startsWith('http://127.0.0.1:8090/'));
      if (child) break;
      await page.waitForTimeout(500);
    }
    assert(child, 'knowledge native WebView exists');
    await child.locator('ragflow-chat .composer').waitFor();
    assert.equal(await child.locator('.demo-header').isVisible(), false);
    assert.equal(await page.locator('.embedded-toolbar').count(), 0);
    const layout = await child.locator('ragflow-chat').evaluate(el => {
      const root = el.shadowRoot;
      return {
        sidebar: root.querySelector('.sidebar').getBoundingClientRect().width,
        radius: getComputedStyle(root.querySelector('.shell')).borderRadius,
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    assert.equal(layout.sidebar, 246);
    assert.equal(layout.radius, '0px');
    assert.equal(layout.overflow, false);
    await child.screenshot({ path: output + 'em-knowledge-light.png' });
    await page.getByRole('button', { name: '任务助手', exact: true }).click();
    await page.locator('.workbench').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '知识问答', exact: true }).click();
    assert.equal(pages().filter(page => page.url().startsWith('http://127.0.0.1:8090/')).length, 1);
    console.log('PASS: light task theme, aligned knowledge sidebar, no duplicate headers, input and view switching');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
