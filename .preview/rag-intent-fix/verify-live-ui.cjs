const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const completions = []
  page.setDefaultTimeout(120000)
  try {
    await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createHotContext(){return {data:{},on(){},accept(){},prune(){},dispose(){},invalidate(){}}};export function injectQuery(url){return url};export function updateStyle(id,css){let el=document.getElementById(id);if(!el){el=document.createElement("style");el.id=id;document.head.append(el)}el.textContent=css};export function removeStyle(id){document.getElementById(id)?.remove()}' }))
    await page.route('**/src/utils/desktop/notification.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function showNotification(){return true}' }))
    await page.route('**/__rag-live-test.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><div id="app" style="height:100vh"></div><script type="module" src="/tests/rag-preview.ts"></script></body></html>' }))
    // Only adapt native HTTP to the browser. Every RAG response is from the
    // live gateway and its actual knowledge base, never a canned answer.
    await page.route('**/@tauri-apps_plugin-http.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const fetch = globalThis.fetch.bind(globalThis)' }))
    await page.route('http://127.0.0.1:8090/**', async route => {
      const request = route.request()
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const response = await fetch(request.url(), {
        method: request.method(), headers: { 'Content-Type': 'application/json' },
        ...(request.postData() ? { body: request.postData() } : {})
      })
      const body = await response.text()
      if (request.url().endsWith('/completions')) {
        let final, streamedAnswer = ''
        for (const line of body.split('\n').filter(line => line.startsWith('data:'))) {
          try {
            const data = JSON.parse(line.slice(5)).data
            if (data?.final) final = data
            else if (typeof data?.answer === 'string') streamedAnswer += data.answer
          } catch {}
        }
        completions.push({ request: request.postDataJSON(), final, answer: final?.answer || streamedAnswer })
      }
      await route.fulfill({ status: response.status, headers: {
        ...headers, 'Content-Type': response.headers.get('content-type') || 'application/json'
      }, body })
    })
    await page.addInitScript(() => {
      localStorage.setItem('em.local-chat.v1', JSON.stringify({
        version: 1, selectedId: 'rag-live-verification',
        conversations: [{ id: 'rag-live-verification', name: '真实问答验证（隔离测试）', messages: [] }]
      }))
    })
    await page.goto('http://127.0.0.1:1420/__rag-live-test.html')
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true })
    await page.getByRole('button', { name: '@AI RAG助手 制度问答', exact: true }).click()
    assert.equal(await input.inputValue(), '@AI RAG助手 ')
    await input.fill('@AI RAG助手 加值班')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    const clarification = page.locator('.rag-clarification').first()
    await clarification.getByRole('button').filter({ hasText: '加班' }).first().waitFor()
    await clarification.getByRole('button').filter({ hasText: '值班' }).first().waitFor()
    assert.ok(completions[0].final.diagnostics.preprocessing.intent_parts.includes('加班'))
    assert.ok(completions[0].final.diagnostics.preprocessing.intent_parts.includes('值班'))
    await page.screenshot({ path: path.join(__dirname, 'live-both-topics.png'), fullPage: true })
    console.log('VISIBLE OPTIONS', JSON.stringify(completions[0].final.clarification.options.map(option => option.question)))
    for (const topic of ['加班', '值班']) {
      const count = completions.length
      // Register the response waiter before clicking to avoid a fast-response race.
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/completions')),
        clarification.getByRole('button').filter({ hasText: topic }).first().click()
      ])
      assert.equal(completions.length, count + 1)
      const latest = completions.at(-1)
      assert.ok(latest.request.clarification_selection)
      assert.equal(latest.final.diagnostics.cache_status, 'hit')
      assert.ok(latest.answer.trim())
      await page.locator('.bubble').filter({ hasText: latest.answer.replace(/\[ID:\d+\]/g, '').slice(0, 12) }).last().waitFor()
      console.log('SELECTED', topic, latest.answer)
    }
    await page.screenshot({ path: path.join(__dirname, 'live-answers.png'), fullPage: true })
    console.log('PASS: live LocalChat RAG mention, overtime+duty options, both selected answers and evidence-cache reuse')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
