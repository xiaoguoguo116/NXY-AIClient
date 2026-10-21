const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  const snapshot = await page.evaluate(() => ({
    chats: localStorage.getItem('em.local-chat.v1'),
    user: localStorage.getItem('user')
  }))
  let originalAuth
  const toasts = []
  page.on('request', (request) => {
    if (/\/api\/basic\/v1\/chat\/create/.test(request.url())) {
      toasts.push(`Unexpected online chat request: ${request.url()}`)
    }
  })
  try {
    await page.locator('.home__sider-nav [aria-label="联系人"]').click()
    await page.waitForURL(/\/home\/contacts$/)
    await page.locator('.organization-tree__row').filter({ hasText: '前端组' }).click()
    await page.locator('.organization-member').filter({ hasText: '苏晴' }).click()
    await page.locator('.directory-profile__identity').filter({ hasText: '苏晴' }).waitFor()
    originalAuth = await page.evaluate(async () => {
      const { useUserStore } = await import('/src/stores/user/user.ts')
      const store = useUserStore()
      const original = { ...store.authInfo }
      if (!original.token) store.$patch({ authInfo: { ...original, token: 'invalid-e2e-test-token' } })
      return original
    })
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.chat-title').filter({ hasText: '苏晴' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '返回在线消息' }).count(), 1)
    assert.deepEqual(toasts, [], '本地联系人不应调用在线建聊接口')
    console.log('PASS: local card opens local chat even with an auth token')
  } finally {
    await page.evaluate(async ({ originalAuth, snapshot }) => {
      if (originalAuth) {
        const { useUserStore } = await import('/src/stores/user/user.ts')
        useUserStore().$patch({ authInfo: originalAuth })
      }
      for (const [key, value] of [['em.local-chat.v1', snapshot.chats], ['user', snapshot.user]]) {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      }
    }, { originalAuth, snapshot })
    await page.reload()
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
