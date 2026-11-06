import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseIntentPlan, actionMissing, intentMessages } from '../src/services/chatIntent.ts'
const people = [
  { id: 'self', name: '我' },
  { id: 'zhang', name: '张三' }
]
const raw = (kind = 'todo', patch = {}) =>
  JSON.stringify({
    replyKind: 'actions',
    actions: [{ kind, title: '准备会议材料', participantIds: ['self'], unresolvedRecipients: [], ...patch }]
  })
test('plans keep summary and creation separate; general cannot smuggle actions', () => {
  assert.deepEqual(parseIntentPlan('{"replyKind":"summary","actions":[]}', 'r', people).actions, [])
  assert.throws(() => parseIntentPlan(raw().replace('actions","actions', 'general","actions'), 'r', people))
  const combined = parseIntentPlan(raw('meeting').replace('actions","actions', 'summary","actions'), 'r', people)
  assert.equal(combined.replyKind, 'summary')
  assert.equal(combined.actions[0].kind, 'meeting')
})
test('invalid output fails closed without a default todo', () => {
  for (const input of [
    '会议',
    '{}',
    '{"replyKind":"actions","actions":[]}',
    raw('task'),
    raw('todo', { participantIds: [1] }),
    raw('todo', { unresolvedRecipients: null })
  ])
    assert.throws(() => parseIntentPlan(input, 'r', people))
})
test('draft status and IDs are application owned; invented people require clarification', () => {
  const a = parseIntentPlan(
    raw('meeting', { status: 'confirmed', id: 'evil', participantIds: ['missing'] }),
    'r',
    people
  ).actions[0]
  assert.equal(a.status, 'draft')
  assert.equal(a.id, 'r:action:0')
  assert.deepEqual(a.participantIds, [])
  assert.deepEqual(a.unresolvedRecipients, ['missing'])
  assert(actionMissing(a).some((s) => s.includes('参会人')))
})
test('missing or past meeting start, missing people and ambiguous action block confirmation', () => {
  const a = parseIntentPlan(raw('choose'), 'r', people).actions[0]
  assert(actionMissing(a).some((s) => s.includes('选择')))
  a.kind = 'meeting'
  a.startAt = '2000-01-01T00:00:00Z'
  assert(actionMissing(a).some((s) => s.includes('未来')))
  a.startAt = '2099-01-01T00:15:00Z'
  assert.deepEqual(actionMissing(a), [])
  a.endAt = a.startAt
  assert(actionMissing(a).length > 0)
})
test('reminder and deadline are separate; reminders require future whole hours', () => {
  const a = parseIntentPlan(raw('todo', { reminderAt: '2099-01-01T17:00:00+08:00' }), 'r', people).actions[0]
  assert.equal(a.dueAt, undefined)
  assert.equal(a.needsReminder, true)
  assert.deepEqual(actionMissing(a), [])
  a.reminderAt = '2099-01-01T17:15:00+08:00'
  assert(actionMissing(a).includes('提醒时间请选择整点'))
  a.reminderAt = undefined
  assert(actionMissing(a).some((s) => s.includes('提醒日期')))
  a.needsReminder = false
  assert.deepEqual(actionMissing(a), [])
})
test('model timestamps must have a timezone; unknown field values cannot be executed', () => {
  const a = parseIntentPlan(raw('meeting', { startAt: '2099-01-01T15:00' }), 'r', people).actions[0]
  assert.equal(a.startAt, undefined)
  assert(actionMissing(a).length)
})
test('followup may only replace an existing pending draft; duplicate replacements rejected', () => {
  const previous = parseIntentPlan(raw(), 'old', people).actions[0]
  const a = parseIntentPlan(raw('todo', { replacesId: previous.id }), 'new', people, [previous]).actions[0]
  assert.equal(a.replacesId, previous.id)
  previous.status = 'confirmed'
  assert.equal(
    parseIntentPlan(raw('todo', { replacesId: previous.id }), 'new', people, [previous]).actions[0].replacesId,
    undefined
  )
})
test('intent prompt distinguishes user action, negation, reference and compound requests', () => {
  const prompt = intentMessages('总结会议记录', people, [])[0].content
  for (const phrase of [
    '总结会议记录=>summary',
    '提醒我准备会议材料=>todo',
    '不要添加待办',
    '不能按',
    '复合指令',
    'replacesId'
  ])
    assert(prompt.includes(phrase))
})
