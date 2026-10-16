import { reactive } from 'vue'
import {
  MEETINGS_KEY,
  loadMeetings,
  meetingIsDue,
  validMeetingDraft,
  type LocalMeeting,
  type MeetingDraft,
  type MeetingResponse
} from '@/services/localMeetings'
import { showNotification } from '@/utils/desktop/notification'

export const meetingState = reactive({ items: [] as LocalMeeting[], error: '', alert: '', systemNotice: '' })
let loaded = false

function read() {
  try {
    meetingState.items = loadMeetings(localStorage)
    meetingState.error = ''
  } catch {
    meetingState.error = '会议数据无法读取，原数据已保留，请先备份本机数据。'
  }
}

export function initMeetings() {
  if (!loaded) {
    loaded = true
    read()
  }
}

function commit(items: LocalMeeting[]) {
  if (meetingState.error) throw new Error(meetingState.error)
  localStorage.setItem(MEETINGS_KEY, JSON.stringify({ version: 1, items }))
  meetingState.items = items
}

export function addMeeting(draft: MeetingDraft, sourceId?: string, sourceName?: string) {
  initMeetings()
  if (sourceId) {
    const existing = meetingState.items.find((meeting) => meeting.sourceId === sourceId)
    if (existing) return existing
  }
  const normalized = validMeetingDraft(draft, Date.now())
  const meeting: LocalMeeting = {
    ...normalized,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    creatorId: 'self',
    sourceId,
    sourceName,
    participants: normalized.participants.map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.kind === 'self' ? 'self' : person.kind === 'contact' ? 'contact' : 'simulated',
      response: person.kind === 'self' ? 'accepted' : 'pending'
    }))
  }
  commit([...meetingState.items, meeting])
  return meeting
}

export function respondToMeeting(meetingId: string, participantId: string, response: MeetingResponse) {
  commit(
    meetingState.items.map((meeting) =>
      meeting.id !== meetingId
        ? meeting
        : {
            ...meeting,
            participants: meeting.participants.map((person) =>
              person.id === participantId ? { ...person, response, respondedAt: new Date().toISOString() } : person
            )
          }
    )
  )
}

export function cancelMeeting(meetingId: string) {
  commit(
    meetingState.items.map((meeting) =>
      meeting.id === meetingId ? { ...meeting, cancelledAt: new Date().toISOString() } : meeting
    )
  )
}

let checking = false
export async function checkMeetingReminders() {
  if (checking || meetingState.error) return
  checking = true
  try {
    const due = meetingState.items.filter((meeting) => meetingIsDue(meeting))
    if (!due.length) return
    const ids = new Set(due.map((meeting) => meeting.id))
    commit(
      meetingState.items.map((meeting) =>
        ids.has(meeting.id) ? { ...meeting, remindedAt: new Date().toISOString() } : meeting
      )
    )
    meetingState.alert = `${due.length} 场会议即将开始：${due
      .map((meeting) => meeting.title)
      .join('；')
      .slice(0, 150)}`
    const sent = await showNotification({ title: 'EM 会议提醒', body: meetingState.alert, extra: { type: 'meeting' } })
    if (!sent) meetingState.systemNotice = '系统通知未能发送，请检查 Windows 通知权限；会议页仍保留会议安排。'
  } catch {
    meetingState.systemNotice = '会议提醒状态保存失败，请检查本机存储。'
  } finally {
    checking = false
  }
}

export function startMeetingReminders() {
  initMeetings()
  void checkMeetingReminders()
  const timer = setInterval(() => void checkMeetingReminders(), 15000)
  const sync = (event: StorageEvent) => {
    if (event.key === MEETINGS_KEY) read()
  }
  const wake = () => void checkMeetingReminders()
  window.addEventListener('storage', sync)
  window.addEventListener('focus', wake)
  return () => {
    clearInterval(timer)
    window.removeEventListener('storage', sync)
    window.removeEventListener('focus', wake)
  }
}
