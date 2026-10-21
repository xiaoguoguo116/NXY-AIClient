// Isolated UI flow: chat command -> todo editor -> scheduled notification.
// Uses a fresh browser profile and a virtual clock, never the user's localStorage.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 850 } })
  await context.grantPermissions(['notifications'])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.__TODO_NOTIFICATION_CALLS__ = []
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        if (command === 'plugin:notification|is_permission_granted') return true
        if (command === 'show_app_notification') {
          window.__TODO_NOTIFICATION_CALLS__.push(args.input)
          return null
        }
        throw new Error(`Unexpected native command in todo flow: ${command}`)
      }
    }
  })
  const title = '流程验证：整理会议纪要'
  try {
    await page.clock.install({ time: new Date('2026-10-20T01:00:00.000Z') })
    await page.goto('http://127.0.0.1:1420/tests/todo-flow-preview.html')
    const composer = page.getByRole('textbox', { name: '消息输入框', exact: true })
    await composer.waitFor({ timeout: 7000 }).catch(async () => {
      throw new Error(`Chat did not mount: ${JSON.stringify({ errors, body: await page.locator('body').innerText() })}`)
    })
    await composer.fill(`@AI 把${title}加入待办`)
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.locator('.bubble').filter({ hasText: `已添加到待办：${title}` }).waitFor()

    let stored = await page.evaluate((title) => {
      const chats = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const items = JSON.parse(localStorage.getItem('em.local-todos.v1')).items
      return { chat: chats.conversations[0], todo: items.find((item) => item.title === title), count: items.length }
    }, title)
    assert.equal(stored.count, 1)
    assert.equal(stored.todo.assigneeId, 'self')
    assert.equal(stored.todo.dueAt, undefined)
    assert(stored.chat.messages.some((message) => message.text.includes('已添加到待办')))

    await page.getByRole('button', { name: '测试切换到待办' }).click()
    const row = page.locator('.todos-page > article').filter({ hasText: title })
    await row.waitFor()
    await row.getByRole('button', { name: '编辑', exact: true }).click()
    await page.getByLabel('待办结束时间日期').fill('2026-10-20')
    await page.getByLabel('待办结束时间时刻').selectOption('09:30')
    await page.getByLabel('待办提醒方式').selectOption('custom')
    await page.getByLabel('待办提醒时间日期').fill('2026-10-20')
    await page.getByLabel('待办提醒时间时刻').selectOption('09:15')
    await page.getByRole('button', { name: '保存修改', exact: true }).click()
    await page.getByRole('button', { name: '新建待办', exact: true }).waitFor()

    stored = await page.evaluate((title) => {
      const items = JSON.parse(localStorage.getItem('em.local-todos.v1')).items
      return items.find((item) => item.title === title)
    }, title)
    assert.equal(stored.dueAt, '2026-10-20T01:30:00.000Z')
    assert.equal(stored.reminderAt, '2026-10-20T01:15:00.000Z')
    assert.equal(stored.remindedAt, undefined)
    assert((await row.innerText()).includes('提醒：2026/10/20 09:15:00'))
    assert.equal(await page.evaluate(() => window.__TODO_NOTIFICATION_CALLS__.length), 0)

    await page.clock.fastForward(16 * 60 * 1000)
    await page.waitForFunction(() => window.__TODO_NOTIFICATION_CALLS__.length === 1)
    const result = await page.evaluate((title) => ({
      todo: JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find((item) => item.title === title),
      notification: window.__TODO_NOTIFICATION_CALLS__[0],
      alert: document.querySelector('[role="alert"]')?.textContent
    }), title)
    assert.equal(result.notification.title, 'EM 待办提醒')
    assert.equal(result.notification.extra.type, 'todo')
    assert(result.notification.body.includes(title))
    assert(result.todo.remindedAt)
    assert(result.alert.includes(title))
    await page.clock.fastForward(30 * 1000)
    assert.equal(await page.evaluate(() => window.__TODO_NOTIFICATION_CALLS__.length), 1, 'reminder is sent only once')
    assert.deepEqual(errors, [])

    const output = path.resolve('.preview/todo-flow')
    fs.mkdirSync(output, { recursive: true })
    await page.screenshot({ path: path.join(output, 'reminder-triggered.png'), fullPage: true })
    console.log('PASS: chat creates personal todo; editor persists 09:15 reminder and 09:30 deadline; scheduler fires once at 09:16, stores remindedAt, displays in-app alert, and invokes Windows notification bridge.')
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
