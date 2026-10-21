const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  try {
    const page = browser.contexts().flatMap(context => context.pages())
      .find(page => page.url().startsWith('http://tauri.localhost/home/'))
    if (!page) throw new Error('Expected EM main window not found')
    const state = await page.evaluate(() => ({
      busy: !!document.querySelector('.workbench__composer--busy'),
      drafts: [...document.querySelectorAll('textarea')].some(input => input.value.trim()),
      canExit: typeof window.__TAURI_INTERNALS__?.invoke === 'function'
    }))
    if (state.busy || state.drafts) throw new Error('Client has an active task or an unsaved draft; restart deferred')
    if (!state.canExit) throw new Error('Native exit command unavailable')
    await page.evaluate(() => {
      setTimeout(() => window.__TAURI_INTERNALS__.invoke('plugin:process|exit', { code: 0 }), 200)
    })
    console.log('Requested normal exit of the verified old EM client.')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
