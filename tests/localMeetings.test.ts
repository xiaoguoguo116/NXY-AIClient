import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadMeetings,
  meetingIsDue,
  meetingResponseCounts,
  responseLabel,
  validMeetingDraft,
  MEETINGS_KEY,
  type LocalMeeting
} from '../src/services/localMeetings.ts'

const participants = [
  { id: 'self', name: '我', kind: 'self' as const },
  { id: 'zhang', name: '张三', kind: 'simulated' as const },
  { id: 'contact:wang', name: '王五', kind: 'contact' as const }
]

test('meeting validation normalizes dates and rejects invalid schedules or participants', () => {
  const now = Date.parse('2026-10-16T00:00:00Z')
  const result = validMeetingDraft(
    {
      title: ' 方案评审 ',
      startAt: '2026-10-17T02:00:00Z',
      endAt: '2026-10-17T03:00:00Z',
      location: ' A301 ',
      participants
    },
    now
  )
  assert.equal(result.title, '方案评审')
  assert.equal(result.location, 'A301')
  assert.equal(result.participants[2].kind, 'contact')
  assert.throws(
    () => validMeetingDraft({ title: '过期会议', startAt: '2026-10-15T02:00:00Z', participants }, now),
    /晚于当前时间/
  )
  assert.throws(
    () =>
      validMeetingDraft({
        title: '倒置时间',
        startAt: '2026-10-17T03:00:00Z',
        endAt: '2026-10-17T02:00:00Z',
        participants
      }),
    /结束时间/
  )
  assert.throws(
    () => validMeetingDraft({ title: '无人会议', startAt: '2026-10-17T03:00:00Z', participants: [] }),
    /至少选择/
  )
  assert.throws(
    () =>
      validMeetingDraft({
        title: '无效联系人',
        startAt: '2026-10-17T03:00:00Z',
        participants: [{ id: 'x', name: '王五', kind: 'unknown' as never }]
      }),
    /参会人无效/
  )
})

test('meeting reminders respect cancellation, prior reminder and self decline', () => {
  const base: LocalMeeting = {
    id: 'm1',
    title: '晨会',
    startAt: '2026-10-16T01:00:00Z',
    createdAt: '2026-10-15T01:00:00Z',
    creatorId: 'self',
    participants: [{ id: 'self', name: '我', kind: 'self', response: 'accepted' }]
  }
  const now = Date.parse('2026-10-16T01:01:00Z')
  assert.equal(meetingIsDue(base, now), true)
  assert.equal(meetingIsDue(base, Date.parse('2026-10-16T00:49:59Z')), false)
  assert.equal(meetingIsDue(base, Date.parse('2026-10-16T00:50:00Z')), true)
  assert.equal(meetingIsDue({ ...base, remindedAt: '2026-10-16T01:00:00Z' }, now), false)
  assert.equal(meetingIsDue({ ...base, cancelledAt: '2026-10-16T00:00:00Z' }, now), false)
  assert.equal(meetingIsDue({ ...base, participants: [{ ...base.participants[0], response: 'declined' }] }, now), false)
})

test('feedback summaries and storage validation preserve participant responses', () => {
  const meeting: LocalMeeting = {
    id: 'm1',
    title: '评审',
    startAt: '2026-10-17T01:00:00Z',
    createdAt: '2026-10-15T01:00:00Z',
    creatorId: 'self',
    participants: [
      { id: 'self', name: '我', kind: 'self', response: 'accepted' },
      { id: 'a', name: '张三', kind: 'simulated', response: 'declined' },
      { id: 'b', name: '李四', kind: 'simulated', response: 'pending' }
    ]
  }
  assert.deepEqual(meetingResponseCounts(meeting), { pending: 1, accepted: 1, tentative: 0, declined: 1 })
  assert.equal(responseLabel('declined'), '不参加')
  assert.deepEqual(
    loadMeetings({
      getItem: (key) => {
        assert.equal(key, MEETINGS_KEY)
        return JSON.stringify({ version: 1, items: [meeting] })
      }
    }),
    [meeting]
  )
  assert.throws(() =>
    loadMeetings({
      getItem: () =>
        JSON.stringify({
          version: 1,
          items: [{ ...meeting, participants: [{ ...meeting.participants[0], response: 'unknown' }] }]
        })
    })
  )
})
