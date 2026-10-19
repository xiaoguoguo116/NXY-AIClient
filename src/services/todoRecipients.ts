import { pinyin } from 'pinyin-pro'
import type { Contact } from '../types/api/contacts'
import type { LocalTodo } from './localTodos'

export interface TodoViewerOption {
  [key: string]: unknown
  value: string
  label: string
  name: string
  kind: 'self' | 'all' | 'contact' | 'history'
  assigneeIds: string[]
  searchText: string
  count: number
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '')

function searchText(fields: string[]) {
  return fields
    .flatMap((field) => [
      field,
      pinyin(field, { toneType: 'none' }),
      pinyin(field, { pattern: 'first', toneType: 'none' })
    ])
    .map(normalize)
    .join('\n')
}

/** Contacts remain selectable even when they have never received a local task. */
export function buildTodoViewerOptions(contacts: Contact[], todos: LocalTodo[]): TodoViewerOption[] {
  const options: TodoViewerOption[] = [
    {
      value: 'self',
      label: '我',
      name: '我',
      kind: 'self',
      assigneeIds: ['self'],
      searchText: '我\n自己\nself',
      count: 0
    },
    {
      value: 'all',
      label: '所有接收人',
      name: '所有接收人',
      kind: 'all',
      assigneeIds: [],
      searchText: '所有\n全部\nall',
      count: todos.length
    }
  ]
  const known = new Map<string, TodoViewerOption>([['self', options[0]]])
  for (const contact of contacts) {
    if (contact.deletedAt || contact.peerType !== 'USER') continue
    const id = contact.peerId || contact.userId || contact.id
    if (!id || id === 'self') continue
    const value = `contact:${id}`
    if (known.has(value)) continue
    const name = contact.remark?.trim() || contact.username?.trim() || '未命名联系人'
    const fields = [name, contact.username, contact.remark, contact.account || '', contact.tag].filter(Boolean)
    const detail = [contact.remark && contact.username !== name ? contact.username : '', contact.account, contact.tag]
      .filter(Boolean)
      .join(' · ')
    const option: TodoViewerOption = {
      value,
      name,
      kind: 'contact',
      assigneeIds: [id, value],
      count: 0,
      label: `${name}${detail ? `（${detail}）` : ''}`,
      searchText: searchText(fields)
    }
    options.push(option)
    for (const alias of option.assigneeIds) known.set(alias, option)
  }
  for (const todo of todos) {
    const id = todo.assigneeId || 'self'
    let option = known.get(id)
    if (!option) {
      const name = todo.assigneeName || id
      option = {
        value: `history:${id}`,
        name,
        kind: 'history',
        assigneeIds: [id],
        count: 0,
        label: `${name} · 历史接收人`,
        searchText: searchText([name, id])
      }
      known.set(id, option)
      options.push(option)
    }
    option.count++
    if (todo.assigneeName) option.searchText += `\n${searchText([todo.assigneeName])}`
  }
  return options
}

export function matchesTodoViewer(query: string, option: Pick<TodoViewerOption, 'searchText'>) {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return terms.every((term) => option.searchText.includes(normalize(term)))
}

export function todoMatchesViewer(todo: LocalTodo, option?: TodoViewerOption) {
  if (!option) return false
  return option.kind === 'all' || option.assigneeIds.includes(todo.assigneeId || 'self')
}

export function normalizeTodoViewers(values: string[], previous: string[] = []) {
  const unique = [...new Set(values)]
  if (!unique.includes('all')) return unique
  // Selecting all replaces individuals; selecting an individual leaves all mode.
  return previous.includes('all') && unique.length > 1 ? unique.filter((value) => value !== 'all') : ['all']
}

export function todoMatchesViewers(todo: LocalTodo, options: TodoViewerOption[]) {
  return options.some((option) => todoMatchesViewer(todo, option))
}
