import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTodoViewerOptions,
  matchesTodoViewer,
  normalizeTodoViewers,
  todoMatchesViewer,
  todoMatchesViewers
} from '../src/services/todoRecipients.ts'
import { getLocalFriendList } from '../src/services/localContacts.ts'

const contacts = getLocalFriendList()
const base = { title: '待办', createdAt: '2026-10-19T00:00:00Z', completed: false }

test('multiple recipients form a union without duplicate tasks; empty selection shows none', () => {
  const todos = [
    { ...base, id: 'self' },
    { ...base, id: 'a', assigneeId: contacts[0].peerId },
    { ...base, id: 'b', assigneeId: contacts[1].peerId }
  ]
  const options = buildTodoViewerOptions(contacts, todos)
  assert.deepEqual(
    todos.filter((todo) => todoMatchesViewers(todo, [options[0], options[2]])).map((todo) => todo.id),
    ['self', 'a']
  )
  assert.equal(todos.filter((todo) => todoMatchesViewers(todo, [options[2], options[2]])).length, 1)
  assert.equal(todos.filter((todo) => todoMatchesViewers(todo, [])).length, 0)
  assert.equal(todos.filter((todo) => todoMatchesViewers(todo, [options[1]])).length, 3)
})

test('all and individual selections are exclusive; removing or clearing selections stays empty', () => {
  assert.deepEqual(normalizeTodoViewers(['self', 'contact:a', 'all'], ['self', 'contact:a']), ['all'])
  assert.deepEqual(normalizeTodoViewers(['all', 'contact:a'], ['all']), ['contact:a'])
  assert.deepEqual(normalizeTodoViewers(['self', 'contact:a', 'self']), ['self', 'contact:a'])
  assert.deepEqual(normalizeTodoViewers([], ['self']), [])
})

test('the full contact directory is available without any task history', () => {
  const options = buildTodoViewerOptions(contacts, [])
  assert.equal(options.filter((option) => option.kind === 'contact').length, 13)
  assert(options.every((option) => option.count === 0))
  assert.deepEqual(
    options.slice(0, 2).map((option) => option.value),
    ['self', 'all']
  )
})

test('substring, remark, account, department, full pinyin and initials are searchable', () => {
  const contact = { ...contacts.find((person) => person.username === '苏晴')!, remark: '苏老师' }
  const option = buildTodoViewerOptions([contact], []).find((option) => option.kind === 'contact')!
  for (const query of ['苏', '晴', '老师', 'SU.Q', '前端', 'suqing', 'sq', 'su lao shi', '前端 sq', 'ＳＱ', '  SQ  ']) {
    assert.equal(matchesTodoViewer(query, option), true, query)
  }
  assert.equal(matchesTodoViewer('不存在', option), false)
  assert.equal(matchesTodoViewer('前端 李', option), false)
  assert.equal(matchesTodoViewer('', option), true)
})

test('raw and contact-prefixed IDs share one option and collect both sets of tasks', () => {
  const id = contacts[0].peerId
  const todos = [
    { ...base, id: 'one', assigneeId: id },
    { ...base, id: 'two', assigneeId: `contact:${id}` },
    { ...base, id: 'self' }
  ]
  const options = buildTodoViewerOptions([contacts[0], contacts[0]], todos)
  const option = options.find((option) => option.kind === 'contact')!
  assert.equal(options.length, 3)
  assert.equal(option.count, 2)
  assert.equal(todos.filter((todo) => todoMatchesViewer(todo, option)).length, 2)
  assert.equal(todos.filter((todo) => todoMatchesViewer(todo, options[0])).length, 1)
  assert.equal(todos.filter((todo) => todoMatchesViewer(todo, options[1])).length, 3)
  assert.equal(todoMatchesViewer(todos[0], undefined), false)
})

test('same-name contacts and historical recipients are never merged by display name', () => {
  const first = { ...contacts[0], username: '同名', remark: '', account: 'first' }
  const second = { ...contacts[1], username: '同名', remark: '', account: 'second' }
  const todos = [{ ...base, id: 'one', assigneeId: 'legacy-person', assigneeName: '同名' }]
  const options = buildTodoViewerOptions([first, second], todos)
  assert.equal(options.filter((option) => option.name === '同名').length, 3)
  assert.equal(options.find((option) => option.kind === 'history')!.count, 1)
  assert(options.filter((option) => option.kind === 'contact').every((option) => option.count === 0))
  assert.notEqual(options[2].label, options[3].label)
})

test('removed contacts retain historical tasks; group entries are excluded', () => {
  const deleted = { ...contacts[0], deletedAt: '2026-10-19' }
  const group = { ...contacts[1], peerType: 'GROUP' }
  const todos = [{ ...base, id: 'one', assigneeId: deleted.peerId, assigneeName: '旧备注' }]
  const options = buildTodoViewerOptions([deleted, group], todos)
  assert.equal(options.length, 3)
  assert.equal(options[2].kind, 'history')
  assert.equal(matchesTodoViewer('旧备', options[2]), true)
  assert.equal(todoMatchesViewer(todos[0], options[2]), true)
})
