const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto('http://127.0.0.1:1425/tests/ai-navigation-preview.html')
    await page.waitForFunction(() => window.testRouter?.currentRoute.value.fullPath === '/home/ai?view=tasks')
    let transitions = 0
    async function go(target) {
      await page.evaluate(target => window.testRouter.push(target), target)
      // Allow both Vue watcher and queued redirect cycles to settle.
      await page.waitForTimeout(120)
      assert.equal(await page.evaluate(() => window.testRouter.currentRoute.value.fullPath), target)
      transitions++
    }
    for (const from of ['tasks', 'compare']) {
      for (const target of ['/home/todos', '/home/todos?view=meetings', '/home/todos?view=schedule', '/home/message', '/home/contacts', '/home/application', '/home/drive']) {
        await go(`/home/ai?view=${from}`)
        await go(target)
        assert.equal(await page.locator('#ai').count(), 0)
        assert.equal(await page.locator('#other').innerText(), target)
      }
    }
    for (const oldView of ['', '?view=knowledge', '?view=report', '?view=review', '?view=policy']) {
      await page.evaluate(target => window.testRouter.push(target), `/home/ai${oldView}`)
      await page.waitForFunction(() => window.testRouter.currentRoute.value.fullPath === '/home/ai?view=tasks')
      await go('/home/todos?view=schedule')
    }
    assert.deepEqual(errors, [])
    console.log(`PASS: ${transitions} settled navigation transitions with cached AI page, all module routes retained; legacy AI links normalize only within AI Work.`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
