export const MEETINGS_KEY = 'em.local-meetings.v1'

export function meetingCanChange(meeting: { startAt: string; cancelledAt?: string }, now = Date.now()) {
  return !meeting.cancelledAt && Number.isFinite(Date.parse(meeting.startAt)) && Date.parse(meeting.startAt) > now
}
export function assertMeetingCanChange(
  meeting: { startAt: string; cancelledAt?: string } | undefined,
  now = Date.now()
) {
  if (!meeting) throw new Error('会议不存在，请刷新后重试。')
  if (meeting.cancelledAt) throw new Error('会议已取消，只能查看历史记录。')
  if (!meetingCanChange(meeting, now)) throw new Error('会议开始时间已到或已过去，不能再修改参会状态或取消会议。')
}

export type MeetingResponse = 'pending' | 'accepted' | 'tentative' | 'declined'

export interface MeetingParticipant {
  id: string
  name: string
  kind: 'self' | 'simulated' | 'contact'
  response: MeetingResponse
  respondedAt?: string
}

export interface MeetingRecipient {
  id: string
  name: string
  kind: 'self' | 'simulated' | 'contact'
}

export interface MeetingDraft {
  title: string
  startAt: string
  endAt?: string
  location?: string
  description?: string
  participants: MeetingRecipient[]
}

export interface LocalMeeting {
  id: string
  title: string
  startAt: string
  endAt?: string
  location?: string
  description?: string
  createdAt: string
  creatorId: 'self'
  sourceId?: string
  sourceName?: string
  participants: MeetingParticipant[]
  remindedAt?: string
  cancelledAt?: string
}

export function validMeetingDraft(value: MeetingDraft, now?: number): MeetingDraft {
  if (!value || typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 120)
    throw new Error('会议主题需为 1–120 字。')
  const start = Date.parse(value.startAt)
  if (!Number.isFinite(start)) throw new Error('请选择有效的会议开始时间。')
  if (now !== undefined && start <= now) throw new Error('会议开始时间必须晚于当前时间。')
  if (value.endAt) {
    const end = Date.parse(value.endAt)
    if (!Number.isFinite(end) || end <= start) throw new Error('会议结束时间必须晚于开始时间。')
  }
  if (!Array.isArray(value.participants) || !value.participants.length) throw new Error('请至少选择一位参会人。')
  const people = value.participants
  if (
    people.some(
      (person) => !person.id?.trim() || !person.name?.trim() || !['self', 'simulated', 'contact'].includes(person.kind)
    ) ||
    new Set(people.map((person) => person.id)).size !== people.length
  )
    throw new Error('参会人无效或重复，请重新选择。')
  return {
    title: value.title.trim(),
    startAt: new Date(start).toISOString(),
    ...(value.endAt ? { endAt: new Date(value.endAt).toISOString() } : {}),
    ...(value.location?.trim() ? { location: value.location.trim().slice(0, 120) } : {}),
    ...(value.description?.trim() ? { description: value.description.trim().slice(0, 1000) } : {}),
    participants: people
  }
}

export function loadMeetings(storage: Pick<Storage, 'getItem'>): LocalMeeting[] {
  const raw = storage.getItem(MEETINGS_KEY)
  if (!raw) return []
  const data = JSON.parse(raw)
  if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('会议数据损坏，原数据已保留。')
  const ids = new Set<string>()
  for (const meeting of data.items as LocalMeeting[]) {
    if (!meeting || typeof meeting.id !== 'string' || ids.has(meeting.id) || typeof meeting.createdAt !== 'string')
      throw new Error('会议数据损坏，原数据已保留。')
    validMeetingDraft({ ...meeting, participants: meeting.participants })
    if (
      !meeting.participants.every((person) =>
        ['pending', 'accepted', 'tentative', 'declined'].includes(person.response)
      )
    )
      throw new Error('会议反馈数据损坏，原数据已保留。')
    ids.add(meeting.id)
  }
  return data.items
}

export function meetingIsDue(meeting: LocalMeeting, now = Date.now()) {
  const self = meeting.participants.find((person) => person.id === 'self')
  const reminderAt = Date.parse(meeting.startAt) - 10 * 60 * 1000
  return !meeting.cancelledAt && !meeting.remindedAt && self?.response !== 'declined' && reminderAt <= now
}

export const responseLabel = (response: MeetingResponse) =>
  ({ pending: '待反馈', accepted: '参加', tentative: '待定', declined: '不参加' })[response]

export function meetingResponseCounts(meeting: LocalMeeting) {
  return meeting.participants.reduce(
    (counts, person) => ({ ...counts, [person.response]: counts[person.response] + 1 }),
    { pending: 0, accepted: 0, tentative: 0, declined: 0 } as Record<MeetingResponse, number>
  )
}
