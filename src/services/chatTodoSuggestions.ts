import { resolveRecipients, type TodoRecipient, type TodoSuggestion } from './localTodos.ts'

export interface GroupedTodoSuggestion extends TodoSuggestion {
  indexes: number[]
  recipients: TodoRecipient[]
  recipientError?: string
  added: boolean
}

// Keep original candidate indexes as storage keys: re-rendering or reloading must not create duplicates.
export function groupChatTodoSuggestions(
  suggestions: TodoSuggestion[],
  members: TodoRecipient[],
  options: { explicitIds?: string[]; fallbackIds?: string[]; quoteAuthorId?: string; addedIndexes?: number[] } = {}
): GroupedTodoSuggestion[] {
  const result: GroupedTodoSuggestion[] = []
  for (const [index, suggestion] of suggestions.entries()) {
    if (suggestion.mergedInto !== undefined) continue
    let title = suggestion.title
    let ids = suggestion.assigneeIds?.length ? suggestion.assigneeIds : undefined
    let recipientError: string | undefined
    // Compatibility for earlier AI replies such as “李四：核对清单” and “张三：核对清单”.
    const prefix = /^([^：:\n]{1,80})[：:]\s*(.+)$/s.exec(title)
    if (prefix) {
      const names = prefix[1].split(/[、，,和与及]/).map((name) => name.trim().replace(/^@/, ''))
      const matched = names.map((name) => {
        if (name === '我' || name === '自己')
          return [members.find((m) => m.id === (options.quoteAuthorId || 'self'))].filter(Boolean) as TodoRecipient[]
        return members.filter((m) => m.kind !== 'ai' && m.name === name)
      })
      if (matched.every((matches) => matches.length === 1)) {
        title = prefix[2].trim()
        ids ??= matched.map((matches) => matches[0].id)
      } else if (matched.some((matches) => matches.length > 0)) {
        recipientError = '负责人无法唯一匹配当前成员，请重新明确负责人。'
      }
    }
    ids = options.explicitIds?.length ? options.explicitIds : ids || options.fallbackIds || ['self']
    let recipients: TodoRecipient[] = []
    try {
      recipients = resolveRecipients(members, ids)
    } catch {
      recipientError = '负责人已不在当前会话或无法识别，请重新选择成员。'
    }
    const added = options.addedIndexes?.includes(index) || false
    // Never combine different deadlines, unrelated actions, dismissed candidates or already-added records.
    const existing =
      !added && !suggestion.dismissed && !recipientError
        ? result.find(
            (item) =>
              !item.added &&
              !item.dismissed &&
              !item.recipientError &&
              item.title === title &&
              item.dueAt === suggestion.dueAt
          )
        : undefined
    if (existing) {
      existing.indexes.push(index)
      existing.recipients = [
        ...new Map([...existing.recipients, ...recipients].map((person) => [person.id, person])).values()
      ]
    } else result.push({ ...suggestion, title, indexes: [index], recipients, recipientError, added })
  }
  return result
}
