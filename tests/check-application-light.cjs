const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    await page.locator('.home__sider-nav [aria-label="应用"]').click();
    const card = page.locator('.ragflow-card');
    await card.waitFor();
    const layout = await card.evaluate(el => ({
      card: getComputedStyle(el).backgroundColor,
      page: getComputedStyle(el.closest('.application-center')).backgroundColor,
      columns: getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length,
      height: el.getBoundingClientRect().height,
      ratio: el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width
    }));
    assert.equal(layout.card, 'rgb(255, 255, 255)');
    assert.equal(layout.page, 'rgb(246, 249, 254)');
    assert.equal(layout.columns, 2);
    assert(layout.height < 240 && layout.ratio < .51, JSON.stringify(layout));
    await page.getByRole('button', { name: '配置地址', exact: true }).click();
    await page.getByRole('textbox', { name: 'RAGFlow 地址', exact: true }).waitFor();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    const search = page.locator('.application-center__search input');
    await search.fill('no-match-app');
    await page.getByText('没有匹配的常用应用。', { exact: true }).waitFor();
    await search.fill('');
    await card.waitFor();
    await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-application-light.png' });
    console.log('PASS: bright page and cards, compact two-column layout, address settings and search');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
