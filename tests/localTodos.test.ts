import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  publishedTodos,
  parseTodoCommand,
  parseAssignedCommand,
  resolveRecipients,
  parseTodoSuggestions,
  isDue,
  loadTodos,
  validDraft,
  todoReminderAt,
  TODOS_KEY
} from '../src/services/localTodos.ts'
import { inferTodoDeadline, TODO_TIME_OPTIONS, toTodoLocalTime } from '../src/services/todoTime.ts'
import { validateTodoAttachments } from '../src/services/todoAttachments.ts'
test('publisher sees independent recipient progress, legacy assignments and separate same-title tasks', () => {
  const base = { title: '报告', createdAt: '2026-10-15T00:00:00Z', completed: false, groupId: 'g', assignmentKey: 'a' }
  const items = [
    { ...base, id: '1', assigneeId: 'one', completed: true },
    { ...base, id: '2', assigneeId: 'two' },
    { ...base, id: '3', assigneeId: 'self', assignmentKey: 'personal' },
    { ...base, id: '4', assigneeId: 'two', publisherId: 'someone-else', assignmentKey: 'other' },
    { ...base, id: '5', assigneeId: 'two', assignmentKey: 'new' }
  ]
  const groups = publishedTodos(items)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].completed, 1)
  assert.equal(groups[0].total, 2)
  assert.equal(publishedTodos(items.map((t) => ({ ...t, completed: true })))[0].completed, 2)
})
test('local assignment defaults to self, supports selected and all, rejects unknown names and excludes AI', () => {
  const members = [
    { id: 'self', name: '我', kind: 'self' as const },
    { id: 'a', name: '张三', kind: 'simulated' as const },
    { id: 'b', name: '李四', kind: 'simulated' as const },
    { id: 'ai', name: 'AI 助手', kind: 'ai' as const }
  ]
  assert.deepEqual(
    parseAssignedCommand('@AI 把报告加入待办', members)?.recipients.map((m) => m.id),
    ['self']
  )
  assert.deepEqual(
    parseAssignedCommand('@AI @张三 @李四 把报告加入待办', members)?.recipients.map((m) => m.id),
    ['a', 'b']
  )
  assert.deepEqual(
    parseAssignedCommand('@AI 把报告加入待办 @张三 @李四', members)?.recipients.map((m) => m.id),
    ['a', 'b']
  )
  assert.deepEqual(
    parseAssignedCommand('@AI @全体成员 把报告加入待办', members)?.recipients.map((m) => m.id),
    ['self', 'a', 'b']
  )
  assert.throws(() => parseAssignedCommand('@AI @不存在 把报告加入待办', members), /无法唯一找到/)
  assert.throws(() => resolveRecipients(members, ['removed']), /已不在群内/)
  assert.equal(
    isDue({
      id: 'x',
      title: 'x',
      createdAt: new Date().toISOString(),
      completed: false,
      dueAt: '2020-01-01T00:00:00Z',
      assigneeId: 'a'
    }),
    false
  )
})
test('explicit command creates a draft with local relative time; negatives and summaries do not', () => {
  const now = new Date(2026, 9, 15, 10)
  const result = parseTodoCommand('@AI 把明天下午3点提交报告添加到待办事项中', now)!
  assert.equal(result.title, '明天下午3点提交报告')
  const due = new Date(result.dueAt!)
  assert.equal(due.getDate(), 16)
  assert.equal(due.getHours(), 15)
  for (const text of [
    '把提交报告加入待办',
    '@AI 不要把提交报告加入待办',
    '@AI 总结待办事项',
    '@AI 如果我说把提交报告加入待办'
  ])
    assert.equal(parseTodoCommand(text, now), null)
  assert.equal(parseTodoCommand('@AI 添加待办：核对接口文档', now)?.dueAt, undefined)
  assert.equal(parseTodoCommand('@ai将提交报告添加到待办事项', now)?.title, '提交报告')
  assert.equal(parseTodoCommand('@AI 把今天上午9点提交报告加入待办', now)?.dueAt, undefined)
})
test('summary candidates are bounded, deduplicated and strip metadata only when valid', () => {
  const result = parseTodoSuggestions(
    '总结内容\n```em-todos\n[{"title":"李工：更新接口","dueAt":null},{"title":"李工：更新接口"},{"title":"","dueAt":"bad"}]\n```'
  )
  assert.equal(result.text, '总结内容')
  assert.deepEqual(result.suggestions, [{ title: '李工：更新接口' }])
  const invalid = '回复\n```em-todos\n{broken}\n```'
  assert.equal(parseTodoSuggestions(invalid).text, invalid)
  assert.equal(parseTodoSuggestions('无待办事项').suggestions.length, 0)
})
test('reminders exclude completed and previously reminded items; overdue catchup works', () => {
  const todo = {
    id: '1',
    title: '报告',
    createdAt: '2026-10-15T00:00:00Z',
    completed: false,
    dueAt: '2026-10-15T01:00:00Z'
  }
  const now = Date.parse('2026-10-15T02:00:00Z')
  assert.equal(isDue(todo, now), true)
  assert.equal(isDue({ ...todo, completed: true }, now), false)
  assert.equal(isDue({ ...todo, remindedAt: '2026-10-15T01:00:00Z' }, now), false)
  assert.equal(isDue({ ...todo, dueAt: undefined }, now), false)
  assert.equal(isDue({ ...todo, dueAt: '2026-10-16T01:00:00Z' }, now), false)
})
test('storage validation preserves invalid data, valid records survive serialization', () => {
  const items = [
    { id: '1', title: '测试', createdAt: new Date().toISOString(), completed: false, sourceKey: 'message:0' }
  ]
  assert.deepEqual(
    loadTodos({
      getItem: (key) => {
        assert.equal(key, TODOS_KEY)
        return JSON.stringify({ version: 1, items })
      }
    }),
    items
  )
  assert.throws(() => loadTodos({ getItem: () => '{broken' }))
  assert.throws(() => loadTodos({ getItem: () => JSON.stringify({ version: 1, items: [...items, ...items] }) }))
  assert.throws(() => validDraft({ title: '', dueAt: 'invalid' }))
})

test('Chinese tomorrow at three becomes October 20 at 15:00; Arabic and Chinese clocks agree', () => {
  const now = new Date(2026, 9, 19, 10)
  for (const text of ['明天下午三点提交报告', '明天下午3点提交报告', '明天15:00提交报告']) {
    const result = parseTodoCommand(`@AI 把${text}加入待办`, now)!
    assert.equal(toTodoLocalTime(result.dueAt), '2026-10-20T15:00')
  }
  assert.equal(toTodoLocalTime(inferTodoDeadline('明天下午三点十五分提交报告', now)), '2026-10-20T15:15')
  assert.equal(toTodoLocalTime(inferTodoDeadline('明天下午三点一刻提交报告', now)), '2026-10-20T15:15')
  assert.equal(toTodoLocalTime(inferTodoDeadline('明天下午三点半提交报告', now)), '2026-10-20T15:30')
  assert.equal(toTodoLocalTime(inferTodoDeadline('明天下午三点三刻提交报告', now)), '2026-10-20T15:45')
})

test('deadlines handle month/year rollover, leap days and explicit distant dates', () => {
  assert.equal(toTodoLocalTime(inferTodoDeadline('明天上午九点', new Date(2026, 11, 31, 10))), '2027-01-01T09:00')
  assert.equal(toTodoLocalTime(inferTodoDeadline('后天上午九点', new Date(2026, 9, 31, 10))), '2026-11-02T09:00')
  const now = new Date(2026, 9, 19, 10)
  assert.equal(toTodoLocalTime(inferTodoDeadline('2028年2月29日下午三点', now)), '2028-02-29T15:00')
  assert.equal(toTodoLocalTime(inferTodoDeadline('2030-12-31 18:45', now)), '2030-12-31T18:45')
  for (const text of ['2027年2月29日下午三点', '明天25:00', '明天下午三点六十分', '明天下午提交报告', '今天上午九点'])
    assert.equal(inferTodoDeadline(text, now), undefined, text)
})

test('quarter-hour picker offers 96 slots without rounding stored arbitrary-minute deadlines', () => {
  assert.equal(TODO_TIME_OPTIONS.length, 96)
  assert.equal(TODO_TIME_OPTIONS[0], '00:00')
  assert.equal(TODO_TIME_OPTIONS.at(-1), '23:45')
  assert(TODO_TIME_OPTIONS.every((time) => Number(time.slice(3)) % 15 === 0))
  assert.equal(toTodoLocalTime(new Date(2026, 9, 20, 15, 7).toISOString()), '2026-10-20T15:07')
})

test('separate reminder can be early, late, disabled or without a deadline; legacy behavior remains', () => {
  const todo = {
    id: '1',
    title: '报告',
    createdAt: '2026-10-19T00:00:00Z',
    completed: false,
    dueAt: '2026-10-20T07:00:00Z'
  }
  const now = Date.parse('2026-10-20T06:45:00Z')
  assert.equal(isDue(todo, now), false)
  assert.equal(isDue({ ...todo, reminderAt: '2026-10-20T06:30:00Z' }, now), true)
  assert.equal(isDue({ ...todo, reminderAt: '2026-10-20T08:00:00Z' }, now + 3600000), false)
  assert.equal(isDue({ ...todo, reminderAt: null }, now + 86400000), false)
  assert.equal(isDue({ ...todo, dueAt: undefined, reminderAt: '2026-10-20T06:30:00Z' }, now), true)
  assert.equal(todoReminderAt(todo), todo.dueAt)
})

test('attachment metadata and reminder settings survive storage reload', () => {
  const draft = validDraft({
    title: ' 附件任务 ',
    dueAt: '2026-10-20T15:00:00+08:00',
    reminderAt: null,
    attachments: [{ id: 'file1', name: '监管通知.pdf', size: 1024, type: 'application/pdf' }]
  })
  const items = [{ ...draft, id: '1', createdAt: new Date().toISOString(), completed: false }]
  assert.deepEqual(loadTodos({ getItem: () => JSON.stringify({ version: 1, items }) }), items)
  assert.equal(draft.dueAt, '2026-10-20T07:00:00.000Z')
  assert.throws(() => validDraft({ title: 'x', reminderAt: 'invalid' }), /提醒时间/)
  assert.throws(() => validDraft({ title: 'x', attachments: [{ id: 'a', name: 'x', size: -1, type: '' }] }), /附件/)
})

test('attachment limits reject oversized, unsupported and excessive files before storage', () => {
  validateTodoAttachments([
    { name: '报告.docx', size: 1024 },
    { name: '依据.PDF', size: 2048 }
  ])
  assert.throws(() => validateTodoAttachments([{ name: '大文件.pdf', size: 21 * 1024 * 1024 }]), /20 MB/)
  assert.throws(() => validateTodoAttachments(Array.from({ length: 11 }, () => ({ name: 'a.txt', size: 1 }))), /10 个/)
  assert.throws(
    () => validateTodoAttachments(Array.from({ length: 3 }, () => ({ name: 'a.pdf', size: 18 * 1024 * 1024 }))),
    /50 MB/
  )
  assert.throws(() => validateTodoAttachments([{ name: 'script.exe', size: 10 }]), /不支持/)
})

test('legacy missing Chinese deadlines use creation date; explicitly cleared modern dates stay empty', () => {
  const old = {
    id: 'old',
    title: '明天下午三点提交报告',
    createdAt: new Date(2026, 9, 19, 10).toISOString(),
    completed: false
  }
  const load = (item: object) => loadTodos({ getItem: () => JSON.stringify({ version: 1, items: [item] }) })[0]
  assert.equal(toTodoLocalTime(load(old).dueAt), '2026-10-20T15:00')
  assert.equal(load({ ...old, scheduleVersion: 1 }).dueAt, undefined)
  assert.equal(load({ ...old, dueAt: '2026-12-01T00:00:00Z' }).dueAt, '2026-12-01T00:00:00Z')
})
