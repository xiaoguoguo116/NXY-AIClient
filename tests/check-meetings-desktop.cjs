const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('/home'))
  if (!page) throw new Error('EM 主窗口未打开')
  const keys = ['em.local-meetings.v1', 'em.local-todos.v1', 'em.local-chat.v1', 'contacts']
  const backup = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys)
  const fixture = `会议验收-${Date.now()}`
  try {
    await page.evaluate(() => localStorage.setItem('contacts', JSON.stringify({
      enterpriseList: [],
      groupList: [],
      friendList: [{ id: 'friend-wang', userId: 'self-user', peerId: 'wang-wu', remark: '王五', tag: '', isBack: false, isTop: false, isConcern: false, isMute: false, peerType: 'USER', status: 'NORMAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, username: '王五原名', account: 'wangwu', userLevel: 1, emotionName: '', emotionUrl: '' }]
    })))
    await page.reload()
    await page.goto('http://tauri.localhost/home/message')
    await page.getByRole('button', { name: '＋ 建群', exact: true }).click()
    await page.getByLabel('本地群名称', { exact: true }).fill(fixture)
    await page.getByLabel('初始模拟成员', { exact: true }).fill('张三，李四')
    await page.getByRole('button', { name: '创建本地群', exact: true }).click()
    await page.getByTitle('向全体或指定成员发布会议').click()
    await page.getByLabel('会议主题').fill('产品方案评审会')
    const localStart = await page.evaluate(() => {
      const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
      date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()
      return { date: local.slice(0, 10), time: local.slice(11, 16) }
    })
    await page.getByLabel('会议开始日期').fill(localStart.date)
    await page.getByLabel('会议开始时刻').selectOption(localStart.time)
    assert.equal(await page.getByLabel('会议开始时刻').locator('option').count(), 97)
    assert.equal(await page.getByLabel('会议开始时刻').locator('option', { hasText: /:01$/ }).count(), 0)
    await page.getByRole('button', { name: '确认开始时间', exact: true }).click()
    await page.getByRole('button', { name: '✓ 开始时间已确认', exact: true }).waitFor()
    await page.getByLabel('搜索全部联系人').fill('王五')
    await page.getByLabel('选择参会人：王五').check()
    await page.getByText('已选 4 人', { exact: true }).waitFor()
    await page.screenshot({
      path: 'C:/Users/94719/.codex/visualizations/2026/10/16/01a14234-3329-7b90-bd80-51ecd33858c4/meeting-all-contacts-selector.png',
      fullPage: true
    })
    await page.getByLabel('会议地点').fill('A301 会议室')
    await page.getByRole('button', { name: '确认发布会议', exact: true }).click()
    await page.getByText(/会议“产品方案评审会”已发布/).waitFor()
    await page.getByRole('button', { name: '关闭 AI 会议助手', exact: true }).click()
    await page.locator('.bubble').filter({ hasText: '会议已发布：产品方案评审会' }).waitFor()

    await page.locator('.home__sider-nav [aria-label="待办事项"]').click()
    await page.getByRole('heading', { name: '待办与会议', exact: true }).waitFor()
    await page.locator('.section-switch').getByRole('button', { name: /会议提醒/ }).click()
    const meeting = page.locator('.meeting-card').filter({ hasText: '产品方案评审会' })
    await meeting.waitFor()
    assert((await meeting.innerText()).includes('我、张三、李四') === false, 'participant rows should render separately')
    assert.equal(await meeting.locator('.participant-row').count(), 4)
    assert((await meeting.innerText()).includes('王五 · 联系人'))
    await meeting.getByLabel('设为不参加：张三').click()
    assert((await meeting.innerText()).includes('1 人不参加'))

    await page.getByRole('button', { name: '日程', exact: true }).click()
    const schedule = page.locator('.schedule-item').filter({ hasText: '产品方案评审会' })
    await schedule.waitFor()
    assert((await schedule.innerText()).includes('A301 会议室'))
    await page.screenshot({
      path: 'C:/Users/94719/.codex/visualizations/2026/10/16/01a14234-3329-7b90-bd80-51ecd33858c4/schedule-ui-verified.png',
      fullPage: true
    })

    await page.getByRole('button', { name: 'AI 会议助手', exact: true }).click()
    await page.getByRole('button', { name: '添加个人待办', exact: true }).click()
    await page.getByLabel('助手待办事项').fill('准备评审材料')
    await page.getByRole('button', { name: '添加到我的待办', exact: true }).click()
    await page.getByText(/已添加到你的待办/).waitFor()
    await page.getByRole('button', { name: '关闭 AI 会议助手', exact: true }).click()
    await page.getByRole('button', { name: '待办事项', exact: true }).click()
    await page.getByText('准备评审材料', { exact: true }).waitFor()

    await page.locator('.section-switch').getByRole('button', { name: /会议提醒/ }).click()
    await page.screenshot({
      path: 'C:/Users/94719/.codex/visualizations/2026/10/16/01a14234-3329-7b90-bd80-51ecd33858c4/meeting-reminder-ui-verified.png',
      fullPage: true
    })
    await page.goto('http://tauri.localhost/home/message')
    assert.equal(await page.getByRole('button', { name: 'RAG 设置', exact: true }).count(), 0)
    await page.goto('http://tauri.localhost/set?tab=aiModel')
    await page.getByRole('heading', { name: '全局模型设置', exact: true }).waitFor()
    await page.getByText('RAGFlow 访问凭证', { exact: true }).waitFor()
    await page.goto('http://tauri.localhost/home/todos')
    console.log('PASS: all-contacts meeting selection, 15-minute confirmation, publish, feedback, schedule, personal todo, and global RAG settings')
  } finally {
    await page.evaluate(({ keys, backup }) => {
      for (const key of keys) {
        if (backup[key] === null) localStorage.removeItem(key)
        else localStorage.setItem(key, backup[key])
      }
    }, { keys, backup })
    await page.reload()
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
