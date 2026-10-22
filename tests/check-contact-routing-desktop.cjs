const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  await page.setViewportSize({ width: 1100, height: 720 })
  const previousChats = await page.evaluate(() => localStorage.getItem('em.local-chat.v1'))
  try {
    async function ask(question) {
      await page.locator('.home__sider-nav [aria-label="消息"]').click()
      await page.locator('.list-head button').filter({ hasText: '新建' }).click()
      await page.getByRole('textbox', { name: '消息输入框' }).fill(`@AI RAG助手 ${question}`)
      await page.locator('.send-row button.primary').click()
    }

    await ask('数据库访问关系应该找谁开通？')
    await page.locator('.rag-contact-card').first().waitFor()
    assert.deepEqual(await page.locator('.rag-contact-card strong').allTextContents(), ['周屿'])

    await ask('服务端接口开发和前端页面开发找谁？')
    await page.locator('.rag-contact-card').nth(1).waitFor()
    assert.deepEqual(await page.locator('.rag-contact-card strong').allTextContents(), ['陈默', '苏晴'])
    assert.match(await page.locator('.bubble').last().innerText(), /可能|核实/)
    const multiChatName = await page.locator('.conversation.selected .summary strong').innerText()

    await ask('报销审批找谁？')
    await page.locator('.rag-contact-card').first().waitFor()
    assert.deepEqual(await page.locator('.rag-contact-card strong').allTextContents(), ['阮明'])

    await ask('食堂菜谱审批找谁？')
    await page.waitForTimeout(1200)
    assert.equal(await page.locator('.rag-contact-card').count(), 0, '无依据的问题不应给出本地名片')

    await page.locator('.conversation').filter({ hasText: multiChatName }).click()
    const card = page.locator('.rag-contact-card').filter({ hasText: '苏晴' })
    await card.getByRole('button', { name: '查看名片' }).click()
    await page.waitForURL(/\/home\/contacts$/)
    await page.locator('.directory-profile__identity').filter({ hasText: '苏晴' }).waitFor()
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.chat-title').filter({ hasText: '苏晴' }).waitFor()
    console.log('PASS: release UI routes exact, multiple and unsupported responsibilities safely')
  } finally {
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem('em.local-chat.v1')
      else localStorage.setItem('em.local-chat.v1', value)
    }, previousChats)
    await page.reload()
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
