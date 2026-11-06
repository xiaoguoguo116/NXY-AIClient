import {
  HISTORY_LIMIT,
  isHumanHistoryText,
  orderHistory,
  type ChatHistory,
  type HistoryMessage
} from './chatKnowledge.ts'
import { messageSender, type LocalConversation } from './localChat.ts'

export function localChatHistory(chat: LocalConversation): ChatHistory {
  const messages = orderHistory(
    chat.messages
      .filter(
        (message) =>
          message.role === 'user' &&
          message.status === 'done' &&
          !message.summarySourceIds &&
          isHumanHistoryText(message.text)
      )
      .map((message) => ({
        id: message.id,
        author: messageSender(chat, message).name,
        text: message.text,
        createdAt: message.createdAt,
        quoteId: message.quoteId
      }))
  )
  return { messages: messages.slice(-HISTORY_LIMIT), limited: messages.length > HISTORY_LIMIT }
}

export function historyContext(messages: HistoryMessage[], id: string): HistoryMessage[] {
  const ordered = orderHistory(messages)
  const index = ordered.findIndex((message) => message.id === id)
  if (index < 0) throw new Error('原消息已删除或不在当前可检索范围，请重新查询。')
  return ordered.slice(Math.max(0, index - 3), index + 4)
}
