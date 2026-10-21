const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { mergeLocalChats } = require('./merge-local-chats.cjs')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
;(async () => {
  const source = JSON.parse(fs.readFileSync(`${backup}/development-origin.json`, 'utf8'))
  assert(source.databases.every(db => db.stores.every(store => store.count === 0)),
    'Source attachments/documents need a separate migration before continuing')
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  try {
    await page.route('**/__em_migration__.html', route => route.fulfill({ contentType: 'text/html',
      body: '<html><body>正在合并并校验本地聊天记录，请稍候。</body></html>' }))
    await page.goto('http://tauri.localhost/__em_migration__.html')
    const target = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))
    const allowedDifferences = new Set(['em.local-chat.v1', 'workAssistant'])
    for (const [key, value] of Object.entries(source.storage)) {
      assert(allowedDifferences.has(key) || target[key] === value, `Unexpected difference: ${key}`)
    }
    assert(target['em.local-ai.v1'] && target['em.local-ai-key.v1'], 'Original model settings missing')
    fs.writeFileSync(`${backup}/formal-before-merge.json`, JSON.stringify(target), { mode: 0o600 })
    const { merged, conflicts } = mergeLocalChats(JSON.parse(target['em.local-chat.v1']), JSON.parse(source.storage['em.local-chat.v1']))
    const raw = JSON.stringify(merged)
    fs.writeFileSync(`${backup}/merged-chat.json`, raw, { mode: 0o600 })
    await page.evaluate(({ before, after }) => {
      if (localStorage.getItem('em.local-chat.v1') !== before) throw Error('Concurrent change detected')
      localStorage.setItem('em.local-chat.v1', after)
    }, { before: target['em.local-chat.v1'], after: raw })
    const current = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))
    for (const [key, value] of Object.entries(target)) if (key !== 'em.local-chat.v1') assert.equal(current[key], value, `Unexpected change: ${key}`)
    assert.equal(current['em.local-chat.v1'], raw)
    console.log(JSON.stringify({ conversations: merged.conversations.length,
      messages: merged.conversations.reduce((n, c) => n + c.messages.length, 0),
      conflicts, modelConfigUnchanged: true, credentialsUnchanged: true, otherStorageUnchanged: true }))
  } finally {
    await page.goto('http://tauri.localhost/home/message')
    await browser.close()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
