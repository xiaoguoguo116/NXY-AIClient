// Isolated contract/UI test. Native HTTP is stubbed only in this disposable browser profile.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ timezoneId: 'Asia/Shanghai', viewport: { width: 1450, height: 1050 } })
  const page = await context.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => {
    window.__answers = []; window.__requests = []; window.__notifications = []
    const bodies = new Map(); let next = 0
    window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
      if (command === 'plugin:notification|is_permission_granted') return true
      if (command === 'show_app_notification') { window.__notifications.push(args.input); return null }
      if (command === 'plugin:http|fetch') {
        const request = JSON.parse(new TextDecoder().decode(new Uint8Array(args.clientConfig.data)))
        window.__requests.push(request)
        if (!window.__answers.length) throw new Error('Unexpected model call')
        const rid = ++next
        bodies.set(rid, new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: window.__answers.shift() } }] })))
        return rid
      }
      if (command === 'plugin:http|fetch_send') return { rid: args.rid, status: 200, statusText: 'OK', url: 'http://127.0.0.1:9999/v1/chat/completions', headers: [['content-type', 'application/json']] }
      if (command === 'plugin:http|fetch_read_body') { const b = bodies.get(args.rid); bodies.delete(args.rid); return b ? [...b, 0] : [1] }
      if (command.includes('cancel')) return null
      return null
    } }
    if (localStorage.getItem('intent-seeded')) return
    localStorage.setItem('intent-seeded', '1')
    localStorage.setItem('em.local-ai.v1', JSON.stringify({ baseUrl: 'http://127.0.0.1:9999/v1', model: 'isolated-fixture', contextCount: 12 }))
    localStorage.setItem('em.local-chat.v1', JSON.stringify({ version: 1, exampleGroupsVersion: 2, selectedId: 'intent-test', conversations: [{ id: 'intent-test', name: '分流流程隔离验收', members: [{ id: 'self', name: '我', kind: 'self', color: '#345' }, { id: 'zhang', name: '张三', kind: 'simulated', color: '#543' }], messages: [] }] }))
  })
  const action = (kind, overrides = {}) => ({ kind, title: kind === 'meeting' ? '评审会' : '准备会议材料', participantIds: kind === 'meeting' ? ['self', 'zhang'] : ['self'], unresolvedRecipients: [], ...overrides })
  const plan = (actions, replyKind = 'actions') => JSON.stringify({ replyKind, actions })
  const counts = () => page.evaluate(() => ({ todos: JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items.length, meetings: JSON.parse(localStorage.getItem('em.local-meetings.v1') || '{"items":[]}').items.length }))
  const ask = async (text, answers) => {
    await page.evaluate(answers => { window.__answers.push(...answers) }, answers)
    const before = await page.locator('.message.assistant').count()
    const prior = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'intent-test').messages.length)
    await page.getByRole('textbox', { name: '消息输入框', exact: true }).fill(`@AI ${text}`)
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.waitForFunction(prior => {
      const m = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'intent-test').messages
      return m.length > prior + 1 && m.at(-1).status !== 'pending'
    }, prior)
  }
  const card = () => page.locator('.chat-action-card').last()
  const confirm = async () => { await card().getByRole('button', { name: '核对并继续' }).click(); await card().getByRole('button', { name: /确认(发布会议|添加待办)/ }).click() }
  try {
    await page.clock.install({ time: new Date('2030-01-02T01:00:00Z') })
    await page.goto(`${process.env.TEST_ORIGIN || 'http://127.0.0.1:1426'}/tests/todo-flow-preview.html`)
    await ask('怎样发布会议？', [plan([], 'general'), '请使用会议草稿进行确认。\n```em-todos\n[{"title":"不能自动提取"}]\n```'])
    assert.equal(await page.locator('.todo-followups').count(), 0)
    assert.deepEqual(await counts(), { todos: 0, meetings: 0 })
    const ordinary = await page.evaluate(() => window.__requests[1].messages)
    assert(!ordinary.some(m => m.content.includes('如果回复中存在明确的后续待办行动')))

    await ask('提醒我准备会议材料', [plan([action('todo', { needsReminder: true })])])
    await card().getByRole('button', { name: '核对并继续' }).click()
    assert.equal(await card().getByRole('button', { name: '确认添加待办' }).count(), 0)
    await card().getByLabel('待办提醒时间日期').fill('2030-01-03')
    await card().getByLabel('待办提醒时间时刻').selectOption('10:00')
    assert.equal(await card().getByLabel('待办提醒时间时刻').locator('option:not([disabled])').count(), 24)
    assert.deepEqual(await counts(), { todos: 0, meetings: 0 })
    await card().getByRole('button', { name: '核对并继续' }).click()
    assert.deepEqual(await counts(), { todos: 0, meetings: 0 })
    await card().getByRole('button', { name: '确认添加待办' }).evaluate(el => { el.click(); el.click() })
    assert.deepEqual(await counts(), { todos: 1, meetings: 0 })
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-todos.v1')).items[0])
    assert.equal(saved.dueAt, undefined); assert.equal(saved.reminderAt, '2030-01-03T02:00:00.000Z')
    await page.reload(); assert.deepEqual(await counts(), { todos: 1, meetings: 0 })

    await ask('帮我发布评审会', [plan([action('meeting', { participantIds: [] })])])
    await card().getByRole('button', { name: '核对并继续' }).click()
    assert.equal(await card().getByRole('button', { name: '确认发布会议' }).count(), 0)
    await card().getByLabel('会议开始时间日期').fill('2030-01-04')
    await card().getByLabel('会议开始时间时刻', { exact: true }).selectOption('15:15')
    assert.equal(await card().getByLabel('会议开始时间时刻', { exact: true }).locator('option:not([disabled])').count(), 96)
    const outsiders = card().locator('.people input').filter({ visible: true })
    assert(await outsiders.count() > 2, 'all contacts are available outside this conversation')
    await outsiders.nth(2).check()
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'intent-test').messages.at(-1).actionDrafts[0].participantIds)).some(id => id.startsWith('contact:')))
    await card().getByRole('button', { name: '当前会话全体成员' }).click()
    await card().getByRole('button', { name: '核对并继续' }).click()
    await card().getByRole('button', { name: '返回修改' }).click()
    await card().getByLabel('动作主题').click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText('正式评审会')
    assert.equal(await card().getByLabel('动作主题').inputValue(), '正式评审会')
    await confirm(); assert.deepEqual(await counts(), { todos: 1, meetings: 1 })

    await ask('明天下午三点开会', [plan([action('choose', { startAt: '2030-01-03T15:00:00+08:00' })])])
    await card().getByRole('button', { name: '只给自己添加待办' }).click()
    await card().getByRole('button', { name: '取消此操作' }).click()
    await page.reload(); assert.deepEqual(await counts(), { todos: 1, meetings: 1 })

    await ask('帮我安排会议', [plan([action('meeting', { title: '', participantIds: [] })])])
    const prev = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === 'intent-test').messages.at(-1).actionDrafts[0].id)
    await ask('主题是验收，明天三点，张三和我', [plan([action('meeting', { title: '验收', startAt: '2030-01-03T15:00:00+08:00', replacesId: prev })])])
    assert(await page.getByText('已由后续补充的草稿替代，未执行', { exact: true }).count())
    await card().getByRole('button', { name: '取消此操作' }).click()

    await ask('总结会议记录', [plan([], 'summary'), '项目已经确定，张三和我需要核对清单。\n```em-todos\n[{"title":"核对清单","assigneeIds":["self","zhang"]}]\n```'])
    assert.deepEqual(await counts(), { todos: 1, meetings: 1 })
    await page.getByRole('button', { name: '转为待办', exact: true }).click()
    assert.deepEqual(await counts(), { todos: 1, meetings: 1 })
    await confirm(); assert.deepEqual(await counts(), { todos: 3, meetings: 1 })
    await page.getByText('已添加为一项待办 ✓', { exact: true }).waitFor()
    await page.getByRole('button', { name: '测试切换到待办' }).click()
    await page.getByRole('checkbox', { name: '完成：核对清单', exact: true }).evaluate(el => el.click())
    await page.getByRole('button', { name: '测试切换到对话' }).click()
    assert.match(await page.locator('.todo-followups').last().innerText(), /已完成 1\/2/)

    await ask('总结第二项行动', [plan([], 'summary'), '请核对方案。\n```em-todos\n[{"title":"核对方案","assigneeIds":["self","zhang"]}]\n```'])
    await page.getByRole('button', { name: '转为待办', exact: true }).click()
    await card().getByLabel('动作主题').fill('核对最终方案')
    await card().getByRole('checkbox', { name: '我', exact: true }).uncheck()
    await confirm()
    assert.match(await page.locator('.todo-followups').last().innerText(), /核对最终方案/)
    assert.match(await page.locator('.todo-followups').last().innerText(), /参与人：张三/)

    await ask('返回异常格式测试', ['not-json'])
    assert.match(await page.locator('.message-error').last().innerText(), /动作识别结果无法读取/)
    assert.deepEqual(await counts(), { todos: 4, meetings: 1 })
    await page.evaluate(() => window.__answers.push(JSON.stringify({ replyKind: 'general', actions: [] }), '普通回复'))
    await page.locator('.message-error').last().getByRole('button', { name: '重试' }).click()
    await page.getByText('普通回复', { exact: true }).last().waitFor()

    await page.clock.fastForward(25 * 60 * 60 * 1000 + 60 * 1000)
    await page.waitForFunction(() => window.__notifications.length === 1)
    await page.clock.fastForward(30000)
    assert.equal(await page.evaluate(() => window.__notifications.length), 1)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/chat-intents-verified.png', fullPage: true })
    console.log('PASS: generic has no extraction; summary conversion requires confirmation; meeting/todo clarification, contact selection, 15-minute meetings, hourly reminders, keyboard input, cancellation, followup replacement, malformed output retry, duplicate confirmation, reload, two-recipient progress and one-shot reminder.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
