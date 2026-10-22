const assert = require('node:assert/strict')
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

const cases = [
  ['产品路线图', '林知夏'], ['产品需求调研', '陈澄'], ['数据库访问关系', '周屿'],
  ['网页前端页面开发', '苏晴'], ['桌面客户端应用开发', '罗凯'], ['服务端接口 API 开发', '陈默'],
  ['平台部署', '高远'], ['测试计划', '裴宁'], ['设计规范', '顾言'],
  ['界面视觉设计', '唐可'], ['市场推广', '宋然'], ['客户成功', '陆瑶'],
  ['人事管理', '乔安'], ['产品上线运营', '魏然'], ['业务需求分析', '顾寻'],
  ['iOS 移动端应用开发', '许岚'], ['自动化测试', '方宁'], ['数据仓库', '许知远'],
  ['BI 报表', '卫青'], ['信息安全', '韩策'], ['服务监控', '白河'],
  ['用户研究', '何清'], ['客户投诉', '叶宁'], ['销售运营', '梁晨'],
  ['工资发放', '苏一'], ['设备采购', '郑言'], ['办公工位申请', '沈茉'],
  ['办公电脑故障', '陆北'], ['员工报销', '阮明'], ['供应商付款', '宋禾'],
  ['合同审核', '季恬']
]

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  await page.setViewportSize({ width: 1100, height: 720 })
  const chats = await page.evaluate(() => localStorage.getItem('em.local-chat.v1'))
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    for (const [topic, expected] of cases) {
      await page.locator('.home__sider-nav [aria-label="消息"]').click()
      await page.locator('.list-head button').filter({ hasText: '新建' }).click()
      await page.getByRole('textbox', { name: '消息输入框' }).fill(`@AI RAG助手 ${topic}找谁？`)
      await page.locator('.send-row button.primary').click()
      const card = page.locator('.rag-contact-card').last()
      await card.waitFor()
      assert.deepEqual(await page.locator('.rag-contact-card strong').allTextContents(), [expected], topic)
      await card.getByRole('button', { name: '查看名片' }).click()
      await page.waitForURL(/\/home\/contacts$/)
      await page.locator('.directory-profile__identity').filter({ hasText: expected }).waitFor()
      await page.getByRole('button', { name: '发送消息' }).click()
      await page.waitForURL(/\/home\/message$/)
      await page.locator('.chat-title').filter({ hasText: expected }).waitFor()
      assert.equal(await page.locator('.assistant-shortcut').count(), 3, topic)
      console.log(`PASS ${expected}: ${topic}`)
    }
    assert.deepEqual(pageErrors, [])
    console.log(`PASS: ${cases.length} duties, cards, profiles and direct chats`)
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
