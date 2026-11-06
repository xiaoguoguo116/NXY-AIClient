import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todoIsExpired, assertTodoEditable, compareTodoDeadline, type LocalTodo } from '../src/services/localTodos.ts'
const now = Date.parse('2026-11-03T10:00:00+08:00')
const base: LocalTodo = { id: 'base', title: '验收', createdAt: '2026-11-01T00:00:00Z', completed: false }
test('deadline locks at the exact boundary, regardless of completion; reminders alone do not lock', () => {
  assert.equal(todoIsExpired(base, now), false)
  assert.equal(todoIsExpired({ dueAt: new Date(now + 1).toISOString() }, now), false)
  const expired = { ...base, dueAt: new Date(now).toISOString() }
  assert.equal(todoIsExpired(expired, now), true)
  assert.throws(() => assertTodoEditable(expired, now), /仅供查看/)
  assert.throws(() => assertTodoEditable({ ...expired, completed: true }, now), /仅供查看/)
  assert.doesNotThrow(() => assertTodoEditable({ ...base, reminderAt: new Date(now - 1000).toISOString() }, now))
  assert.throws(() => assertTodoEditable(undefined, now), /不存在/)
})
test('future and undated tasks come before all expired records without modifying records', () => {
  const records = [
    { ...base, id: 'expired', dueAt: new Date(now - 1000).toISOString() },
    { ...base, id: 'undated' },
    { ...base, id: 'future', dueAt: new Date(now + 1000).toISOString() },
    { ...base, id: 'expired-done', completed: true, dueAt: new Date(now - 2000).toISOString() }
  ]
  const original = JSON.stringify(records)
  assert.deepEqual(
    records
      .slice()
      .sort((a, b) => compareTodoDeadline(a, b, now))
      .map((t) => t.id),
    ['future', 'undated', 'expired-done', 'expired']
  )
  assert.equal(JSON.stringify(records), original)
})
