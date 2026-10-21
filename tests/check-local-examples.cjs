const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createHotContext(){return {data:{},on(){},accept(){},prune(){},dispose(){},invalidate(){}}};export function injectQuery(url){return url};export function updateStyle(id,css){let el=document.getElementById(id);if(!el){el=document.createElement("style");el.id=id;document.head.append(el)}el.textContent=css};export function removeStyle(id){document.getElementById(id)?.remove()}' }))
    await page.route('**/src/utils/desktop/notification.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function showNotification(){throw Error("Example data must not notify")}' }))
    await page.route('**/__examples-test.html', route => route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0"><div id="app" style="height:100vh"></div><script type="module" src="/tests/rag-preview.ts"></script></body></html>'
    }))
    await page.addInitScript(() => {
      if (!localStorage.getItem('em.local-chat.v1')) localStorage.setItem('em.local-chat.v1', JSON.stringify({
        version: 1, selectedId: 'existing',
        conversations: [{ id: 'existing', name: '原有会话', messages: [
          { id: 'old', role: 'user', text: '原有记录不能丢失', status: 'done', createdAt: '2026-10-01T00:00:00Z' }
        ] }]
      }))
    })
    await page.goto('http://127.0.0.1:1420/__examples-test.html')
    await page.getByText('原有记录不能丢失', { exact: true }).last().waitFor()
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')))
    const initial = await snapshot()
    assert.equal(initial.selectedId, 'existing')
    assert.equal(initial.conversations.length, 8)
    assert.equal(initial.exampleGroupsVersion, 2)
    for (const name of ['项目协作群', '研发讨论群', '值班协调群', '日常交流群']) {
      await page.getByRole('button', { name: new RegExp(`${name}（本地示例）`) }).click()
      assert.equal(await page.locator('.bubble').count(), 8)
      const saved = await snapshot()
      assert.equal(saved.conversations.find(chat => chat.id === saved.selectedId).messages.length, 8)
    }
    for (const name of ['客户工单平台·一期交付', '企业知识库·检索优化', '移动审批·改版联调']) {
      await page.getByRole('button', { name: new RegExp(`${name}（模拟项目）`) }).click()
      assert.equal(await page.locator('.bubble').count(), 18)
    }
    await page.getByRole('button', { name: /项目协作群（本地示例）/ }).click()
    await page.screenshot({ path: '.preview/local-example-groups.png', fullPage: true })
    const beforeReload = await snapshot()
    await page.reload()
    await page.getByText('先把待确认项整理好，评审时按清单逐项讨论。', { exact: true }).last().waitFor()
    assert.deepEqual(await snapshot(), beforeReload)
    await page.getByRole('button', { name: /原有会话/ }).click()
    await page.getByText('原有记录不能丢失', { exact: true }).last().waitFor()
    // Corrupt storage must not be silently replaced by the examples.
    await page.evaluate(() => localStorage.setItem('em.local-chat.v1', '{broken'))
    await page.reload()
    await page.getByRole('button', { name: '导出原始记录', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('em.local-chat.v1')), '{broken')
    assert.equal(await page.locator('.conversation').count(), 0)
    console.log('PASS: seven groups, 86 messages, old records retained, refresh idempotent, corrupt storage preserved')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
