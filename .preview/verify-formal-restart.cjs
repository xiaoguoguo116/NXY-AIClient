const { storageForOrigin } = require('./inspect-local-ai-storage.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
const expected = JSON.parse(fs.readFileSync(`${backup}/before-final-restart.json`, 'utf8')).storage
const modelResult = JSON.parse(fs.readFileSync(`${backup}/native-summary-result.json`, 'utf8'))
const current = storageForOrigin('http://tauri.localhost')
for (const key of ['em.local-ai.v1','em.local-ai-key.v1','em.local-todos.v1','em.local-meetings.v1']) {
  assert.equal(current[key] === expected[key], true, `Changed after restart: ${key}`)
}
const chats = JSON.parse(current['em.local-chat.v1'])
const previous = JSON.parse(expected['em.local-chat.v1'])
for (const chat of previous.conversations) {
  const restored = chats.conversations.find(c => c.id === chat.id)
  assert(restored)
  for (const message of chat.messages) {
    const after = restored.messages.find(m => m.id === message.id)
    assert(after && after.text === message.text)
  }
}
const summary = chats.conversations.flatMap(c => c.messages).find(m => m.id === modelResult.answer.id)
assert.equal(summary.status, 'done')
assert.equal(summary.text, modelResult.answer.text)
console.log(JSON.stringify({ restartVerified: true, originalModelAndKeyPreserved: true,
  latestTodosAndMeetingsPreserved: true, chatCount: chats.conversations.length,
  actualSummaryRetained: true, selectedRecords: modelResult.selectedCount }))
