const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const output = path.resolve('.preview/shared-todo')
  fs.mkdirSync(output, { recursive: true })
  const title = '核对接口验收清单，确认错误码、超时重试、分页边界三项'
  try {
    for (const legacy of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, timezoneId: 'Asia/Shanghai' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(({ legacy, title }) => {
        window.__TAURI_INTERNALS__ = { invoke: async command => command === 'plugin:notification|is_permission_granted' ? false : null }
        if (localStorage.getItem('shared-todo-seeded')) return
        localStorage.setItem('shared-todo-seeded', '1')
        const dueAt = '2030-10-23T07:00:00.000Z'
        const common = { createdAt: '2026-10-21T05:49:00.000Z', status: 'done' }
        localStorage.setItem('em.local-chat.v1', JSON.stringify({ version: 1, exampleGroupsVersion: 2, selectedId: 'shared', conversations: [{
          id: 'shared', name: '待办进度验收群（本地模拟）', members: [
            { id: 'self', name: '我', kind: 'self', color: '#2685ed' },
            { id: 'zhang', name: '张三', kind: 'simulated', color: '#408978' },
            { id: 'li', name: '李四', kind: 'simulated', color: '#547dc0' }
          ], messages: [
            { ...common, id: 'source', role: 'user', senderId: 'li', text: '我和张三需要分别核对同一份接口验收清单，确认错误码、超时重试、分页边界三个项目。' },
            { ...common, id: 'request', role: 'user', quoteId: 'source', text: '@AI 请整理为候选待办', todoRecipients: [{ id: 'self', name: '我', kind: 'self' }] },
            { ...common, id: 'answer', role: 'assistant', replyTo: 'request', text: '李四和张三分别核对同一份接口验收清单，请确认添加。', todoRecipients: [{ id: 'self', name: '我', kind: 'self' }], todoSuggestions: legacy
              ? [{ title: `李四：${title}`, dueAt }, { title: `张三：${title}`, dueAt }]
              : [{ title, dueAt, assigneeIds: ['li', 'zhang'] }] }
          ]
        }] }))
      }, { legacy, title })
      await page.goto('http://127.0.0.1:1425/tests/todo-flow-preview.html')
      const followups = page.locator('.todo-followups')
      await followups.getByText('参与人：李四、张三', { exact: true }).waitFor({ timeout: 15000 }).catch(async error => {
        await page.screenshot({ path: path.join(output, 'failure.png') })
        throw new Error(`${error.message}\n${JSON.stringify(errors)}\n${(await page.locator('body').innerText()).slice(-6000)}`)
      })
      assert.equal(await followups.getByRole('button', { name: '添加到待办', exact: true }).count(), 1)
      if (legacy) await page.screenshot({ path: path.join(output, 'one-task-two-participants.png') })
      await followups.getByRole('button', { name: '添加到待办', exact: true }).click()
      await followups.getByText('已添加为一项待办 ✓', { exact: true }).waitFor()
      assert.equal(await followups.getByRole('button', { name: '添加到待办', exact: true }).count(), 0)
      const readTodos = () => page.evaluate(() => JSON.parse(localStorage.getItem('em.local-todos.v1')).items)
      let rows = await readTodos()
      assert.equal(rows.length, 2, 'two independent progress rows belong to one assignment')
      assert.equal(new Set(rows.map(item => item.assignmentKey)).size, 1)
      assert.deepEqual(rows.map(item => item.assigneeId).sort(), ['li', 'zhang'])
      await page.reload()
      await followups.getByText('已添加为一项待办 ✓', { exact: true }).waitFor()
      assert.equal(await followups.getByRole('button', { name: '添加到待办', exact: true }).count(), 0)
      await page.getByRole('button', { name: '测试切换到待办' }).click()
      await page.getByRole('button', { name: '我发布的', exact: true }).click()
      const card = page.locator('.published-task').filter({ hasText: title })
      await card.waitFor()
      assert.equal(await card.count(), 1)
      assert.equal(await card.locator('progress').getAttribute('max'), '2')
      assert.equal(await card.locator('progress').getAttribute('value'), '0')
      await page.getByRole('button', { name: '接收的待办', exact: true }).click()
      await page.getByRole('button', { name: '筛选接收联系人', exact: true }).click()
      await page.getByRole('button', { name: '清空选择', exact: true }).click()
      await page.locator('.viewer-label .n-base-selection').click()
      const search = page.getByLabel('搜索待办接收人', { exact: true })
      await search.fill('张三')
      await page.locator('.n-base-select-option').filter({ hasText: '张三' }).click()
      await search.press('Escape')
      await page.getByRole('button', { name: '收起接收人筛选', exact: true }).click()
      await page.getByRole('checkbox', { name: `完成：${title}`, exact: true }).click()
      await page.getByRole('button', { name: '我发布的', exact: true }).click()
      assert.equal(await card.locator('progress').getAttribute('value'), '1')
      assert.match(await card.locator('.recipient-progress').filter({ hasText: '张三' }).innerText(), /已完成/)
      assert.match(await card.locator('.recipient-progress').filter({ hasText: '李四' }).innerText(), /未完成/)
      if (legacy) await page.screenshot({ path: path.join(output, 'shared-task-progress.png') })
      await page.getByRole('button', { name: '测试切换到对话' }).click()
      await followups.getByText('张三：已完成', { exact: true }).waitFor()
      await followups.getByText('李四：未完成', { exact: true }).waitFor()
      await page.reload()
      await followups.getByText('张三：已完成', { exact: true }).waitFor()
      rows = await readTodos()
      assert.equal(rows.length, 2)
      assert.deepEqual(errors, [])
      console.log(`PASS: ${legacy ? 'existing split reply' : 'new structured reply'} -> one candidate -> one shared task -> 0/2 to 1/2 -> chat progress -> reload without duplicates`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
