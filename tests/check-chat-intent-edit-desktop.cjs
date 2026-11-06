// Final release regression: edited summary candidates must display the actual saved assignment.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  assert(page); const id = `intent-edited-${Date.now()}`; const title = `核对最终验收方案 ${id}`
  const before = await page.evaluate(() => ({
    data: JSON.parse(localStorage.getItem('em.local-chat.v1')),
    todos: JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items,
    protected: Object.fromEntries(['em.local-ai.v1','em.local-ai-key.v1','em.local-meetings.v1'].map(k => [k,localStorage.getItem(k)])),
    safe: !document.querySelector('[role=dialog]') && ![...document.querySelectorAll('textarea')].some(el => el.value.trim())
  }))
  assert(before.safe && !before.data.conversations.some(c => c.messages.some(m => m.status === 'pending')))
  try {
    await page.evaluate(id => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const common = { createdAt: new Date().toISOString(), status: 'done' }
      data.conversations.push({ id, name: '确认修改结果验收（临时）', members: [
        { id: 'self', name: '我', kind: 'self', color: '#267' }, { id: `${id}:z`, name: '张三', kind: 'simulated', color: '#654' }, { id: `${id}:l`, name: '李四', kind: 'simulated', color: '#456' }
      ], messages: [
        { ...common, id: `${id}:q`, role: 'user', text: '@AI @张三 @李四 总结接口验收的行动项' },
        { ...common, id: `${id}:a`, role: 'assistant', replyTo: `${id}:q`, text: '请核对方案；未执行添加。', todoSuggestions: [{ title: '核对方案', assigneeIds: [`${id}:z`,`${id}:l`] }] }
      ] })
      data.selectedId = id; localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
    }, id)
    await page.goto('http://tauri.localhost/home/message')
    await page.getByRole('button', { name: '转为待办', exact: true }).click()
    const card = page.locator('.chat-action-card')
    await card.getByLabel('动作主题').click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(title)
    await card.getByRole('button', { name: '仅自己', exact: true }).click()
    await card.getByRole('button', { name: '核对并继续', exact: true }).click()
    await card.getByRole('button', { name: '确认添加待办', exact: true }).click()
    const followup = page.locator('.todo-followups')
    await followup.getByText(title, { exact: true }).waitFor()
    await followup.getByText('参与人：我', { exact: true }).waitFor()
    const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('em.local-todos.v1')).items.filter(t => t.groupId === id), id)
    assert.equal(saved.length, 1); assert.equal(saved[0].assigneeId, 'self'); assert.equal(saved[0].title, title)
    await page.goto('http://tauri.localhost/home/todos')
    await page.getByRole('checkbox', { name: `完成：${title}`, exact: true }).click()
    await page.goto('http://tauri.localhost/home/message')
    await followup.getByText('我：已完成', { exact: true }).waitFor()
    assert.match(await followup.innerText(), /已完成 1\/1/)
    await page.reload(); await followup.getByText('参与人：我', { exact: true }).waitFor()
    await followup.getByText(title, { exact: true }).waitFor()
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/formal-intent-edited-summary.png' })
    console.log('PASS: final release confirmation edits override original @ recipients; saved title/owner/progress are accurate and survive reload.')
  } finally {
    const preserved = await page.evaluate(({ id, before }) => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      data.conversations = data.conversations.filter(c => c.id !== id)
      if (data.selectedId === id) data.selectedId = before.data.selectedId
      localStorage.setItem('em.local-chat.v1', JSON.stringify(data))
      const todos = JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"version":1,"items":[]}')
      todos.items = todos.items.filter(t => t.groupId !== id)
      localStorage.setItem('em.local-todos.v1', JSON.stringify(todos))
      return before.data.conversations.every(c => data.conversations.some(n => n.id === c.id && JSON.stringify(n.messages) === JSON.stringify(c.messages))) && before.todos.every(t => todos.items.some(n => JSON.stringify(n) === JSON.stringify(t))) && Object.entries(before.protected).every(([k,v]) => localStorage.getItem(k) === v)
    }, { id, before })
    await page.reload(); await browser.close(); assert(preserved)
    console.log('Only owned test records removed; original data and settings preserved.')
  }
})().catch(e => { console.error(e.message); process.exitCode = 1 })
