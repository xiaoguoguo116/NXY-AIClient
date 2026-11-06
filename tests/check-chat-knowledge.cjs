// Disposable browser profile; model responses are fixtures, no real chat or AI service is contacted.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const path = require('node:path')
let server

;(async () => {
  const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:1433'
  if (!process.env.TEST_ORIGIN) {
    server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--port', '1433'], { windowsHide: true, stdio: 'ignore' })
    let ready = false
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error('Test Vite server exited before startup')
      try { ready = (await fetch(origin, { signal: AbortSignal.timeout(500) })).ok } catch {}
      if (ready) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!ready) throw new Error('Test Vite server did not start')
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ timezoneId: 'Asia/Shanghai', viewport: { width: 1400, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.__requests = []
    window.__mode = 'good'
    const bodies = new Map()
    let next = 0
    window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
      if (command === 'plugin:notification|is_permission_granted') return true
      if (command === 'plugin:http|fetch') {
        const request = JSON.parse(new TextDecoder().decode(new Uint8Array(args.clientConfig.data)))
        window.__requests.push(request)
        const { evidence } = JSON.parse(request.messages.at(-1).content)
        const source = evidence.find((item) => item.id === 'restored') || evidence[0]
        const answer = {
          findings: [{ kind: '确认', text: '11 月 3 日的反馈确认已恢复访问；尚无本次连通性的检测依据。', sources: [window.__mode === 'bad' ? 'S999' : source.ref] }],
          unknowns: ['当前网络是否可通，仍需本次验证。']
        }
        if (window.__mode === 'delay') await new Promise((resolve) => { window.__release = resolve })
        const rid = ++next
        bodies.set(rid, new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] })))
        return rid
      }
      if (command === 'plugin:http|fetch_send') return { rid: args.rid, status: 200, statusText: 'OK', url: 'http://127.0.0.1:9999/v1/chat/completions', headers: [['content-type', 'application/json']] }
      if (command === 'plugin:http|fetch_read_body') {
        const body = bodies.get(args.rid)
        bodies.delete(args.rid)
        return body ? [...body, 0] : [1]
      }
      return null
    } }
    if (localStorage.getItem('knowledge-seeded')) return
    localStorage.setItem('knowledge-seeded', '1')
    localStorage.setItem('em.local-ai.v1', JSON.stringify({ baseUrl: 'http://127.0.0.1:9999/v1', model: 'isolated-history-fixture', contextCount: 12 }))
    const msg = (id, text, day, quoteId) => ({ id, text, role: 'user', status: 'done', senderId: 'zhang', createdAt: `2026-11-0${day} 10:00:00`, quoteId })
    const members = [{ id: 'self', name: '我', kind: 'self', color: '#345' }, { id: 'zhang', name: '张工', kind: 'simulated', color: '#543' }]
    localStorage.setItem('em.local-chat.v1', JSON.stringify({ version: 1, exampleGroupsVersion: 2, selectedId: 'history-test', conversations: [
      { id: 'history-test', name: '群聊回溯验收群', members, messages: [
        msg('start', '10.20.30.40:8080 连不上，VPN 已连接。', 1),
        msg('noise', '下午的发布评审调整到三点。', 1),
        msg('fix', '检查后发现来源网段不在白名单，现已添加，请再试。', 2, 'start'),
        msg('restored', '现在可以访问了，谢谢。', 3, 'fix'),
        msg('repeat', '今天 10.20.30.40 又不通了，原因还不清楚。', 5),
        msg('topic', '订单接口新增字段，后端完成，前端联调推迟到下周。', 5)
      ] },
      { id: 'other-test', name: '独立项目群', members, messages: [msg('secret', '其他群的独立记录', 5)] }
    ] }))
  })
  const originalCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find((chat) => chat.id === 'history-test').messages.length)
  const ask = async (text) => {
    await page.getByLabel('想回顾什么事情？').fill(text)
    await page.getByRole('button', { name: '查询群聊记录', exact: true }).click()
  }
  try {
    await page.goto(`${origin}/tests/todo-flow-preview.html`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.getByRole('button', { name: '问问本群', exact: true }).click()
    await page.getByText('已读取本机 6 条可检索文本', { exact: false }).waitFor()
    const before = await originalCount()
    await ask('10.20.30.40 之前怎么处理的，今天又不通了？')
    await page.getByText('整理完成。每条事实可查看对应原消息。', { exact: true }).waitFor()
    assert.equal(await originalCount(), before, 'private lookup must not send messages into the group')
    const payload = await page.evaluate(() => JSON.parse(window.__requests[0].messages.at(-1).content))
    assert.ok(payload.evidence.some((item) => item.id === 'restored'))
    assert.ok(payload.evidence.some((item) => item.id === 'repeat'))
    assert.ok(!payload.evidence.some((item) => item.id === 'secret'))
    await page.locator('.finding .source-link').first().click()
    await page.locator('.context .selected').getByText('现在可以访问了，谢谢。', { exact: true }).waitFor()
    fs.mkdirSync('.preview/chat-knowledge', { recursive: true })
    await page.screenshot({ path: '.preview/chat-knowledge/source-context.png', fullPage: true })
    await page.locator('.knowledge-panel').getByRole('button', { name: '收起', exact: true }).click()
    await page.locator('.knowledge-panel form').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '.preview/chat-knowledge/answer-and-evidence.png', fullPage: true })

    await ask('财务预算审批')
    await page.getByText('在本次扫描范围内未找到相关记录。', { exact: false }).waitFor()
    assert.equal(await page.evaluate(() => window.__requests.length), 1)
    assert.equal(await page.locator('.finding').count(), 0)

    await page.evaluate(() => { window.__mode = 'bad' })
    await ask('10.20.30.40')
    await page.getByText('模型未返回可核验的消息引用', { exact: false }).waitFor()
    assert.equal(await page.locator('.finding').count(), 0)

    await page.evaluate(() => { window.__mode = 'delay' })
    await ask('订单接口进展')
    await page.waitForFunction(() => !!window.__release)
    await page.getByRole('button', { name: '停止查询', exact: true }).click()
    await page.getByText('查询已停止。', { exact: true }).waitFor()
    await page.evaluate(() => window.__release())
    assert.equal(await page.locator('.finding').count(), 0)

    await page.evaluate(() => { window.__release = null })
    await ask('10.20.30.40')
    await page.waitForFunction(() => !!window.__release)
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      saved.conversations.find((chat) => chat.id === 'history-test').messages.find((message) => message.id === 'restored').text = '恢复反馈已更正，仍待确认。'
      localStorage.setItem('em.local-chat.v1', JSON.stringify(saved))
      window.__release()
    })
    await page.getByText('群聊记录已变化，请重新查询。', { exact: true }).waitFor()
    assert.equal(await page.locator('.finding').count(), 0)
    assert.equal(await page.locator('.evidence').count(), 0)
    await page.keyboard.press('Escape')
    await page.locator('.knowledge-panel').waitFor({ state: 'detached' })
    await page.locator('.conversation').filter({ hasText: '独立项目群' }).click()
    await page.getByRole('button', { name: '问问本群', exact: true }).click()
    await page.getByText('已读取本机 1 条可检索文本', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('想回顾什么事情？').inputValue(), '')
    assert.equal(await page.locator('.finding').count(), 0)
    assert.equal(await originalCount(), before)
    assert.deepEqual(errors, [])
    console.log('PASS: private lookup, cross-day evidence, source context, empty retrieval, citation rejection, cancellation, edited-source invalidation and group isolation')
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => server?.kill())
