const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    assert(page, 'EM home window must exist');
    await page.reload();
    await page.locator('.conversation', { hasText: '技术交流群（本地测试）' }).click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    assert.equal(await page.locator('.member-card').count(), 8);
    assert.equal(await page.locator('.message .bubble-wrap > small').filter({ hasText: '· 模拟成员' }).count(), 9);
    assert((await page.locator('.message.other .bubble-wrap > small').first().textContent()).includes('张工'));
    assert((await page.locator('.message.user').count()) >= 1);
    await page.getByRole('button', { name: '关闭面板' }).click();
    assert.equal(await page.locator('.chat-drawer').count(), 0);
    await page.reload();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.locator('.member-card').first().waitFor();
    assert.equal(await page.locator('.message .bubble-wrap > small').filter({ hasText: '· 模拟成员' }).count(), 9);
    await page.locator('.messages').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-members.png' });
    console.log('PASS: 8 members, 9 other-member messages, self alignment, member toggle, reload persistence');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
