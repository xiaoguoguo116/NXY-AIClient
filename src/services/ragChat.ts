import { loadRagflowLinks } from './localApplications.ts'
import { readSse } from './chatStream.ts'

export const RAG_MENTION_ID = 'local-ragflow-assistant'
export const RAG_CREDENTIAL_KEY = 'em.ragflow-credential.v1'
export const ragQuestion = (text: string): string | null => {
  const match = /(?:^|\s)@\s*(?:(?:AI\s+)?RAG(?:助手)?|制度知识助手)(?=$|\s|[，,：:？！?!。])/i.exec(text)
  return match
    ? [
        text.slice(0, match.index).trim(),
        text
          .slice(match.index + match[0].length)
          .trim()
          .replace(/^[，,：:]+\s*/, '')
      ]
        .filter(Boolean)
        .join(' ')
    : null
}
export interface RagResult {
  text: string
  contacts?: {
    userId: string
    name: string
    department: string
    responsibility: string
    jobTitle?: string
    matchReason?: string
  }[]
  routing?: { intent: 'people' | 'policy' | 'clarify'; query: string }
  baseUrl: string
  chatId: string
  sessionId: string
  references: { name: string; text: string }[]
  options: { id: string; question: string }[]
  cacheId?: string
  mode?: string
  needsInput?: boolean
}
type Fetcher = (url: string, init: RequestInit) => Promise<Response>
// A runtime override supports tests; the global settings page may persist the credential locally.
let credential = ''
export function setRagCredential(value: string, storage?: Pick<Storage, 'setItem' | 'removeItem'>) {
  credential = value.trim()
  if (storage) {
    if (credential) storage.setItem(RAG_CREDENTIAL_KEY, credential)
    else storage.removeItem(RAG_CREDENTIAL_KEY)
  }
}

export async function requestRag(
  question: string,
  signal: AbortSignal,
  options: {
    storage?: Pick<Storage, 'getItem'>
    fetcher?: Fetcher
    previous?: RagResult
    selection?: { cache_id: string; option_id: string }
    onText?: (text: string) => void
  } = {}
): Promise<RagResult> {
  const started = performance.now()
  const traceId = crypto.randomUUID().slice(0, 8)
  const mark = (stage: string, details: Record<string, unknown> = {}) =>
    console.info('[RAG timing]', { traceId, stage, elapsedMs: Math.round(performance.now() - started), ...details })
  mark('start')
  let firstText = false
  const deliver = (text: string) => {
    if (!text || controller.signal.aborted) return
    if (!firstText) {
      firstText = true
      mark('first_text', { chars: Array.from(text).length })
      options.onText?.(text)
      mark('first_ui_update_dispatched')
    } else options.onText?.(text)
  }
  if (!question.trim() || question.length > 12000) throw new Error('RAGFlow：请输入 1–12000 字的问题。')
  const baseUrl = loadRagflowLinks(options.storage ?? localStorage).url.replace(/\/+$/, '')
  const activeCredential =
    credential || (!options.storage ? localStorage.getItem(RAG_CREDENTIAL_KEY)?.trim() || '' : '')
  const transport = options.fetcher ?? (await import('@tauri-apps/plugin-http')).fetch
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const timer = setTimeout(abort, 120000)
  try {
    return await Promise.race([
      perform(),
      new Promise<never>((_, reject) => {
        if (controller.signal.aborted) reject(new Error('RAGFlow：请求已停止或超时。'))
        else
          controller.signal.addEventListener('abort', () => reject(new Error('RAGFlow：请求已停止或超时。')), {
            once: true
          })
      })
    ])
  } finally {
    mark('request_end', { aborted: controller.signal.aborted })
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }

  async function request(path: string, body?: unknown) {
    if (controller.signal.aborted) throw new Error('RAGFlow：请求已停止或超时。')
    const requestStarted = performance.now()
    mark('request_start', { path })
    const response = await transport(`${baseUrl}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: controller.signal,
      // Native HTTP is not a browser cross-origin request. With the existing
      // unsafe-headers capability, an empty Origin tells plugin-http to omit
      // its automatically injected WebView origin. Keep browser transports intact.
      headers: {
        'Content-Type': 'application/json',
        ...(!options.fetcher ? { Origin: '' } : {}),
        ...(activeCredential
          ? { Authorization: activeCredential.startsWith('Bearer ') ? activeCredential : `Bearer ${activeCredential}` }
          : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    mark('response_headers', {
      path,
      durationMs: Math.round(performance.now() - requestStarted),
      status: response.status
    })
    if (!response.ok) {
      if (response.status === 403) {
        const rejected = await response.json().catch(() => null)
        if (
          ['Cross-origin requests not allowed', 'Cross-site requests not allowed', 'Host not allowed'].includes(
            rejected?.message
          )
        )
          throw new Error('RAGFlow：代理拒绝了请求来源，请检查桌面客户端与代理的连接配置；这不是密钥错误。')
        if (rejected?.message === 'Route not allowed')
          throw new Error('RAGFlow：代理不允许访问该知识助手接口，请检查代理的助手配置。')
      }
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'RAGFlow：无权访问，请在“总设置 → AI 模型”中填写 RAGFlow 访问凭证。'
          : `RAGFlow：服务返回 HTTP ${response.status}，请检查应用中心配置的地址及服务状态。`
      )
    }
    return response
  }
  function unwrap(value: any) {
    if (String(value?.code) !== '0') throw new Error('RAGFlow：问答失败，请检查知识助手配置或服务日志。')
    return value.data
  }
  async function perform(): Promise<RagResult> {
    const config = await (await request('config')).json()
    mark('config_ready')
    if (typeof config.chatId !== 'string' || !/^[\w-]{1,128}$/.test(config.chatId))
      throw new Error('RAGFlow：地址未提供有效的知识助手配置。')
    const previous =
      options.previous?.baseUrl === baseUrl && options.previous.chatId === config.chatId ? options.previous : undefined
    const session = previous?.sessionId
      ? { id: previous.sessionId }
      : unwrap(
          await (
            await request(`ragflow-api/chats/${encodeURIComponent(config.chatId)}/sessions`, {
              name: question.slice(0, 50)
            })
          ).json()
        )
    if (typeof session?.id !== 'string' || !/^[\w-]{1,128}$/.test(session.id))
      throw new Error('RAGFlow：无法创建问答会话。')
    mark('session_ready', { reused: !!previous?.sessionId })
    const response = await request('ragflow-api/chat/completions', {
      chat_id: config.chatId,
      session_id: session.id,
      messages: [{ role: 'user', content: question }],
      stream: true,
      stream_preview: true,
      reasoning: 0,
      clarification_mode: true,
      return_diagnostics: true,
      store_history_messages: true,
      pass_all_history_messages: false,
      ...(previous && options.selection ? { clarification_selection: options.selection } : {})
    })
    let final: any,
      text = '',
      preview = ''
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      let firstEvent = true
      await readSse(
        response,
        controller.signal,
        (raw) => {
          if (firstEvent) {
            mark('first_sse_event')
            firstEvent = false
          }
          if (!raw || raw === '[DONE]') return
          const data = unwrap(JSON.parse(raw))
          if (typeof data?.preview_answer === 'string') {
            preview += data.preview_answer
            deliver(preview)
          } else if (data?.final) final = data
          else if (typeof data?.answer === 'string') {
            text += data.answer
            deliver(text)
          }
        },
        () => mark('first_response_byte')
      )
      if (!final) throw new Error('RAGFlow：连接提前结束，回答未完成。请核对后重试。')
    } else final = unwrap(await response.json())
    mark('answer_complete', { streamed: response.headers.get('content-type')?.includes('text/event-stream') === true })
    const serverTimings = final?.diagnostics?.timings_ms
    if (serverTimings && typeof serverTimings === 'object') {
      const timings = Object.fromEntries(
        Object.entries(serverTimings).filter(
          ([key, value]) => /^[a-z_]+_ms$/.test(key) && typeof value === 'number' && Number.isFinite(value)
        )
      )
      mark('server_timings', timings)
    }
    text = final?.diagnostics?.answer || final?.answer || text
    const clarification = final?.clarification ?? final?.diagnostics?.clarification
    if (!text && typeof clarification?.question === 'string') text = clarification.question
    const choices = Array.isArray(clarification?.options) ? clarification.options : []
    if (!text && choices.length) text = '请补充问题或选择以下方向：'
    if (typeof text !== 'string' || !text.trim()) throw new Error('RAGFlow：未返回文字回答。')
    if (!controller.signal.aborted) deliver(text)
    const chunks = final?.reference?.chunks ?? final?.diagnostics?.context_chunks ?? []
    return {
      text,
      baseUrl,
      chatId: config.chatId,
      sessionId: session.id,
      references: (Array.isArray(chunks) ? chunks : []).map((chunk: any) => ({
        name: String(chunk.docnm_kwd || chunk.document_name || chunk.doc_name || '制度文档'),
        text: String(chunk.content_with_weight ?? chunk.content ?? '')
      })),
      options: choices
        .filter((o: any) => typeof o.question === 'string')
        .map((o: any) => ({ id: String(o.id), question: o.question })),
      cacheId: clarification?.cache_id,
      mode: clarification?.mode,
      needsInput: clarification?.needs_input === true || choices.length > 0
    }
  }
}

export function formatRagReply(result: RagResult) {
  return `【制度知识助手】\n${result.text}${result.options.length ? '\n\n可继续提问：\n' + result.options.map((o, i) => `${i + 1}. @制度知识助手 ${o.question}`).join('\n') : ''}${result.references.length ? '\n\n参考依据：\n' + result.references.map((r, i) => `${i + 1}. ${r.name}\n${r.text}`).join('\n') : ''}`
}
