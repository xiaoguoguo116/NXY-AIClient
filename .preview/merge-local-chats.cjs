function mergeLocalChats(formal, development) {
  if (formal.version !== 1 || development.version !== 1) throw Error('Unsupported chat format')
  const merged = structuredClone(formal)
  const byId = new Map(merged.conversations.map(chat => [chat.id, chat]))
  let selected = development.selectedId
  let conflicts = 0
  const comparable = message => {
    const { createdAt, ...rest } = message
    return JSON.stringify(rest)
  }
  for (const source of development.conversations) {
    const target = byId.get(source.id)
    if (!target) {
      const copy = structuredClone(source)
      merged.conversations.push(copy)
      byId.set(copy.id, copy)
      continue
    }
    const messages = new Map(target.messages.map(message => [message.id, message]))
    const conflicting = source.name !== target.name || source.messages.some(message =>
      messages.has(message.id) && comparable(messages.get(message.id)) !== comparable(message))
    if (conflicting) {
      const copy = structuredClone(source)
      copy.id = `merged-preserved-${source.id}`
      if (byId.has(copy.id)) throw Error('Conflict archive already exists; review before merging again')
      copy.name += '（合并保留）'
      merged.conversations.push(copy)
      byId.set(copy.id, copy)
      if (selected === source.id) selected = copy.id
      conflicts++
      continue
    }
    for (const message of source.messages) {
      const existing = messages.get(message.id)
      if (!existing) {
        const copy = structuredClone(message)
        target.messages.push(copy)
        messages.set(copy.id, copy)
      } else if (message.createdAt < existing.createdAt) {
        // Identical seeded content may have been created on first formal launch.
        existing.createdAt = message.createdAt
      }
    }
  }
  merged.selectedId = byId.has(selected) ? selected : formal.selectedId
  merged.exampleGroupsVersion = Math.max(formal.exampleGroupsVersion || 0, development.exampleGroupsVersion || 0)
  return { merged, conflicts }
}
module.exports = { mergeLocalChats }

if (require.main === module) {
  const assert = require('node:assert/strict')
  const message = (id, text) => ({ id, text, role: 'user', status: 'done', createdAt: '2026-10-20T00:00:00Z' })
  const original = { version: 1, selectedId: 'a', conversations: [
    { id: 'a', name: '原记录', messages: [message('m', '保留')] }
  ] }
  const source = { version: 1, selectedId: 'b', exampleGroupsVersion: 2, conversations: [
    { id: 'a', name: '原记录', messages: [message('m', '保留'), message('n', '新增')] },
    { id: 'b', name: '新群', messages: [message('x', '新群消息')] }
  ] }
  const { merged } = mergeLocalChats(original, source)
  assert.equal(original.conversations[0].messages.length, 1)
  assert.equal(merged.conversations.length, 2)
  assert.equal(merged.conversations[0].messages.length, 2)
  assert.equal(merged.selectedId, 'b')
  assert.deepEqual(mergeLocalChats(merged, source).merged, merged)
  source.conversations[0].messages[0].text = '不同修改'
  const conflict = mergeLocalChats(original, source)
  assert.equal(conflict.conflicts, 1)
  assert.equal(conflict.merged.conversations[0].messages[0].text, '保留')
  assert.equal(conflict.merged.conversations.find(c => c.id.startsWith('merged-')).messages[0].text, '不同修改')
  console.log('PASS: merge preserves original, appends, deduplicates and archives conflicts')
}
