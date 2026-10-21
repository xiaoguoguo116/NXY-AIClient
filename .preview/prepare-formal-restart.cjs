const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
let connection
;(async () => {
  const browser = connection = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  assert(page)
  const snapshot = await page.evaluate(() => {
    const chats = JSON.parse(localStorage.getItem('em.local-chat.v1'))
    if (chats.conversations.some(c => c.messages.some(m => m.status === 'pending'))) throw Error('An AI request is running')
    if (document.querySelector('[role=dialog],dialog[open]')) throw Error('An editor dialog is open')
    const input = document.activeElement
    if (['INPUT','TEXTAREA'].includes(input?.tagName) && input.value) throw Error('Active draft detected')
    return { route: location.pathname, storage: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])) }
  })
  fs.writeFileSync(`${backup}/before-final-restart.json`, JSON.stringify(snapshot), { mode: 0o600 })
  // Preserve a screenshot of the completed real summary, then exit normally.
  await page.goto('http://tauri.localhost/home/message')
  await page.getByRole('button', { name: /移动审批·改版联调（模拟项目）/ }).evaluate(node => node.click())
  const result = JSON.parse(fs.readFileSync(`${backup}/native-summary-result.json`, 'utf8'))
  const bubble = page.locator(`[data-message-id="${result.answer.id}"] .bubble`)
  await bubble.waitFor()
  await bubble.evaluate(node => node.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/formal-native-summary.png' })
  await page.evaluate(() => {
    setTimeout(() => window.__TAURI_INTERNALS__.invoke('plugin:process|exit', { code: 0 }), 500)
  })
  await browser.close()
  console.log('Fresh storage snapshot and summary screenshot saved; normal app exit requested.')
})().catch(async error => { console.error(error.message); await connection?.close().catch(() => {}); process.exitCode = 1 })
