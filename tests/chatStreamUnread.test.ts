import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSse, progressiveText, visibleAiText } from '../src/services/chatStream.ts'
import { buildContext, mentionsAi, requestAi, type LocalConversation } from '../src/services/localChat.ts'
import { requestRag, ragQuestion } from '../src/services/ragChat.ts'
import {
  initializeReadState,
  unreadMessages,
  offerUnreadSummary,
  markChatRead,
  pendingUnreadSummary,
  unreadSummaryBatch,
  dismissUnreadSummary
} from '../src/services/localChatUnread.ts'

const signal = () => new AbortController().signal
const encoder = new TextEncoder()
test('SSE handles split UTF-8, CRLF, multi-line events and unterminated final event', async () => {
  const bytes = encoder.encode(': ping\r\ndata: 中文😀\r\ndata: 第二行\r\n\r\ndata: final')
  const events: string[] = []
  await readSse(
    new Response(
      new ReadableStream({
        start(c) {
          for (const b of bytes) c.enqueue(Uint8Array.of(b))
          c.close()
        }
      })
    ),
    signal(),
    (e) => events.push(e)
  )
  assert.deepEqual(events, ['中文😀\n第二行', 'final'])
})
test('AI sends stream:true and displays tokens before response completion', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const partials: string[] = []
  let complete = false
  const pending = requestAi(
    { baseUrl: 'http://localhost:8899/v1', model: 'test', contextCount: 0 },
    '',
    [],
    signal(),
    async (_url, init) => {
      assert.equal(JSON.parse(init.body as string).stream, true)
      return new Response(
        new ReadableStream({
          start(c) {
            controller = c
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    },
    { onText: (text) => partials.push(text) }
  ).then((result) => {
    complete = true
    return result
  })
  await new Promise((resolve) => setTimeout(resolve, 5))
  controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'))
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.deepEqual(partials, ['你好'])
  assert.equal(complete, false)
  controller.enqueue(
    encoder.encode('data: {"choices":[{"delta":{"content":"世界"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
  )
  controller.close()
  assert.equal(await pending, '你好世界')
})
test('AI detects incomplete streams and cancellation, preserving delivered text', async () => {
  let partial = ''
  const config = { baseUrl: 'http://localhost:8899/v1', model: 'test', contextCount: 0 }
  await assert.rejects(
    requestAi(
      config,
      '',
      [],
      signal(),
      async () =>
        new Response('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n', {
          headers: { 'content-type': 'text/event-stream' }
        }),
      {
        onText: (text) => {
          partial = text
        }
      }
    ),
    /提前结束/
  )
  assert.equal(partial, '部分')
  const abort = new AbortController()
  const pending = requestAi(
    config,
    '',
    [],
    abort.signal,
    async () => new Response(new ReadableStream({}), { headers: { 'content-type': 'text/event-stream' } })
  )
  abort.abort()
  await assert.rejects(pending, /取消/)
})
test('RAG previews are replaced by the verified answer, not concatenated into it', async () => {
  const partials: string[] = []
  const result = await requestRag('出差审批', signal(), {
    storage: { getItem: () => null },
    onText: (text) => partials.push(text),
    fetcher: async (url, init) => {
      if (url.endsWith('/config')) return Response.json({ chatId: 'chat' })
      if (url.endsWith('/sessions')) return Response.json({ code: 0, data: { id: 'session' } })
      assert.equal(JSON.parse(init.body as string).stream_preview, true)
      const events = [
        { preview_answer: '草稿', answer: '', final: false },
        { preview_answer: '待核验', answer: '', final: false },
        { answer: '已核验答案', final: false },
        { final: true, answer: '', diagnostics: { answer: '已核验答案' } }
      ]
      return new Response(events.map((data) => `data: ${JSON.stringify({ code: 0, data })}\n\n`).join(''), {
        headers: { 'content-type': 'text/event-stream' }
      })
    }
  })
  assert.deepEqual(partials, ['草稿', '草稿待核验', '已核验答案', '已核验答案'])
  assert.equal(result.text, '已核验答案')
})
test('progressive output finishes, replaces snapshots and stops after cancellation', async () => {
  const values: string[] = [],
    abort = new AbortController()
  const output = progressiveText((text) => values.push(text), abort.signal)
  await output.finish('你好😀世界')
  assert.equal(values.at(-1), '你好😀世界')
  assert(values.length > 1)
  await output.finish('核验后的内容')
  assert.equal(values.at(-1), '核验后的内容')
  output.push('不应继续')
  const beforeAbort = values.at(-1)
  abort.abort()
  await output.finish('也不显示')
  assert.equal(values.at(-1), beforeAbort)
  assert.equal(visibleAiText('正文\n```em-todos\n[{"title":"任务"}]'), '正文\n')
  assert.equal(visibleAiText('正文\n```em-to'), '正文\n')
})
test('spaced AI and RAG mentions are recognized', () => {
  assert.equal(mentionsAi('@ ai 你好'), true)
  assert.equal(ragQuestion('@ ai rag助手 出差流程'), '出差流程')
})
test('unread consent uses an immutable current-chat batch; legacy history and summaries excluded', () => {
  const chat: LocalConversation = {
    id: 'one',
    name: '群聊',
    messages: [],
    members: [{ id: 'peer', name: '同事', kind: 'simulated', color: '' }]
  }
  const add = (id: string) =>
    chat.messages.push({ id, role: 'user', senderId: 'peer', text: id, createdAt: '', status: 'done' })
  add('old')
  initializeReadState(chat)
  assert.equal(unreadMessages(chat).length, 0)
  add('one')
  add('two')
  offerUnreadSummary(chat)
  markChatRead(chat)
  assert.equal(unreadMessages(chat).length, 0)
  assert.equal(pendingUnreadSummary(chat).length, 2)
  const batch = unreadSummaryBatch(chat)
  add('later')
  dismissUnreadSummary(chat, batch)
  chat.messages.push({
    id: 'request',
    role: 'user',
    text: '总结未读',
    status: 'done',
    createdAt: '',
    summarySourceIds: batch,
    summaryKind: 'unread'
  })
  chat.messages.push({
    id: 'answer',
    role: 'assistant',
    text: '总结',
    status: 'done',
    createdAt: '',
    replyTo: 'request'
  })
  assert.deepEqual(
    unreadMessages(chat).map((m) => m.id),
    ['later']
  )
  const context = buildContext(chat, 'request', 30)
  assert(!context[1].content.includes('later'))
  assert(!context[1].content.includes('old'))
  assert(context[1].content.includes('one'))
  assert.deepEqual(JSON.parse(JSON.stringify(chat)).readState, chat.readState)
})
test('unread summaries batch 100 messages; declining only clears the offered IDs', () => {
  const chat: LocalConversation = { id: 'batch', name: '', messages: [], readState: { seenIds: [], summaryIds: [] } }
  for (let i = 0; i < 101; i++)
    chat.messages.push({ id: String(i), role: 'assistant', text: '消息', status: 'done', createdAt: '' })
  offerUnreadSummary(chat)
  dismissUnreadSummary(chat, unreadSummaryBatch(chat))
  assert.equal(pendingUnreadSummary(chat).length, 1)
  dismissUnreadSummary(chat, ['100'])
  assert.equal(pendingUnreadSummary(chat).length, 0)
  assert.equal(unreadMessages(chat).length, 0)
})

test('unread batches respect text budget and retain remaining messages', () => {
  const chat: LocalConversation = { id: 'budget', name: '', messages: [], readState: { seenIds: [], summaryIds: [] } }
  for (let i = 0; i < 7; i++)
    chat.messages.push({ id: String(i), role: 'assistant', text: '字'.repeat(12000), status: 'done', createdAt: '' })
  offerUnreadSummary(chat)
  assert.equal(unreadSummaryBatch(chat).length, 5)
  dismissUnreadSummary(chat, unreadSummaryBatch(chat))
  assert.deepEqual(unreadSummaryBatch(chat), ['5', '6'])
})
test('own, pending and failed messages are excluded and repeated offers stay unique', () => {
  const chat: LocalConversation = { id: 'filter', name: '', messages: [], readState: { seenIds: [], summaryIds: [] } }
  chat.messages.push({ id: 'own', role: 'user', text: 'own', status: 'done', createdAt: '' })
  for (const status of ['done', 'pending', 'error'] as const)
    chat.messages.push({ id: status, role: 'assistant', text: status, status, createdAt: '' })
  offerUnreadSummary(chat)
  offerUnreadSummary(chat)
  assert.deepEqual(unreadSummaryBatch(chat), ['done'])
})
test('deleted summary source fails closed and a retry cannot silently expand scope', () => {
  const chat: LocalConversation = {
    id: 'deleted',
    name: '',
    messages: [
      { id: 'other', role: 'assistant', text: 'outside scope', status: 'done', createdAt: '' },
      { id: 'request', role: 'user', text: 'summary', status: 'done', createdAt: '', summarySourceIds: ['deleted'] }
    ]
  }
  assert.throws(() => buildContext(chat, 'request', 30), /找不到部分选中记录/)
})
test('summary instructions retain corrections, completed status and known ownership', () => {
  const chat: LocalConversation = {
    id: 'rules',
    name: '',
    messages: [
      { id: 'source', role: 'assistant', text: '周铭负责，提交改为16:30，文档已完成。', status: 'done', createdAt: '' },
      { id: 'request', role: 'user', text: 'summary', status: 'done', createdAt: '', summarySourceIds: ['source'] }
    ]
  }
  const system = buildContext(chat, 'request', 0)[0].content
  assert(system.includes('最后明确的信息'))
  assert(system.includes('不把已完成事项再次列为待办'))
  assert(system.includes('不得在另一节重复标为未明确'))
})

test('first received character is displayed synchronously', () => {
  const values: string[] = []
  const output = progressiveText((text) => values.push(text), signal())
  output.push('你')
  assert.deepEqual(values, ['你'])
  output.stop()
})
