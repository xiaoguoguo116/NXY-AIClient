const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
;(async () => {
  const result = JSON.parse(fs.readFileSync(`${backup}/native-summary-result.json`, 'utf8'))
  const original = JSON.parse(fs.readFileSync(`${backup}/formal-before-merge.json`, 'utf8'))
  const development = JSON.parse(fs.readFileSync(`${backup}/development-origin.json`, 'utf8')).storage
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
    assert.equal(new URL(page.url()).origin, 'http://tauri.localhost')
    const checks = await page.evaluate(({ original, development, expected }) => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'))
      const answer = data.conversations.flatMap(c => c.messages).find(m => m.id === expected.id)
      const question = data.conversations.flatMap(c => c.messages).find(m => m.id === answer?.replyTo)
      const preserved = source => JSON.parse(source['em.local-chat.v1']).conversations.every(chat => {
        const target = data.conversations.find(c => c.id === chat.id)
        return target && chat.messages.every(m => target.messages.some(t => t.id === m.id && t.text === m.text))
      })
      return {
        native: typeof window.__TAURI_INTERNALS__?.invoke === 'function',
        status: answer?.status, selectedCount: question?.summarySourceIds?.length,
        responseUnchanged: answer?.text === expected.text,
        configUnchanged: localStorage.getItem('em.local-ai.v1') === original['em.local-ai.v1'],
        keyUnchanged: localStorage.getItem('em.local-ai-key.v1') === original['em.local-ai-key.v1'],
        meetingsUnchanged: localStorage.getItem('em.local-meetings.v1') === original['em.local-meetings.v1'],
        // The user may complete/add tasks while verification is in progress.
        // Check retention without rolling back their current edits.
        todosPreserved: JSON.parse(original['em.local-todos.v1']).items.every(old =>
          JSON.parse(localStorage.getItem('em.local-todos.v1')).items.some(current => current.id === old.id)),
        formalChatsPreserved: preserved(original), developmentChatsPreserved: preserved(development),
        conversations: data.conversations.length
      }
    }, { original, development, expected: result.answer })
    assert.equal(checks.status, 'done')
    assert.equal(checks.selectedCount, 7)
    for (const key of ['native','responseUnchanged','configUnchanged','keyUnchanged','meetingsUnchanged','todosPreserved','formalChatsPreserved','developmentChatsPreserved']) assert.equal(checks[key], true, key)
    console.log(JSON.stringify(checks, null, 2))
    // Keep the current user page intact; only inspect persisted data.
    console.log('PASS: actual summary retained, original credentials and both origins chats preserved')
  } finally { await browser.close() }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
