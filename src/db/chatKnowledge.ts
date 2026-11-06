import { getDb } from './connection.ts'
import { HISTORY_LIMIT, isHumanHistoryText, orderHistory, type ChatHistory } from '../services/chatKnowledge.ts'

interface HistoryRow {
  id: string
  author: string
  content: string
  createdAt: string
  quoteId?: string
}

/** Scoped, read-only snapshot. Local availability does not imply complete server history. */
export async function loadGroupHistory(
  userId: string,
  sessionId: string,
  database?: Pick<Awaited<ReturnType<typeof getDb>>, 'select'>
): Promise<ChatHistory> {
  if (!userId || !sessionId) throw new Error('请先登录并选择群聊。')
  const db = database ?? (await getDb())
  const rows = await db.select<HistoryRow[]>(
    `SELECT id, from_id AS author, content, created_at AS createdAt, quote_msg_id AS quoteId
     FROM t_message
     WHERE user_id = ? AND session_id = ? AND scene_type = 'group' AND deleted_at IS NULL
       AND msg_type = 'text' AND COALESCE(from_type, 'user') <> 'robot'
       AND COALESCE(status, '') NOT IN ('sending', 'failed', 'error', 'pending')
       AND id NOT LIKE 'local-%' AND id NOT LIKE 'robot-stream-%'
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    [userId, sessionId, HISTORY_LIMIT + 1]
  )
  const messages = rows.slice(0, HISTORY_LIMIT).flatMap((row) => {
    try {
      const content = JSON.parse(row.content)
      if (typeof content?.text !== 'string' || !isHumanHistoryText(content.text)) return []
      return [
        {
          id: row.id,
          author: row.author,
          text: content.text,
          createdAt: row.createdAt,
          quoteId: row.quoteId || undefined
        }
      ]
    } catch {
      return []
    }
  })
  return { messages: orderHistory(messages), limited: rows.length > HISTORY_LIMIT }
}
