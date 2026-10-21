import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupChatTodoSuggestions } from '../src/services/chatTodoSuggestions.ts'
import { parseTodoSuggestions, publishedTodos, type TodoRecipient } from '../src/services/localTodos.ts'

const members: TodoRecipient[] = [
  { id: 'self', name: '我', kind: 'self' },
  { id: 'zhang', name: '张三', kind: 'simulated' },
  { id: 'li', name: '李四', kind: 'simulated' }
]
const title = '核对接口验收清单，确认错误码、超时重试、分页边界三项'
const dueAt = '2030-10-23T07:00:00.000Z'

test('existing quoted reply merges the same action and resolves owners instead of old self fallback', () => {
  const groups = groupChatTodoSuggestions(
    [
      { title: `李四：${title}`, dueAt },
      { title: `张三：${title}`, dueAt }
    ],
    members,
    { fallbackIds: ['self'], quoteAuthorId: 'li' }
  )
  assert.equal(groups.length, 1)
  assert.equal(groups[0].title, title)
  assert.deepEqual(groups[0].indexes, [0, 1])
  assert.deepEqual(
    groups[0].recipients.map((p) => p.id),
    ['li', 'zhang']
  )
  const rows = groups[0].recipients.map((p, index) => ({
    id: p.id,
    title,
    dueAt,
    createdAt: '2026-10-21T00:00:00Z',
    completed: index === 0,
    assignmentKey: 'answer:0',
    groupId: 'group',
    assigneeId: p.id,
    assigneeName: p.name
  }))
  const published = publishedTodos(rows)
  assert.equal(published.length, 1)
  assert.equal(published[0].completed, 1)
  assert.equal(published[0].total, 2)
})

test('structured response preserves all owners when AI repeats one action with different people', () => {
  const parsed = parseTodoSuggestions(
    '候选\n```em-todos\n' +
      JSON.stringify([
        { title, dueAt, assigneeIds: ['li'] },
        { title, dueAt, assigneeIds: ['zhang'] }
      ]) +
      '\n```'
  )
  const groups = groupChatTodoSuggestions(parsed.suggestions, members)
  assert.equal(groups.length, 1)
  assert.deepEqual(
    groups[0].recipients.map((p) => p.id),
    ['li', 'zhang']
  )
})

test('quoted first person is the source author; explicit @ selection takes precedence', () => {
  const drafts = [{ title: `我和张三：${title}` }]
  assert.deepEqual(
    groupChatTodoSuggestions(drafts, members, { quoteAuthorId: 'li' })[0].recipients.map((p) => p.id),
    ['li', 'zhang']
  )
  assert.deepEqual(
    groupChatTodoSuggestions(drafts, members, { quoteAuthorId: 'li', explicitIds: ['self'] })[0].recipients.map(
      (p) => p.id
    ),
    ['self']
  )
})

test('different tasks/deadlines remain separate; dismissed/added candidates keep their indexes', () => {
  const drafts = [
    { title: `张三：${title}`, dueAt },
    { title: `李四：${title}`, dueAt },
    { title: `李四：${title}`, dueAt: '2030-10-24T07:00:00.000Z' },
    { title: '张三：提交测试报告', dueAt }
  ]
  assert.equal(groupChatTodoSuggestions(drafts, members).length, 3)
  assert.equal(groupChatTodoSuggestions(drafts, members, { addedIndexes: [0] }).length, 4)
  assert.equal(groupChatTodoSuggestions([{ ...drafts[0], dismissed: true }, drafts[1]], members).length, 2)
  assert.equal(
    groupChatTodoSuggestions(
      [
        { title, assigneeIds: ['li', 'zhang'] },
        { ...drafts[1], mergedInto: 0 }
      ],
      members,
      { addedIndexes: [0] }
    ).length,
    1
  )
})

test('unknown, removed and ambiguous owners do not silently become a personal task', () => {
  assert(groupChatTodoSuggestions([{ title, assigneeIds: ['unknown'] }], members)[0].recipientError)
  assert(
    groupChatTodoSuggestions(
      [{ title: `李四和张三：${title}` }],
      [...members, { id: 'other-li', name: '李四', kind: 'simulated' }]
    )[0].recipientError
  )
  assert.equal(groupChatTodoSuggestions([{ title: '准备资料' }], members)[0].recipients[0].id, 'self')
})
