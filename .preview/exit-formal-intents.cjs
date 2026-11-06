const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  const safe = await page.evaluate(() => !document.querySelector('[role=dialog]') && !JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.some(c => c.messages.some(m => m.status === 'pending')) && ![...document.querySelectorAll('textarea,input:not([type=checkbox]):not([type=radio])')].some(el => el.offsetParent !== null && el.value?.trim()))
  if (!safe) { await browser.close(); throw new Error('Active request, dialog or input; leave client open') }
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:process|exit', { code: 0 })).catch(() => {})
  await browser.close()
  console.log('Formal client exited normally after confirming no active work.')
})().catch(e => { console.error(e.message); process.exitCode = 1 })
