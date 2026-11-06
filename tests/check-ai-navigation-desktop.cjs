// Regression for cached AI Work hijacking the main sidebar. No edits, model calls or dialogs.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
;(async () => {
  const browser = await chromium.connectOverCDP(process.env.TASK_TEST_CDP_URL || 'http://127.0.0.1:19224')
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
    assert(page)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.evaluate(async () => {
      for (const action of ['unminimize', 'show', 'set_focus']) await window.__TAURI_INTERNALS__.invoke(`plugin:window|${action}`, { label: 'home' })
    })
    const tested = []
    async function clickModule(label, path) {
      await page.locator(`.home__sider-nav [aria-label="${label}"]`).click()
      await page.waitForURL(url => url.pathname === path, { timeout: 10000 })
      await page.waitForTimeout(400)
      assert.equal(new URL(page.url()).pathname, path, 'cached AI page must not redirect other modules')
      assert(await page.locator('.home__content').innerText(), 'module content must render')
      tested.push({ label, path })
    }
    for (const mode of ['tasks', 'compare']) {
      for (const [label, path] of [['待办事项', '/home/todos'], ['消息', '/home/message'], ['联系人', '/home/contacts'], ['应用', '/home/application']]) {
        await clickModule('AI Work', '/home/ai')
        if (mode === 'compare') {
          await page.locator('.workbench__nav').getByRole('button', { name: '制度比对', exact: true }).click()
          await page.locator('.cw-heading h2').waitFor()
        }
        await clickModule(label, path)
        assert.equal(await page.locator('.ai-shell').count(), 0)
      }
    }
    await clickModule('待办事项', '/home/todos')
    await page.screenshot({ path: '.preview/office-verification/navigation-fixed-desktop.png', fullPage: true })
    assert.deepEqual(errors, [])
    fs.writeFileSync('.preview/office-verification/navigation-fixed-desktop.json', JSON.stringify({ status: 'passed', tested, errors }, null, 2))
    console.log(`PASS: ${tested.length} real sidebar clicks; task and comparison pages can leave for todos/messages/contacts/applications without redirect; no page errors.`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
