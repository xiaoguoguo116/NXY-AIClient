const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  const chats = await page.evaluate(() => localStorage.getItem('em.local-chat.v1'))
  const contactListRequests = []
  page.on('request', (request) => {
    if (/\/api\/basic\/v1\/contacts\/(friend|group|enterprise)\/list/.test(request.url())) {
      contactListRequests.push(request.url())
    }
  })
  try {
    await page.evaluate(() => {
      window.__contactCardToasts = []
      new MutationObserver(() => {
        for (const element of document.querySelectorAll('.n-message')) {
          const message = element.textContent?.trim()
          if (message && !window.__contactCardToasts.includes(message)) window.__contactCardToasts.push(message)
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
    await page.locator('.home__sider-nav [aria-label="消息"]').click()
    await page.locator('.list-head button').filter({ hasText: '新建' }).click()
    await page.getByRole('textbox', { name: '消息输入框' }).fill('@AI RAG助手 数据库访问关系应该找谁开通？')
    await page.locator('.send-row button.primary').click()
    const card = page.locator('.rag-contact-card').filter({ hasText: '周屿' }).last()
    await card.waitFor()
    await card.getByRole('button', { name: '查看名片' }).click()
    await page.waitForURL(/\/home\/contacts$/)
    await page.locator('.directory-profile__identity').filter({ hasText: '周屿' }).waitFor()
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.chat-title').filter({ hasText: '周屿' }).waitFor()
    await page.waitForTimeout(1200)
    const toasts = await page.evaluate(() => window.__contactCardToasts)
    assert.deepEqual(toasts, [], `出现错误弹窗：${toasts.join('；')}`)
    assert.deepEqual(contactListRequests, [], '本地名片流程不应触发需要登录的服务器联系人接口')
    console.log('PASS: card -> profile -> local direct chat without error toast')
  } finally {
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem('em.local-chat.v1')
      else localStorage.setItem('em.local-chat.v1', value)
    }, chats)
    await page.reload()
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
