// Live integration test: requires the configured local RAG service and the
// temporary model adapter described in LOCAL_CHAT.md. Never uses canned replies.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')

function summarizeWithRealModel(body) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', '-w', '/ragflow', 'ragflow-ragflow-cpu-1',
      '/ragflow/.venv/bin/python', '/tmp/em-live-summary-model.py'], { windowsHide: true })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    const timeout = setTimeout(() => { child.kill(); reject(Error('Live model verification timed out')) }, 115000)
    child.on('close', code => {
      clearTimeout(timeout)
      if (code !== 0) return reject(Error(`Live model exited ${code}; ${stderr.split('\n').filter(x => /^\s*File "|^(ImportError|RuntimeError|AttributeError|KeyError|TypeError|peewee\.)/.test(x)).join('\n') || 'see container configuration'}`))
      try { resolve(JSON.parse(stdout.trim())) } catch { reject(Error('Invalid model response')) }
    })
    child.stdin.end(JSON.stringify(body))
  })
}

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(120000)
  const modelCalls = []
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
  try {
    await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createHotContext(){return {data:{},on(){},accept(){},prune(){},dispose(){},invalidate(){}}};export function injectQuery(url){return url};export function updateStyle(id,css){let el=document.getElementById(id);if(!el){el=document.createElement("style");el.id=id;document.head.append(el)}el.textContent=css};export function removeStyle(id){document.getElementById(id)?.remove()}' }))
    await page.route('**/src/utils/desktop/notification.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function showNotification(){return true}' }))
    await page.route('**/__project-ai-test.html', route => route.fulfill({
      contentType: 'text/html', body: '<html><body style="margin:0"><div id="app" style="height:100vh"></div><script type="module" src="/tests/rag-preview.ts"></script></body></html>'
    }))
    await page.route('**/@tauri-apps_plugin-http.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const fetch = globalThis.fetch.bind(globalThis)' }))
    await page.route('http://127.0.0.1:19876/**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const body = route.request().postDataJSON()
      try {
        assert.equal(body.messages.filter(message => message.role !== 'system').length, 1,
          'selected summary must contain only the selected-record payload, not conversation history')
        assert(!JSON.stringify(body.messages).includes('UNSELECTED_BUDGET_999'), 'unselected message leaked')
        modelCalls.push(body)
        const answer = await summarizeWithRealModel(body)
        await route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify(answer) })
      } catch (error) {
        console.error(error.message)
        await route.fulfill({ status: 502, headers: cors, body: '{}' })
      }
    })
    await page.route('http://127.0.0.1:8090/**', async route => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const response = await fetch(request.url(), {
        method: request.method(), headers: { 'Content-Type': 'application/json' },
        ...(request.postData() ? { body: request.postData() } : {})
      })
      await route.fulfill({ status: response.status, headers: cors,
        contentType: response.headers.get('content-type') || 'application/json', body: await response.text() })
    })
    await page.addInitScript(() => {
      localStorage.setItem('em.local-ai.v1', JSON.stringify({ baseUrl: 'http://127.0.0.1:19876/v1', model: '已配置真实模型（隔离验证）', contextCount: 12 }))
    })
    await page.goto('http://127.0.0.1:1420/__project-ai-test.html')
    await page.getByRole('button', { name: /客户工单平台·一期交付（模拟项目）/ }).waitFor()
    for (const [key, keyword] of [['ticket-delivery', 'BUG-217'], ['knowledge-search', '陈默'], ['mobile-approval', 'APP-91']]) {
      const chatId = `local-example-v2-${key}`
      // Insert one unrelated unselected message only in this isolated profile.
      await page.evaluate(id => {
        const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
        const chat = data.conversations.find(chat => chat.id === id)
        chat.messages.push({ id: 'unselected', role: 'user', senderId: 'self', text: '其他项目预算 UNSELECTED_BUDGET_999', status: 'done', createdAt: new Date().toISOString() })
        data.selectedId = id
        localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
      }, chatId)
      await page.reload()
      await page.locator('.bubble').first().click({ button: 'right' })
      await page.getByText('多选', { exact: true }).click()
      for (let i = 0; i < 18; i++) await page.locator('.message input[type=checkbox]').nth(i).check()
      await page.getByRole('button', { name: '@AI 总结', exact: true }).click()
      await page.waitForFunction(id => {
        const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
        return data.conversations.find(chat => chat.id === id)?.messages.some(msg => msg.role === 'assistant' && msg.status !== 'pending')
      }, chatId)
      const result = await page.evaluate(id => {
        const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
        return data.conversations.find(chat => chat.id === id).messages.filter(msg => msg.role === 'assistant').at(-1)
      }, chatId)
      assert.equal(result.status, 'done', result.error)
      assert(result.text.includes(keyword), `Missing expected key fact: ${keyword}`)
      assert(!result.text.includes('UNSELECTED_BUDGET_999'))
      console.log('REAL SUMMARY', key, result.text)
      await page.screenshot({ path: `.preview/project-summary-${key}.png`, fullPage: true })
    }
    assert.equal(modelCalls.length, 3)
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true })
    await input.fill('@AI RAG助手 计划加班如何申请和审批？')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      return data.conversations.find(chat => chat.id === data.selectedId)?.messages.some(msg => msg.assistant === 'ragflow' && msg.status !== 'pending')
    })
    const rag = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      return data.conversations.find(chat => chat.id === data.selectedId).messages.filter(msg => msg.assistant === 'ragflow').at(-1)
    })
    assert.equal(rag.status, 'done', rag.error)
    assert(rag.rag.references.some(reference => reference.name.includes('加班')))
    assert(rag.text.includes('直属负责人'))
    await page.getByText(/制度依据（/).last().click()
    await page.screenshot({ path: '.preview/project-rag-policy.png', fullPage: true })
    console.log('REAL POLICY ANSWER', rag.text)
    await page.reload()
    await page.getByText(/制度依据（/).last().waitFor()
    assert.equal(await page.locator('.rag-clarification').count(), 0)
    console.log('PASS: 3 real-model selected summaries, excluded unselected record, real RAG policy evidence, reload persistence')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
