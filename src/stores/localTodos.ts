import { reactive } from 'vue'
import {
  TODOS_KEY,
  loadTodos,
  validDraft,
  isDue,
  todoReminderAt,
  type LocalTodo,
  type TodoDraft,
  type TodoRecipient
} from '@/services/localTodos'
import { inferTodoDeadline } from '@/services/todoTime'
import { showNotification } from '@/utils/desktop/notification'

export const todoState = reactive({ items: [] as LocalTodo[], error: '', alert: '', systemNotice: '' })
let loaded = false
function read() {
  try {
    todoState.items = loadTodos(localStorage)
    todoState.error = ''
  } catch {
    todoState.error = '待办数据无法读取，原数据已保留，请先备份本机数据。'
  }
}
export function initTodos() {
  if (!loaded) {
    loaded = true
    read()
  }
}
function commit(items: LocalTodo[]) {
  if (todoState.error) throw new Error(todoState.error)
  localStorage.setItem(TODOS_KEY, JSON.stringify({ version: 1, items }))
  todoState.items = items
}
export function addTodo(draft: TodoDraft, sourceKey?: string, sourceName?: string) {
  initTodos()
  const existing = sourceKey && todoState.items.find((t) => t.sourceKey === sourceKey)
  if (existing) return existing
  const todo: LocalTodo = {
    ...validDraft({ ...draft, dueAt: 'dueAt' in draft ? draft.dueAt : inferTodoDeadline(draft.title) }),
    scheduleVersion: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    completed: false,
    sourceKey,
    sourceName
  }
  commit([...todoState.items, todo])
  return todo
}
export function updateTodo(id: string, patch: Partial<LocalTodo>) {
  commit(
    todoState.items.map((t) => {
      if (t.id !== id) return t
      const next = { ...t, ...patch, ...validDraft({ ...t, ...patch }), scheduleVersion: 1 as const, id: t.id }
      if (todoReminderAt(next) !== todoReminderAt(t)) next.remindedAt = undefined
      if (patch.completed !== undefined && patch.completed !== t.completed)
        next.completedAt = patch.completed ? new Date().toISOString() : undefined
      return next
    })
  )
}
export function addAssignedTodos(
  draft: TodoDraft,
  recipients: TodoRecipient[],
  sourceKey: string,
  groupId: string,
  sourceName: string
) {
  initTodos()
  const existing = todoState.items.filter((t) => t.assignmentKey === sourceKey || t.sourceKey === sourceKey)
  if (existing.length) return existing
  const normalized = validDraft(draft)
  if (!recipients.length || recipients.some((r) => r.kind === 'ai')) throw new Error('请选择有效的待办接收人。')
  const items = [...new Map(recipients.map((r) => [r.id, r])).values()].map((r) => ({
    ...normalized,
    scheduleVersion: 1 as const,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    completed: false,
    assigneeId: r.id,
    assigneeName: r.name,
    groupId,
    assignmentKey: sourceKey,
    publisherId: 'self',
    sourceKey: `${sourceKey}:${r.id}`,
    sourceName
  }))
  commit([...todoState.items, ...items])
  return items
}
let checking = false
export async function checkTodoReminders() {
  if (checking || todoState.error) return
  checking = true
  try {
    const due = todoState.items.filter((t) => isDue(t))
    if (!due.length) return
    const ids = new Set(due.map((t) => t.id))
    commit(todoState.items.map((t) => (ids.has(t.id) ? { ...t, remindedAt: new Date().toISOString() } : t)))
    todoState.alert = `${due.length} 项待办已到提醒时间：${due
      .map((t) => t.title)
      .join('；')
      .slice(0, 150)}`
    const sent = await showNotification({ title: 'EM 待办提醒', body: todoState.alert, extra: { type: 'todo' } })
    if (!sent) todoState.systemNotice = '系统通知未能发送，请检查 Windows 通知权限；待办页仍保留到期事项。'
  } catch {
    todoState.systemNotice = '提醒状态保存失败，请检查本机存储。'
  } finally {
    checking = false
  }
}
export function startTodoReminders() {
  initTodos()
  void checkTodoReminders()
  const timer = setInterval(() => void checkTodoReminders(), 15000)
  const sync = (event: StorageEvent) => {
    if (event.key === TODOS_KEY) read()
  }
  const wake = () => void checkTodoReminders()
  window.addEventListener('storage', sync)
  window.addEventListener('focus', wake)
  return () => {
    clearInterval(timer)
    window.removeEventListener('storage', sync)
    window.removeEventListener('focus', wake)
  }
}
