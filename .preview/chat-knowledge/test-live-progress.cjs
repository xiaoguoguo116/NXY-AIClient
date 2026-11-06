const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
    assert.equal(new URL(page.url()).origin, 'http://tauri.localhost')
    page.setDefaultTimeout(20000)
    if (await page.evaluate(() => innerWidth < 900 || innerHeight < 600)) {
      for (const command of ['plugin:window|unminimize', 'plugin:window|show', 'plugin:window|set_focus'])
        await page.evaluate(command => window.__TAURI_INTERNALS__.invoke(command, { label: 'home' }), command)
      await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|set_size', { label: 'home', value: { Logical: { width: 1280, height: 860 } } }))
    }
    await page.waitForFunction(() => innerWidth >= 900 && innerHeight >= 600)
    const original = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const chat = data.conversations.find(c => c.id === data.selectedId)
      return { id: chat.id, name: chat.name, messages: chat.messages, members: chat.members }
    })
    assert.equal(original.id, 'emwork-final-pay', 'Use the inspected existing group, never seed data')
    if (!await page.locator('.knowledge-panel').count()) await page.getByRole('button', { name: '问问本群', exact: true }).click()
    const question = 'PAY-217 支付联调事项现在什么进展？修复、回归安排和上线条件最后怎么定的？请说明时间变更和是否已有完成确认。'
    const input = page.getByLabel('想回顾什么事情？')
    const draft = await input.inputValue()
    assert(!draft || draft === question, 'Do not overwrite a user draft')
    await input.fill(question)
    await page.getByRole('button', { name: '查询群聊记录', exact: true }).click()
    console.log('Submitted real DeepSeek query from the desktop history panel')
    await page.waitForFunction(() => {
      const el = document.querySelector('.knowledge-panel')
      return !el || el.querySelector('.answer') || el.querySelector('.error') || /未找到相关记录/.test(el.textContent)
    }, undefined, { timeout: 130000 })
    assert(await page.locator('.knowledge-panel').count(), 'History panel was closed during the query')
    const report = await page.evaluate(() => {
      const panel = document.querySelector('.knowledge-panel')
      const drawer = panel.closest('.n-drawer')
      return {
        error: panel.querySelector('.error')?.textContent,
        coverage: panel.querySelector('.coverage')?.textContent.trim(),
        findings: [...panel.querySelectorAll('.finding')].map(el => ({ kind: el.querySelector('.kind').textContent, text: el.querySelector('p').textContent, refs: [...el.querySelectorAll('.source-link')].map(b => b.textContent.match(/\[(S\d+)\]/)[1]) })),
        unknowns: [...panel.querySelectorAll('.unknowns li')].map(el => el.textContent),
        evidence: [...panel.querySelectorAll('.evidence article')].map(el => ({ ref: el.querySelector('small').textContent.match(/\[(S\d+)\]/)[1], header: el.querySelector('small').textContent.trim(), text: el.querySelector('p').textContent })),
        colors: { drawer: getComputedStyle(drawer).backgroundColor, text: getComputedStyle(panel).color, input: getComputedStyle(panel.querySelector('textarea')).backgroundColor }
      }
    })
    report.question = question
    report.group = original.name
    report.citationChecks = []
    for (const ref of [...new Set(report.findings.flatMap(f => f.refs))]) {
      await page.locator('.finding').getByRole('button', { name: `[${ref}] 查看原消息`, exact: true }).first().click()
      const text = await page.locator('.context .selected p').innerText()
      const evidence = report.evidence.find(e => e.ref === ref)
      assert.equal(text, evidence.text)
      const source = original.messages.find(m => m.text === text)
      assert(source, `Original message missing for ${ref}`)
      const author = original.members.find(m => m.id === source.senderId)?.name || '我'
      const metadata = await page.locator('.context .selected small').innerText()
      assert(metadata.includes(author) && metadata.includes(source.createdAt), 'Original author/time must match')
      report.citationChecks.push({ ref, messageId: source.id, author, time: source.createdAt, exactTextMatch: true })
    }
    const after = await page.evaluate(id => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id).messages, original.id)
    assert.deepEqual(after, original.messages, 'Lookup must not publish or alter group messages')
    report.sourcesUnchanged = true
    const label = process.env.CHECK_LABEL || 'baseline'
    if (label === 'bright') {
      assert(!report.error, report.error)
      assert.equal(report.colors.drawer, 'rgb(255, 255, 255)')
      assert.equal(report.colors.input, 'rgb(255, 255, 255)')
      assert.equal(report.colors.text, 'rgb(38, 52, 70)')
      assert.ok(report.evidence.some(e => /更正一下.*16:30/.test(e.text)))
      assert.ok(report.evidence.some(e => /最终口径/.test(e.text)))
      assert.ok(report.findings.some(f => /16[:：]30/.test(f.text)), 'Answer must retain the latest submission time')
      assert.ok(report.findings.some(f => /上线/.test(f.text) && /审批|未|待/.test(f.text)), 'Answer must retain unapproved release status')
    }
    fs.writeFileSync(`.preview/chat-knowledge/live-progress-${label}.json`, JSON.stringify(report, null, 2))
    if (await page.locator('.context').count()) await page.locator('.context').getByRole('button', { name: '收起', exact: true }).click()
    await page.locator('.answer').scrollIntoViewIfNeeded().catch(() => {})
    await page.screenshot({ path: `.preview/chat-knowledge/live-progress-${label}.png`, fullPage: true })
    console.log(JSON.stringify(report, null, 2))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
