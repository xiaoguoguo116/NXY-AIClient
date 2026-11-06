// Real release client + the user's existing global model. No mocked APIs/configuration.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  assert(page); assert.equal(new URL(page.url()).origin, 'http://tauri.localhost')
  page.setDefaultTimeout(15000)
  const id = `intent-acceptance-${Date.now()}`
  const report = []
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const before = await page.evaluate(() => ({
    selected: JSON.parse(localStorage.getItem('em.local-chat.v1')).selectedId,
    chats: JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations,
    todos: JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items,
    meetings: JSON.parse(localStorage.getItem('em.local-meetings.v1') || '{"items":[]}').items,
    settings: Object.fromEntries(['em.local-ai.v1','em.local-ai-key.v1','em.ragflow-credential.v1'].map(k => [k,localStorage.getItem(k)])),
    safe: !document.querySelector('[role=dialog]') && !JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.some(c => c.messages.some(m => m.status === 'pending')) && ![...document.querySelectorAll('textarea')].some(el => el.value.trim())
  }))
  assert(before.safe, 'Client has active work; do not interrupt')
  const counts = () => page.evaluate(() => ({ todos: JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items.length, meetings: JSON.parse(localStorage.getItem('em.local-meetings.v1') || '{"items":[]}').items.length }))
  const ask = async text => {
    const count = await page.evaluate(id => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id).messages.length, id)
    await page.getByRole('textbox', { name: '消息输入框', exact: true }).fill(`@AI ${text}`)
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.waitForFunction(({ id, count }) => {
      const c = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id)
      return c.messages.length >= count + 2 && c.messages.at(-1).status !== 'pending'
    }, { id, count }, { timeout: 125000 })
    const result = await page.evaluate(id => {
      const m = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id).messages
      return { request: m.at(-2), reply: m.at(-1) }
    }, id)
    assert.equal(result.reply.status, 'done', result.reply.error)
    report.push({ text, kind: result.request.intentPlan?.replyKind, actions: (result.reply.actionDrafts || []).map(a => ({ kind: a.kind, title: a.title, participants: a.participantIds, startAt: a.startAt, dueAt: a.dueAt, reminderAt: a.reminderAt })), summaryCandidates: result.reply.todoSuggestions?.length || 0 })
    console.log(`PASS response: ${text} -> ${report.at(-1).kind}/${report.at(-1).actions.map(a => a.kind).join(',') || 'no action'}`)
    return result
  }
  const bubble = result => page.locator(`[data-message-id="${result.reply.id}"]`)
  const cancel = async result => { for (const button of await bubble(result).getByRole('button', { name: '取消此操作', exact: true }).all()) await button.click() }
  try {
    await page.evaluate(id => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const common = { role: 'user', status: 'done', createdAt: new Date().toISOString() }
      data.conversations.push({ id, name: '三类意图正式验收（临时）', members: [
        { id: 'self', name: '我', kind: 'self', color: '#267' },
        { id: `${id}:zhang`, name: '张三', kind: 'simulated', color: '#754' },
        { id: `${id}:li`, name: '李四', kind: 'simulated', color: '#457' },
      ], messages: [
        { ...common, id: `${id}:source1`, senderId: `${id}:zhang`, text: '认证接口联调已经通过。我和李四需要分别核对同一份接口验收清单，检查错误码和分页边界，截止时间还没有确定。' },
        { ...common, id: `${id}:source2`, senderId: `${id}:li`, text: '确认，我和张三分别核对接口验收清单。接口联调已经完成，不需要再安排联调。评审会议尚未安排。' },
      ] })
      data.selectedId = id
      localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
    }, id)
    await page.goto('http://tauri.localhost/home/message')
    await page.evaluate(async () => { for (const c of ['plugin:window|unminimize','plugin:window|show','plugin:window|set_focus']) await window.__TAURI_INTERNALS__.invoke(c, { label: 'home' }) })

    const initial = await counts()
    let r = await ask('请总结以上两条项目会议记录，列出结论和行动项')
    assert.equal(r.request.intentPlan.replyKind, 'summary'); assert.equal(r.reply.actionDrafts.length, 0)
    assert(r.reply.todoSuggestions?.length, 'Summary should retain the explicit unfinished action')
    assert.deepEqual(await counts(), initial)
    await bubble(r).getByRole('button', { name: '转为待办', exact: true }).first().click()
    assert.deepEqual(await counts(), initial)
    await bubble(r).getByRole('button', { name: '核对并继续', exact: true }).click()
    assert.deepEqual(await counts(), initial)
    await bubble(r).getByRole('button', { name: '确认添加待办', exact: true }).evaluate(el => { el.click(); el.click() })
    const afterSummary = await counts(); assert.equal(afterSummary.todos, initial.todos + 2)
    assert.equal(afterSummary.meetings, initial.meetings)

    for (const text of ['怎样发布会议？', '不要添加待办，也不要发布会议，只解释两者的区别。', '如果要安排会议，该怎么做？', '他说“请发布会议”，我只是转述，请解释这句话。']) {
      r = await ask(text); assert.equal(r.request.intentPlan.replyKind, 'general'); assert.equal(r.reply.actionDrafts.length, 0); assert.equal(r.reply.todoSuggestions.length, 0)
      assert.deepEqual(await counts(), afterSummary)
    }

    r = await ask('下周五下午五点提醒我准备会议材料')
    assert.equal(r.reply.actionDrafts[0].kind, 'todo'); assert.equal(r.reply.actionDrafts[0].dueAt, undefined)
    const nextFriday = new Date(); const day = nextFriday.getDay() || 7
    nextFriday.setDate(nextFriday.getDate() + (8 - day) + 4); nextFriday.setHours(17, 0, 0, 0)
    assert.equal(r.reply.actionDrafts[0].reminderAt, nextFriday.toISOString())
    assert.deepEqual(await counts(), afterSummary)
    await bubble(r).getByRole('button', { name: '核对并继续' }).click()
    await bubble(r).getByRole('button', { name: '确认添加待办' }).click()
    const afterTodo = await counts(); assert.equal(afterTodo.todos, afterSummary.todos + 1)
    assert.equal(afterTodo.meetings, initial.meetings)

    r = await ask('帮我发布一场项目评审会议')
    assert.equal(r.reply.actionDrafts[0].kind, 'meeting')
    assert(!r.reply.actionDrafts[0].startAt); assert.equal(r.reply.actionDrafts[0].participantIds.length, 0)
    await bubble(r).getByRole('button', { name: '核对并继续' }).click()
    assert.equal(await bubble(r).getByRole('button', { name: '确认发布会议' }).count(), 0)
    const firstDraft = r.reply.actionDrafts[0].id
    r = await ask('补充刚才的会议：明天下午三点，我、张三和李四参加，地点是二号会议室')
    assert.equal(r.reply.actionDrafts[0].kind, 'meeting'); assert.equal(r.reply.actionDrafts[0].replacesId, firstDraft)
    assert.equal(r.reply.actionDrafts[0].participantIds.length, 3)
    assert.deepEqual(await counts(), afterTodo)
    const meetingTitle = r.reply.actionDrafts[0].title
    await bubble(r).getByRole('button', { name: '核对并继续' }).click()
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/formal-intent-meeting-review.png', fullPage: true })
    await bubble(r).getByRole('button', { name: '确认发布会议' }).evaluate(el => { el.click(); el.click() })
    const afterMeeting = await counts(); assert.equal(afterMeeting.meetings, initial.meetings + 1); assert.equal(afterMeeting.todos, afterTodo.todos)

    r = await ask('明天下午三点开会')
    assert.equal(r.reply.actionDrafts[0].kind, 'choose')
    await bubble(r).getByRole('button', { name: '发布会议邀请' }).waitFor()
    await bubble(r).getByRole('button', { name: '只给自己添加待办' }).waitFor()
    await cancel(r); assert.deepEqual(await counts(), afterMeeting)

    r = await ask('先总结这次项目讨论，再帮我邀请张三后天下午四点开项目复盘会')
    assert.equal(r.request.intentPlan.replyKind, 'summary'); assert.equal(r.reply.actionDrafts[0].kind, 'meeting')
    await cancel(r); assert.deepEqual(await counts(), afterMeeting)
    await page.reload(); assert.deepEqual(await counts(), afterMeeting)
    const ready = await page.evaluate(id => {
      const c = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id)
      const actions = c.messages.flatMap(m => m.actionDrafts || [])
      return { confirmed: actions.filter(a => a.status === 'confirmed').length, cancelled: actions.filter(a => a.status === 'cancelled').length }
    }, id)
    assert.equal(ready.confirmed, 3); assert.equal(ready.cancelled, 2)
    await page.goto('http://tauri.localhost/home/todos')
    await page.locator('.todos-page').waitFor({ timeout: 45000 })
    await page.getByRole('button', { name: /^会议提醒(?:\s*\d+)?$/ }).click()
    await page.getByText(meetingTitle, { exact: true }).first().waitFor()
    await page.getByRole('button', { name: '日程', exact: true }).click()
    await page.getByText(meetingTitle, { exact: true }).first().waitFor()
    console.log('PASS: release UI + real model: summary, personal reminder, meeting, clarification, followup, compound request, negative/hypothetical/quoted/question inputs; confirmation/cancellation/dedup/reload; meeting list and calendar.')
    assert.deepEqual(pageErrors, [])
  } catch (error) {
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/formal-intent-failure.png', fullPage: true }).catch(() => {})
    console.log(JSON.stringify({ pageErrors, url: page.url(), buttons: await page.locator('button').allTextContents() }))
    throw error
  } finally {
    fs.writeFileSync('D:/ai/NXY-AIClient/.preview/intent-desktop-report.json', JSON.stringify(report, null, 2))
    const preserved = await page.evaluate(({ id, before }) => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const owned = data.conversations.find(c => c.id === id)
      const keys = new Set(owned?.messages.flatMap(m => (m.actionDrafts || []).map(a => a.id)) || [])
      data.conversations = data.conversations.filter(c => c.id !== id)
      if (data.selectedId === id) data.selectedId = before.selected
      localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
      const todos = JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"version":1,"items":[]}')
      todos.items = todos.items.filter(t => t.groupId !== id)
      localStorage.setItem('em.local-todos.v1', JSON.stringify(todos))
      const meetings = JSON.parse(localStorage.getItem('em.local-meetings.v1') || '{"version":1,"items":[]}')
      meetings.items = meetings.items.filter(m => !keys.has(m.sourceId))
      localStorage.setItem('em.local-meetings.v1', JSON.stringify(meetings))
      return {
        settings: Object.entries(before.settings).every(([k,v]) => localStorage.getItem(k) === v),
        chats: before.chats.every(c => data.conversations.some(n => n.id === c.id && JSON.stringify(n.messages) === JSON.stringify(c.messages))),
        todos: before.todos.every(t => todos.items.some(n => n.id === t.id && JSON.stringify(n) === JSON.stringify(t))),
        meetings: before.meetings.every(m => meetings.items.some(n => n.id === m.id && JSON.stringify(n) === JSON.stringify(m))),
      }
    }, { id, before })
    await page.reload(); await browser.close()
    assert(Object.values(preserved).every(Boolean), JSON.stringify(preserved))
    console.log('Test records cleaned; original chat records, todos, meetings, global AI model and credentials preserved.')
  }
})().catch(e => { console.error(e.message); process.exitCode = 1 })
