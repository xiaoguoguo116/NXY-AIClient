const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home/message'))
  assert(page, 'Formal chat window missing')
  assert.equal(new URL(page.url()).origin, 'http://tauri.localhost')
  page.setDefaultTimeout(15000)
  const chatId = 'local-example-v2-mobile-approval'
  try {
    await page.getByRole('button', { name: /移动审批·改版联调（模拟项目）/ }).click()
    await page.getByText('模型：deepseek-flash', { exact: true }).waitFor()
    const before = await page.evaluate(id => {
      const raw = localStorage.getItem('em.local-chat.v1')
      const chat = JSON.parse(raw).conversations.find(c => c.id === id)
      return { raw, ids: chat.messages.map(m => m.id), pending: chat.messages.some(m => m.status === 'pending') }
    }, chatId)
    assert.equal(before.pending, false, 'Existing model request is still running; do not interrupt it')
    fs.writeFileSync(`${backup}/before-native-summary-chat.json`, before.raw, { mode: 0o600 })
    assert(await page.evaluate(() => typeof window.__TAURI_INTERNALS__?.invoke === 'function'),
      'Native bridge unavailable')
    // No route mocks, HTTP adapters, or replacement of the native bridge.
    // Tauri freezes its invoke property; do not treat a failed hook as evidence.
    // Use the same last seven synthetic project records the user was discussing.
    await page.locator(`[data-message-id="${chatId}-message-12"] .bubble`).click({ button: 'right' })
    await page.getByText('多选', { exact: true }).click()
    await page.getByRole('button', { name: '清空', exact: true }).click()
    for (let number = 12; number <= 18; number++) {
      await page.locator(`[data-message-id="${chatId}-message-${number}"] input[type=checkbox]`).check()
    }
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true })
    const draft = await input.inputValue()
    if (draft) fs.writeFileSync(`${backup}/pre-summary-draft.txt`, draft, { mode: 0o600 })
    await input.fill('')
    await page.getByRole('button', { name: '@AI 总结', exact: true }).click()
    await page.waitForFunction(({ id, existing }) => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const chat = data.conversations.find(c => c.id === id)
      return chat.messages.some(m => m.role === 'assistant' && !existing.includes(m.id) && m.status !== 'pending')
    }, { id: chatId, existing: before.ids }, { timeout: 135000 })
    const result = await page.evaluate(({ id, existing }) => {
      const chat = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id)
      const answer = chat.messages.find(m => m.role === 'assistant' && !existing.includes(m.id))
      const question = chat.messages.find(m => m.id === answer?.replyTo)
      return { answer, selectedCount: question?.summarySourceIds?.length }
    }, { id: chatId, existing: before.ids })
    fs.writeFileSync(`${backup}/native-summary-result.json`, JSON.stringify(result), { mode: 0o600 })
    console.log(JSON.stringify({ status: result.answer?.status, error: result.answer?.error,
      selectedCount: result.selectedCount, answer: result.answer?.text }, null, 2))
    assert.equal(result.answer?.status, 'done', result.answer?.error)
    assert.equal(result.selectedCount, 7)
    assert(result.answer.text.includes('APP-91'))
    assert(result.answer.text.includes('乔安'))
    await page.locator(`[data-message-id="${result.answer.id}"] .bubble`).evaluate(node => node.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/formal-native-summary.png' })
    await page.reload()
    await page.locator(`[data-message-id="${result.answer.id}"] .bubble`).waitFor()
    await page.getByText('模型：deepseek-flash', { exact: true }).waitFor()
    const saved = JSON.parse(fs.readFileSync(`${backup}/formal-before-merge.json`, 'utf8'))
    const intact = await page.evaluate(({ config, key }) => ({
      config: localStorage.getItem('em.local-ai.v1') === config,
      key: localStorage.getItem('em.local-ai-key.v1') === key
    }), { config: saved['em.local-ai.v1'], key: saved['em.local-ai-key.v1'] })
    assert.deepEqual(intact, { config: true, key: true })
    console.log('PASS: formal executable, original global configuration, native model response, seven-record summary and reload persistence')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
