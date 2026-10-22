const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

const RESPONSIBILITY_KEY = 'em.contact-responsibilities.v1'
const CHAT_KEY = 'em.local-chat.v1'

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  await page.setViewportSize({ width: 1100, height: 720 })

  const snapshot = await page.evaluate(({ responsibilityKey, chatKey }) => ({
    responsibility: localStorage.getItem(responsibilityKey),
    chats: localStorage.getItem(chatKey)
  }), { responsibilityKey: RESPONSIBILITY_KEY, chatKey: CHAT_KEY })

  try {
    const work = '负责蓝杉系统账号开通和蓝杉平台权限审批。'
    await page.locator('.home__sider-nav [aria-label="联系人"]').click()
    await page.waitForURL(/\/home\/contacts$/)
    await page.getByRole('button', { name: '我的主页' }).click()
    const editor = page.getByRole('textbox', { name: '编辑我的工作职责' })
    await editor.fill(work)
    await page.getByRole('button', { name: '保存到职责知识库' }).click()
    await page.getByRole('status').filter({ hasText: '已保存到本机人员职责知识库' }).waitFor()

    await page.reload()
    await page.locator('.organization-header').waitFor()
    await page.getByRole('button', { name: '我的主页' }).click()
    assert.equal(await editor.inputValue(), work, '重启页面后职责应仍在')

    await page.locator('.home__sider-nav [aria-label="消息"]').click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.list-head button').filter({ hasText: '新建' }).click()
    await page.getByRole('textbox', { name: '消息输入框' }).fill('@AI RAG助手 蓝杉系统账号应该找谁开通？')
    await page.locator('.send-row button.primary').click()
    const card = page.locator('.rag-contact-card').filter({ hasText: '蓝杉系统账号' }).last()
    await card.waitFor()
    assert.match(await card.innerText(), /我|个人主页/)
    await card.getByRole('button', { name: '查看名片' }).click()
    await page.waitForURL(/\/home\/contacts$/)
    assert.equal(await page.getByRole('textbox', { name: '编辑我的工作职责' }).inputValue(), work)
    console.log('PASS: editable responsibility survives reload and yields a clickable RAG contact card')
  } finally {
    await page.evaluate(({ responsibilityKey, chatKey, responsibility, chats }) => {
      if (responsibility === null) localStorage.removeItem(responsibilityKey)
      else localStorage.setItem(responsibilityKey, responsibility)
      if (chats === null) localStorage.removeItem(chatKey)
      else localStorage.setItem(chatKey, chats)
    }, { responsibilityKey: RESPONSIBILITY_KEY, chatKey: CHAT_KEY, ...snapshot })
    await page.reload()
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
