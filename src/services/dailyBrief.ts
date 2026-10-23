import type { LocalMeeting } from './localMeetings.ts'
import type { LocalTodo } from './localTodos.ts'

interface BriefEntry {
  label: string
  at: number
}

const MAX_ROWS = 20

function singleLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function clock(value: number) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function lines(title: string, entries: BriefEntry[]) {
  const visible = entries.slice(0, MAX_ROWS).map((entry) => `- ${entry.label}`)
  if (entries.length > MAX_ROWS) visible.push(`- 另有 ${entries.length - MAX_ROWS} 项，请在待办与会议页查看`)
  return [`${title}（${entries.length}）`, ...(visible.length ? visible : ['- 暂无'])]
}

export function buildDailyBrief(todos: LocalTodo[], meetings: LocalMeeting[], now = Date.now()) {
  const today = new Date(now)
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const nextDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()
  const personal = todos.filter((todo) => !todo.assigneeId || todo.assigneeId === 'self')

  const todayMeetings = meetings
    .filter((meeting) => {
      const start = Date.parse(meeting.startAt)
      return (
        !meeting.cancelledAt &&
        start >= dayStart &&
        start < nextDay &&
        meeting.participants.find((person) => person.id === 'self')?.response !== 'declined'
      )
    })
    .map((meeting) => ({
      at: Date.parse(meeting.startAt),
      label: `${clock(Date.parse(meeting.startAt))} ${singleLine(meeting.title)}${meeting.location ? ` · ${singleLine(meeting.location)}` : ''}`
    }))
    .sort((a, b) => a.at - b.at)

  const pending = personal
    .filter((todo) => !todo.completed && (!todo.dueAt || Date.parse(todo.dueAt) < nextDay))
    .map((todo) => {
      const due = todo.dueAt ? Date.parse(todo.dueAt) : Number.POSITIVE_INFINITY
      const marker = !todo.dueAt
        ? '待排期'
        : due < now
          ? `已到期 ${new Date(due).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${clock(due)}`
          : `今日 ${clock(due)}`
      return { at: due, label: `[${marker}] ${singleLine(todo.title)}` }
    })
    .sort((a, b) => a.at - b.at)

  const completed = personal
    .filter((todo) => {
      const at = todo.completedAt ? Date.parse(todo.completedAt) : Number.NaN
      return todo.completed && at >= dayStart && at < nextDay
    })
    .map((todo) => ({ at: Date.parse(todo.completedAt!), label: singleLine(todo.title) }))
    .sort((a, b) => b.at - a.at)

  const heading = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
  return {
    meetingCount: todayMeetings.length,
    pendingCount: pending.length,
    completedCount: completed.length,
    text: [
      `${heading}工作简报`,
      '',
      ...lines('今日会议', todayMeetings),
      '',
      ...lines('待处理', pending),
      '',
      ...lines('今日完成', completed)
    ].join('\n')
  }
}
