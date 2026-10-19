export const TODO_TIME_OPTIONS = Array.from(
  { length: 96 },
  (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
)

export function toTodoLocalTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function chineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value)
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  }
  if (value === '十') return 10
  if (/^[一二三四五]?十[一二三四五六七八九]?$/.test(value)) {
    const [tens, ones] = value.split('十')
    return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0)
  }
  return value.length === 1 ? digits[value] : NaN
}

// Only a date plus an explicit clock time is interpreted as a deadline.
export function inferTodoDeadline(text: string, now = new Date()): string | undefined {
  const match =
    /(今天|明天|后天|(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|\d{4}-\d{1,2}-\d{1,2})\s*(凌晨|上午|早上|下午|晚上|中午)?\s*([\d零〇一二两三四五六七八九十]{1,3})(?:点|时|:|：)(?:(半|一刻|三刻)|([\d零〇一二两三四五六七八九十]{1,3})分?)?/.exec(
      text
    )
  if (!match) return
  let hour = chineseNumber(match[3])
  const minute = match[4] ? ({ 半: 30, 一刻: 15, 三刻: 45 }[match[4]] ?? NaN) : match[5] ? chineseNumber(match[5]) : 0
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || !Number.isFinite(hour + minute)) return
  if (['下午', '晚上'].includes(match[2]) && hour < 12) hour += 12
  if (match[2] === '中午' && hour >= 1 && hour < 11) hour += 12
  if (['凌晨', '上午', '早上'].includes(match[2]) && hour === 12) hour = 0
  const due = new Date(now)
  const relative: Record<string, number> = { 今天: 0, 明天: 1, 后天: 2 }
  if (match[1] in relative) due.setDate(due.getDate() + relative[match[1]])
  else {
    const parts = match[1].match(/\d+/g)!.map(Number)
    const [year, month, day] = parts.length === 3 ? parts : [now.getFullYear(), ...parts]
    due.setFullYear(year, month - 1, day)
    if (due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== day) return
  }
  due.setHours(hour, minute, 0, 0)
  if (due.getTime() > now.getTime()) return due.toISOString()
}
