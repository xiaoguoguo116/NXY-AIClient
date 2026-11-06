// Verify the packaged CSS without navigating away from the user's current page.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
;(async () => {
  const css = fs.readdirSync('dist/assets').find(name => /^ai-.*\.css$/.test(name))
  assert(css)
  const isolated = process.env.TASK_LAYOUT_ISOLATED === '1'
  const browser = isolated ? await chromium.launch({ channel: 'msedge', headless: true }) : await chromium.connectOverCDP(process.env.TASK_TEST_CDP_URL || 'http://127.0.0.1:19224')
  try {
    const page = isolated ? await browser.newPage({ viewport: { width: 1440, height: 1000 } }) : browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
    if (isolated) {
      await page.route('http://layout.test/**', route => route.fulfill(route.request().url().endsWith('.css') ? { contentType: 'text/css', body: fs.readFileSync(path.join('dist/assets', css), 'utf8') } : { contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }))
      await page.goto('http://layout.test/')
    }
    const result = await page.evaluate(async asset => {
      const response = await fetch(`/assets/${asset}`)
      if (!response.ok) throw new Error('Current application does not contain the latest CSS asset')
      const css = await response.text()
      const scope = css.match(/\.workbench__activity\[(data-v-[a-z0-9]+)\]/)?.[1]
      if (!scope) throw new Error('Missing task assistant style scope')
      const style = document.createElement('style'); style.textContent = css
      const root = document.createElement('main')
      root.className = 'workbench__main'
      root.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:500px;visibility:hidden'
      root.innerHTML = '<div class="workbench__chat-layout"><section class="workbench__chat">任务正文</section><aside class="workbench__activity"><div class="n-scrollbar-content"><div class="workbench__tools"><article><div><strong>write_text</strong><small></small></div></article></div></div></aside></div>'
      root.querySelector('small').textContent = 'C:/synthetic-long-directory/'.repeat(40) + 'result.txt'
      for (const node of [root, ...root.querySelectorAll('*')]) node.setAttribute(scope, '')
      document.head.append(style); document.body.append(root)
      try {
        return { asset, chatWidth: root.querySelector('.workbench__chat').getBoundingClientRect().width, activityWidth: root.querySelector('.workbench__activity').getBoundingClientRect().width, builtBundle: true }
      } finally { root.remove(); style.remove() }
    }, css)
    result.mode = isolated ? 'isolated-browser-final-production-css' : 'running-desktop-package'
    assert(result.chatWidth >= 600, 'long paths must not squeeze task text')
    assert(result.activityWidth <= 271, 'tool panel must remain bounded')
    fs.writeFileSync(path.resolve('.preview/office-verification/task-layout-final.json'), JSON.stringify(result, null, 2))
    console.log(`PASS: final production CSS, task text width ${result.chatWidth}px, activity width ${result.activityWidth}px with a 1,000+ character path; current user page unchanged.`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
