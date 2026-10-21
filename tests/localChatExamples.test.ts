import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadChats, messageSender, saveChats, type LocalChatData } from '../src/services/localChat.ts'
import { withExampleConversations } from '../src/services/localChatExamples.ts'

const original = (): LocalChatData => ({
  version: 1,
  selectedId: 'existing',
  conversations: [
    {
      id: 'existing',
      name: '原有聊天',
      pinned: true,
      messages: [
        { id: 'old', text: '必须保留的原始消息', role: 'user', status: 'done', createdAt: '2026-10-01T00:00:00Z' }
      ]
    }
  ]
})

test('adds seven labeled groups and 86 attributed messages without altering existing data', () => {
  const data = original()
  const before = structuredClone(data)
  const now = new Date('2026-10-20T08:00:00Z')
  const result = withExampleConversations(data, now)
  assert.deepEqual(data, before)
  assert.equal(result.selectedId, 'existing')
  assert.deepEqual(result.conversations[0], before.conversations[0])
  assert.equal(result.conversations.length, 8)
  const groups = result.conversations.slice(1)
  assert.equal(groups.flatMap((group) => group.messages).length, 86)
  for (const group of groups) {
    assert.match(group.name, /本地示例|模拟项目/)
    assert.equal(group.notifications, false)
    assert.match(group.announcement!, /模拟数据/)
    assert(group.members!.every((member) => member.kind === 'self' || member.kind === 'simulated'))
    for (const [index, message] of group.messages.entries()) {
      assert.equal(messageSender(group, message).id, message.senderId)
      assert.equal(message.status, 'done')
      assert(new Date(message.createdAt) < now)
      if (index) assert(message.createdAt > group.messages[index - 1].createdAt)
    }
  }
  const ids = groups.flatMap((group) => group.messages.map((message) => message.id))
  assert.equal(new Set(ids).size, ids.length)
})

test('version two adds project groups without resurrecting removed version-one examples', () => {
  const data = original()
  data.exampleGroupsVersion = 1
  const result = withExampleConversations(data)
  assert.equal(result.conversations.length, 4)
  assert(result.conversations.slice(1).every((group) => group.id.startsWith('local-example-v2-')))
  assert.equal(result.conversations.slice(1).flatMap((group) => group.messages).length, 54)
  assert.equal(result.exampleGroupsVersion, 2)
})

test('reload does not duplicate examples or restore deleted groups or edited messages', () => {
  const data = withExampleConversations(original())
  data.conversations[1].messages[0].text = '用户修改'
  data.conversations.splice(2, 1)
  let raw = ''
  saveChats(
    {
      setItem: (_, value) => {
        raw = value
      }
    },
    data
  )
  const loaded = loadChats({ getItem: () => raw })
  assert.equal(withExampleConversations(loaded), loaded)
  assert.deepEqual(loaded, data)
})

test('a preexisting example ID is never overwritten and saving failure preserves storage', () => {
  const data = original()
  data.conversations.push({ id: 'local-example-v1-project', name: '用户重命名', messages: [] })
  const result = withExampleConversations(data)
  assert.equal(result.conversations.filter((group) => group.id === 'local-example-v1-project').length, 1)
  assert.equal(result.conversations[1].name, '用户重命名')
  assert.throws(
    () =>
      saveChats(
        {
          setItem: () => {
            throw Error('quota')
          }
        },
        result
      ),
    /quota/
  )
  assert.equal(data.exampleGroupsVersion, undefined)
  assert.equal(data.conversations.length, 2)
})
