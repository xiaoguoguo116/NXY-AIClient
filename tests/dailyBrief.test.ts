import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyBrief } from '../src/services/dailyBrief.ts'
import type { LocalTodo } from '../src/services/localTodos.ts'
import type { LocalMeeting } from '../src/services/localMeetings.ts'

const now = new Date(2026, 9, 23, 12).getTime()
const onDay = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString()

test('daily brief uses only personal work and local calendar day', () => {
  const todos = [
    { id: 'overdue', title: '  写\n报告  ', completed: false, dueAt: onDay(22, 17) },
    { id: 'today', title: '提交方案', completed: false, assigneeId: 'self', dueAt: onDay(23, 18) },
    { id: 'undated', title: '确认预算', completed: false },
    { id: 'later', title: '下周事项', completed: false, dueAt: onDay(24, 10) },
    { id: 'other', title: '他人任务', completed: false, assigneeId: 'colleague' },
    { id: 'done', title: '完成纪要', completed: true, completedAt: onDay(23, 9) },
    { id: 'old-done', title: '旧成果', completed: true, completedAt: onDay(22, 9) }
  ] as LocalTodo[]
  const meetings = [
    { id: 'a', title: ' 项目\n评审 ', startAt: onDay(23, 15), location: '一号会议室', participants: [] },
    { id: 'cancel', title: '取消会议', startAt: onDay(23, 16), cancelledAt: onDay(22, 9), participants: [] },
    {
      id: 'declined',
      title: '不参加会议',
      startAt: onDay(23, 10),
      participants: [{ id: 'self', response: 'declined' }]
    },
    { id: 'tomorrow', title: '明日会议', startAt: onDay(24, 11), participants: [] }
  ] as LocalMeeting[]
  const brief = buildDailyBrief(todos, meetings, now)
  assert.deepEqual([brief.meetingCount, brief.pendingCount, brief.completedCount], [1, 3, 1])
  assert.match(brief.text, /项目 评审 · 一号会议室/)
  assert.match(brief.text, /已到期.*写 报告/)
  assert.match(brief.text, /今日.*提交方案/)
  assert.match(brief.text, /待排期.*确认预算/)
  assert.match(brief.text, /今日完成（1）\n- 完成纪要/)
  for (const excluded of ['他人任务', '取消会议', '不参加会议', '明日会议', '下周事项', '旧成果']) {
    assert.ok(!brief.text.includes(excluded))
  }
})

test('daily brief handles empty lists and limits long sections without losing counts', () => {
  const empty = buildDailyBrief([], [], now)
  assert.equal(empty.meetingCount, 0)
  assert.equal((empty.text.match(/- 暂无/g) || []).length, 3)
  const many = Array.from({ length: 23 }, (_, index) => ({
    id: String(index),
    title: `任务${index}`,
    completed: false
  })) as LocalTodo[]
  const brief = buildDailyBrief(many, [], now)
  assert.equal(brief.pendingCount, 23)
  assert.match(brief.text, /待处理（23）/)
  assert.match(brief.text, /另有 3 项/)
  assert.ok(!brief.text.includes('任务20'))
})
