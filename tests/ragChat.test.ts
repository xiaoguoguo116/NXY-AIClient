import test from 'node:test'
import assert from 'node:assert/strict'
import { ragQuestion, requestRag, formatRagReply, setRagCredential } from '../src/services/ragChat.ts'
import { mentionsAi, buildContext, messageSender } from '../src/services/localChat.ts'

const storage = { getItem: () => JSON.stringify({ url: 'http://127.0.0.1:8090/' }) }
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })

test('RAG mention is distinct from ordinary AI, people, email and missing questions', () => {
  assert.equal(ragQuestion('@AI RAG助手 请假制度是什么？'), '请假制度是什么？')
  assert.equal(ragQuestion('请 @ai RAG助手：报销要求'), '请 报销要求')
  assert.equal(ragQuestion('@AI RAG助手'), '')
  assert.equal(ragQuestion('@AI RAG 请假制度'), '请假制度')
  assert.equal(ragQuestion('@rag助手 请假制度'), '请假制度')
  assert.equal(ragQuestion('@RAG：报销制度'), '报销制度')
  assert.equal(mentionsAi('@AI RAG助手 请假制度'), false)
  assert.equal(mentionsAi('@AI RAG 请假制度'), false)
  assert.equal(mentionsAi('@AI 介绍一下自己'), true)
  for (const text of ['@AI 总结', '@张三 请假', 'user@AI RAG助手 test', '@AI RAG助手们 问题'])
    assert.equal(ragQuestion(text), null)
})

test('text-only clarification retains needsInput and reuses the previous session', async () => {
  const requests: any[] = []
  const fetcher = async (url: string, init: RequestInit) => {
    if (url.endsWith('/config')) return json({ chatId: 'policy' })
    if (url.endsWith('/sessions')) return json({ code: 0, data: { id: 'clarify-session' } })
    requests.push(JSON.parse(String(init.body)))
    return json({
      code: 0,
      data: { answer: '请说明想了解的范围。', diagnostics: { clarification: { needs_input: true, options: [] } } }
    })
  }
  const first = await requestRag('制度', new AbortController().signal, { storage, fetcher })
  assert.equal(first.needsInput, true)
  assert.equal(first.options.length, 0)
  await requestRag('我想了解申请流程', new AbortController().signal, { storage, fetcher, previous: first })
  assert.equal(requests[1].session_id, 'clarify-session')
  assert.equal(requests[1].clarification_selection, undefined)
})

test('general AI and RAG have different senders and independent implicit history', () => {
  const chat = {
    id: 'chat',
    name: '同事',
    messages: [
      { id: 'rag-q', role: 'user' as const, text: '@AI RAG 办理要求', status: 'done' as const, createdAt: '' },
      {
        id: 'rag-a',
        role: 'assistant' as const,
        assistant: 'ragflow' as const,
        text: '制度回复',
        status: 'done' as const,
        createdAt: ''
      },
      { id: 'q', role: 'user' as const, text: '@AI 你好', status: 'done' as const, createdAt: '' }
    ]
  }
  assert.equal(messageSender(chat, chat.messages[1]).name, 'AI RAG助手')
  assert.equal(messageSender(chat, { ...chat.messages[1], assistant: undefined }).name, 'AI 助手')
  const context = buildContext(chat, 'q', 12)
  assert.equal(context.length, 2)
  assert.equal(context[1].content, '你好')
})

test('uses configured gateway, isolated session, complete SSE answer, evidence and clarification', async () => {
  const requests: { url: string; body: any }[] = []
  const final = {
    code: 0,
    data: {
      final: true,
      answer: '按第三条办理。',
      reference: { chunks: [{ docnm_kwd: '请假制度', content: '第三条：提前申请。' }] },
      clarification: { cache_id: 'cache', mode: 'knowledge', options: [{ id: 'a', question: '年假怎么申请？' }] }
    }
  }
  const fetcher = async (url: string, init: RequestInit) => {
    requests.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    if (url.endsWith('/config')) return json({ chatId: 'policy' })
    if (url.endsWith('/sessions')) return json({ code: 0, data: { id: 'session-one' } })
    const bytes = new TextEncoder().encode(
      `data: {"code":0,"data":{"answer":"草稿"}}\r\n\r\ndata: ${JSON.stringify(final)}\r\n\r\ndata: {"code":0,"data":true}\n\n`
    )
    return new Response(
      new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
          controller.close()
        }
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  }
  const result = await requestRag('如何请假？', new AbortController().signal, { storage, fetcher })
  assert.equal(result.text, '按第三条办理。')
  assert.deepEqual(result.references, [{ name: '请假制度', text: '第三条：提前申请。' }])
  assert.match(formatRagReply(result), /【AI RAG助手】[\s\S]*请假制度/)
  assert.equal(requests.length, 3)
  assert.deepEqual(requests[2].body.messages, [{ role: 'user', content: '如何请假？' }])
  assert.equal(requests[2].body.session_id, 'session-one')
  await requestRag('年假怎么申请？', new AbortController().signal, {
    storage,
    fetcher,
    previous: result,
    selection: { cache_id: 'cache', option_id: 'a' }
  })
  assert.equal(requests.length, 5)
  assert.deepEqual(requests[4].body.clarification_selection, { cache_id: 'cache', option_id: 'a' })
})

test('rejects HTTP auth failure, failed payloads and incomplete streams', async () => {
  for (const mode of ['auth', 'payload', 'stream']) {
    const fetcher = async (url: string) => {
      if (url.endsWith('/config')) return json({ chatId: 'policy' })
      if (mode === 'auth') return new Response('', { status: 401 })
      if (mode === 'payload') return json({ code: 100, message: 'sensitive details' })
      if (url.endsWith('/sessions')) return json({ code: 0, data: { id: 's' } })
      return new Response('data: {"code":0,"data":{"answer":"partial"}}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }
    await assert.rejects(
      requestRag('问题', new AbortController().signal, { storage, fetcher }),
      mode === 'auth' ? /无权访问/ : mode === 'stream' ? /回答未完成/ : /问答失败/
    )
  }
})

test('proxy origin and route rejections are not reported as missing credentials', async () => {
  for (const [reason, expected] of [
    ['Cross-origin requests not allowed', /不是密钥错误/],
    ['Route not allowed', /助手配置/]
  ]) {
    await assert.rejects(
      requestRag('问题', new AbortController().signal, {
        storage,
        fetcher: async () => new Response(JSON.stringify({ message: reason }), { status: 403 })
      }),
      expected
    )
  }
})

test('stops stalled transports promptly and never persists credentials', async () => {
  const controller = new AbortController()
  setRagCredential('secret')
  let calls = 0
  const promise = requestRag('问题', controller.signal, {
    storage,
    fetcher: async (_, init) => {
      calls++
      assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer secret')
      return new Promise<Response>(() => {})
    }
  })
  controller.abort()
  await assert.rejects(promise, /停止或超时/)
  assert.equal(calls, 1)
  setRagCredential('')
})
