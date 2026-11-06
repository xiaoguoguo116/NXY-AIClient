import { messageSender, type LocalConversation } from './localChat.ts'

function incoming(chat: LocalConversation) {
  const summaries = new Set(
    chat.messages.filter((message) => message.summarySourceIds?.length).map((message) => message.id)
  )
  return chat.messages.filter(
    (message) =>
      message.status === 'done' &&
      messageSender(chat, message).kind !== 'self' &&
      !message.summarySourceIds?.length &&
      !summaries.has(message.replyTo || '')
  )
}

export function initializeReadState(chat: LocalConversation) {
  if (!chat.readState || !Array.isArray(chat.readState.seenIds) || !Array.isArray(chat.readState.summaryIds)) {
    // Older versions did not track reads. Existing history is not assumed to be unread.
    chat.readState = { seenIds: incoming(chat).map((message) => message.id), summaryIds: [] }
  }
  return chat.readState
}

export function unreadMessages(chat: LocalConversation) {
  const seen = new Set(chat.readState?.seenIds || [])
  return incoming(chat).filter((message) => !seen.has(message.id))
}

export function offerUnreadSummary(chat: LocalConversation) {
  const state = initializeReadState(chat)
  state.summaryIds = [...new Set([...state.summaryIds, ...unreadMessages(chat).map((message) => message.id)])]
}

export function markChatRead(chat: LocalConversation) {
  const state = initializeReadState(chat)
  state.seenIds = incoming(chat).map((message) => message.id)
}

export function pendingUnreadSummary(chat: LocalConversation) {
  const ids = new Set(chat.readState?.summaryIds || [])
  return incoming(chat).filter((message) => ids.has(message.id))
}

export function unreadSummaryBatch(chat: LocalConversation) {
  const result: string[] = []
  let length = 0
  for (const message of pendingUnreadSummary(chat)) {
    if (result.length === 100 || length + message.text.length > 60_000) break
    result.push(message.id)
    length += message.text.length
  }
  return result
}

export function dismissUnreadSummary(chat: LocalConversation, ids: string[]) {
  const state = initializeReadState(chat)
  const selected = new Set(ids)
  state.summaryIds = state.summaryIds.filter((id) => !selected.has(id))
  state.seenIds = [...new Set([...state.seenIds, ...ids])]
}
