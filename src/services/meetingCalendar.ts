import type { LocalMeeting } from './localMeetings'

const REMINDER_MINUTES = 10
const encoder = new TextEncoder()

function calendarDate(value: string | number) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

function calendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

// iCalendar lines must be folded at 75 UTF-8 octets, including Chinese text.
function foldLine(value: string) {
  let result = ''
  let bytes = 0
  for (const character of value) {
    const length = encoder.encode(character).length
    if (bytes + length > 75) {
      result += '\r\n '
      bytes = 1
    }
    result += character
    bytes += length
  }
  return result
}

export function buildMeetingCalendarEvent(meeting: LocalMeeting, now = new Date()) {
  const start = Date.parse(meeting.startAt)
  const end = meeting.endAt ? Date.parse(meeting.endAt) : start + 60 * 60 * 1000
  if (!meeting.id || !meeting.title.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error('会议时间无效，无法添加到本地日历。')
  if (meeting.cancelledAt) throw new Error('已取消的会议不能添加到本地日历。')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EM//Meeting Calendar//ZH-CN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:em-${encodeURIComponent(meeting.id)}@local`,
    `DTSTAMP:${calendarDate(now.getTime())}`,
    `DTSTART:${calendarDate(start)}`,
    `DTEND:${calendarDate(end)}`,
    `SUMMARY:${calendarText(meeting.title)}`,
    ...(meeting.location ? [`LOCATION:${calendarText(meeting.location)}`] : []),
    ...(meeting.description ? [`DESCRIPTION:${calendarText(meeting.description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    `DESCRIPTION:${calendarText(`${meeting.title}即将开始`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

/** Opens an importable .ics event, or saves it when no calendar app is associated. */
export async function openMeetingInCalendar(meeting: LocalMeeting) {
  const { BaseDirectory, mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
  const { openPath } = await import('@tauri-apps/plugin-opener')
  const directory = 'meeting-calendar'
  const fileName = `meeting-${encodeURIComponent(meeting.id)}.ics`
  const relativePath = `${directory}/${fileName}`
  const calendarEvent = buildMeetingCalendarEvent(meeting)
  await mkdir(directory, { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeTextFile(relativePath, calendarEvent, { baseDir: BaseDirectory.AppLocalData })
  const path = await join(await appLocalDataDir(), directory, fileName)
  try {
    await openPath(path)
    return { status: 'opened' as const, path }
  } catch {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const savedPath = await save({
      title: '保存会议日历文件',
      defaultPath: `EM-${meeting.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 40) || '会议'}.ics`,
      filters: [{ name: '日历事件', extensions: ['ics'] }]
    })
    if (!savedPath) throw new Error(`系统未能打开日历应用。日历文件已保存在：${path}`)
    await writeTextFile(savedPath, calendarEvent)
    return { status: 'saved' as const, path: savedPath }
  }
}
