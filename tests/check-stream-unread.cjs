const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1250, height: 850 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createHotContext(){return {data:{},on(){},accept(){},prune(){},dispose(){},invalidate(){}}};export function injectQuery(url){return url};export function updateStyle(){};export function removeStyle(){}' }))
    await page.route('**/src/utils/desktop/notification.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function showNotification(){return true}' }))
    await page.route('**/__stream-test.html', route => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div><script type="module" src="/tests/rag-preview.ts"></script>' }))
    await page.route('**/*plugin-http*', route => route.fulfill({ contentType: 'text/javascript', body: `
      export async function fetch(url, init) {
        const body = init.body ? JSON.parse(init.body) : null;
        window.modelCalls ||= []; window.modelCalls.push({url,body});
        if(url.endsWith('/config')) return Response.json({chatId:'test'});
        if(url.endsWith('/sessions')) return Response.json({code:0,data:{id:'session'}});
        const rag = url.includes('ragflow-api');
        const pieces = rag ? ['出差流程：','提交申请，','等待审批。'] : ['重点：本周完成联调。','\\n待办：王工修复登录问题。','\\n待确认：上线日期。'];
        const encoder = new TextEncoder(); let timer;
        return new Response(new ReadableStream({ start(c) {
          let i=0;
          const push = () => {
            if(init.signal.aborted) { c.close(); return }
            if(i < pieces.length) {
              const data = rag ? {code:0,data:{preview_answer:pieces[i],answer:'',final:false}} : {choices:[{delta:{content:pieces[i]}}]};
              c.enqueue(encoder.encode('data: '+JSON.stringify(data)+'\\n\\n')); i++; timer=setTimeout(push,450);
            } else {
              const data = rag ? {code:0,data:{final:true,answer:'已核验：提交出差申请后由部门负责人审批。'}} : {choices:[{delta:{},finish_reason:'stop'}]};
              c.enqueue(encoder.encode('data: '+JSON.stringify(data)+'\\n\\n')); c.close();
            }
          }; timer=setTimeout(push,50);
        }, cancel(){clearTimeout(timer)} }), {headers:{'content-type':'text/event-stream'}});
      }` }))
    await page.addInitScript(() => {
      if (localStorage.getItem('em.local-chat.v1')) return
      const message = (id, text) => ({ id, text, role: 'user', senderId: 'peer', status: 'done', createdAt: new Date().toISOString() })
      localStorage.setItem('em.local-chat.v1', JSON.stringify({ version: 1, exampleGroupsVersion: 2, selectedId: 'test', conversations: [
        { id: 'test', name: '未读总结验证', members: [{ id: 'self', name: '我', kind: 'self', color: '' }, { id: 'peer', name: '王工', kind: 'simulated', color: '' }], messages: [message('old', '不应总结的旧消息'), message('unread1', '本周完成联调'), message('unread2', '王工修复登录问题，上线日期待确认')], readState: { seenIds: ['old'], summaryIds: [] } },
        { id: 'other', name: '其他会话验证', messages: [message('private', '其他会话不应发送')], readState: { seenIds: ['private'], summaryIds: [] } }
      ] }))
      localStorage.setItem('em.local-ai.v1', JSON.stringify({ baseUrl: 'http://localhost:8899/v1', model: 'test', contextCount: 12 }))
    })
    await page.goto(`${process.env.CHAT_TEST_ORIGIN || 'http://127.0.0.1:1428'}/__stream-test.html`)
    await page.bringToFront()
    const prompt = page.getByRole('region', { name: '未读消息总结' })
    await prompt.waitFor({ timeout: 15000 }).catch(async error => {
      console.log(JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText.slice(0, 1200), focus: document.hasFocus(), visibility: document.visibilityState, data: JSON.parse(localStorage.getItem('em.local-chat.v1'))?.conversations.find(c => c.id === 'test') }))))
      console.log(JSON.stringify(errors)); throw error
    })
    assert.equal(await page.evaluate(() => window.modelCalls?.length || 0), 0)
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true })
    await input.fill('尚未发送的草稿')
    await page.screenshot({ path: '.preview/stream-unread-20261026/consent.png' })
    await page.getByRole('button', { name: '总结未读', exact: true }).click()
    await page.locator('.stream-cursor').waitFor()
    assert.equal(await input.inputValue(), '尚未发送的草稿')
    const call = await page.evaluate(() => window.modelCalls[0])
    const context = JSON.stringify(call.body.messages)
    assert(context.includes('本周完成联调'))
    assert(context.includes('王工修复登录问题'))
    assert(!context.includes('不应总结的旧消息'))
    assert(!context.includes('其他会话不应发送'))
    assert.equal(call.body.stream, true)
    await page.screenshot({ path: '.preview/stream-unread-20261026/summary-stream.png' })
    await page.waitForFunction(() => !document.querySelector('.stream-cursor'))
    const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'test').messages.at(-1))
    assert.equal(completed.status, 'done')
    assert.deepEqual(completed.summarySourceIds, ['unread1', 'unread2'])
    await input.fill('@ ai rag助手 查制度：出差流程')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByText('正在生成预览，完成后核对依据；请以最终回答为准。', { exact: true }).waitFor()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'test').messages.at(-1).status === 'done')
    assert(await page.locator('.bubble').last().innerText().then(t => t.includes('已核验：')))
    await input.fill('@ai 慢速取消')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.locator('.stream-cursor').waitFor()
    await page.getByRole('button', { name: '停止 AI', exact: true }).click()
    await page.locator('.message-error').filter({ hasText: '已停止，可以重试。' }).waitFor()
    const stoppedText = await page.locator('.bubble').last().innerText()
    await page.waitForTimeout(1000)
    assert.equal(await page.locator('.bubble').last().innerText(), stoppedText)
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const chat = data.conversations.find(c => c.id === 'test')
      chat.messages.push({ id: 'new', text: '新的未读', role: 'user', senderId: 'peer', status: 'done', createdAt: new Date().toISOString() })
      localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
    })
    await page.reload()
    await page.bringToFront()
    await prompt.waitFor()
    assert.equal(await page.evaluate(() => window.modelCalls?.length || 0), 0)
    await page.getByRole('button', { name: '暂不', exact: true }).click()
    await page.reload()
    await input.waitFor()
    assert.equal(await prompt.count(), 0)
    assert.equal(await page.evaluate(() => window.modelCalls?.length || 0), 0)
    assert.deepEqual(errors, [])
    fs.writeFileSync('.preview/stream-unread-20261026/ui-result.json', JSON.stringify({ passed: true, checks: ['consent before model call', 'immutable two-message scope', 'draft preserved', 'AI partial rendering', 'RAG preview replaced', 'cancel stops rendering', 'decline does not call model', 'read state persists'], errors }, null, 2))
    console.log('PASS: consent, scope, streaming, cancellation, decline and reload')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
