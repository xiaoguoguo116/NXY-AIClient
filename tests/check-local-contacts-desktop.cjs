const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  try {
    const page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => candidate.url().includes('/home'))
    if (!page) throw new Error('EM 主窗口未打开')

    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.reload()
    await page.locator('.home__sider-nav [aria-label="联系人"]').click()
    await page.waitForURL(/\/home\/contacts$/)

    await page.locator('.organization-header').filter({ hasText: '协作示例组织' }).waitFor()
    if (await page.locator('.contacts__profile-overlay').isVisible()) {
      await page.locator('.contacts__profile-close').click()
    }
    assert.equal(await page.locator('.contacts__sider').count(), 0)
    await page.getByRole('button', { name: '我的主页' }).click()
    await page.getByRole('textbox', { name: '编辑我的工作职责' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '保存到职责知识库' }).isVisible(), true)
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/my-contact-profile.png' })
    await page.getByRole('button', { name: '关闭资料' }).click()

    assert.equal(await page.locator('.organization-tree__row').count(), 8)
    await page.locator('.organization-tree__row').filter({ hasText: '研发中心' }).click()
    assert.equal(await page.locator('.organization-member').count(), 6)
    const avatarSources = await page.locator('.organization-member__avatar img').evaluateAll((images) =>
      images.map((image) => image.getAttribute('src'))
    )
    assert.equal(avatarSources.length, 6)
    assert.ok(avatarSources.every((source) => source?.startsWith('data:image/svg+xml,')))
    await page.mouse.move(900, 800)
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/contacts-organization-light.png' })
    await page.locator('.organization-tree__row').filter({ hasText: '前端组' }).click()
    assert.equal(await page.locator('.organization-member').count(), 2)

    await page.locator('.organization-member').filter({ hasText: '苏晴' }).click()
    await page.locator('.directory-profile__identity').filter({ hasText: '苏晴' }).waitFor()
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/contact-profile.png' })
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.chat-title').filter({ hasText: '苏晴 (2)' }).waitFor()
    assert.match(await page.getByRole('textbox', { name: '消息输入框' }).getAttribute('placeholder'), /仅保存在本机/)
    assert.equal(await page.locator('.assistant-shortcut').count(), 3)
    await page.locator('.assistant-shortcut').first().click()
    assert.match(await page.getByRole('textbox', { name: '消息输入框' }).inputValue(), /^@AI /)
    await page.getByRole('textbox', { name: '消息输入框' }).fill('')
    assert.equal(await page.locator('.conversation').filter({ hasText: '苏晴' }).count(), 1)
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/contact-direct-chat.png' })

    await page.locator('.home__sider-nav [aria-label="联系人"]').click()
    await page.locator('.organization-tree__row').filter({ hasText: '前端组' }).click()
    await page.locator('.organization-member').filter({ hasText: '苏晴' }).click()
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    assert.equal(await page.locator('.conversation').filter({ hasText: '苏晴' }).count(), 1)

    await page.getByRole('textbox', { name: '消息输入框' }).fill('@AI RAG助手 数据库访问关系应该找谁开通？')
    await page.locator('.send-row button.primary').click()
    await page.locator('.rag-contact-card').filter({ hasText: '周屿' }).last().waitFor()
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/contact-rag-card.png' })
    await page.locator('.rag-contact-card').filter({ hasText: '周屿' }).last().getByRole('button', { name: '查看名片' }).click()
    await page.waitForURL(/\/home\/contacts$/)
    await page.locator('.directory-profile__identity').filter({ hasText: '周屿' }).waitFor()
    assert.match(await page.locator('.organization-tree__row.active').innerText(), /研发中心/)
    assert.match(await page.locator('.organization-member.active').innerText(), /周屿/)
    await page.getByRole('button', { name: '发送消息' }).click()
    await page.waitForURL(/\/home\/message$/)
    await page.locator('.chat-title').filter({ hasText: '周屿 (2)' }).waitFor()
    await page.locator('.conversation').filter({ hasText: '苏晴' }).click()
    await page.locator('.rag-contact-card').filter({ hasText: '周屿' }).last().getByRole('button', { name: '发送消息' }).click()
    await page.locator('.chat-title').filter({ hasText: '周屿 (2)' }).waitFor()
    assert.equal(await page.locator('.conversation .summary strong').getByText('周屿', { exact: true }).count(), 1)

    const search = page.getByRole('textbox', { name: '全局搜索' })
    await search.fill('质量保障')
    await page.locator('.search-results button').filter({ hasText: '裴宁' }).click()
    await page.locator('.directory-profile__identity').filter({ hasText: '裴宁' }).waitFor()

    assert.equal(pageErrors.length, 0, pageErrors.join('\n'))
    console.log('PASS: local contacts, direct conversation reuse, profiles, and global search')
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
