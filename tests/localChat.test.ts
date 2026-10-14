import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LocalMessage } from '../src/services/localChat.ts'
import {
  buildContext,
  loadChats,
  saveChats,
  mentionsAi,
  normalizeBaseUrl,
  requestAi,
  messageSender
} from '../src/services/localChat.ts'

test('demo migration keeps IDs and references, attributes authors and is idempotent', () => {
  const messages: LocalMessage[] = [
    { id: 'source', role: 'user', text: '【王工 · 模拟成员】明天验证索引', status: 'done', createdAt: '' },
    { id: 'q', role: 'user', text: '@AI 总结', status: 'done', createdAt: '', summarySourceIds: ['source'] }
  ]
  const raw = JSON.stringify({
    version: 1,
    selectedId: 'c',
    conversations: [{ id: 'c', name: '技术交流群（本地测试）', messages }]
  })
  const data = loadChats({ getItem: () => raw })
  const chat = data.conversations[0]
  assert.equal(chat.members?.length, 8)
  assert.equal(chat.messages[0].id, 'source')
  assert.equal(chat.messages[0].text, '明天验证索引')
  assert.equal(messageSender(chat, chat.messages[0]).name, '王工')
  assert.equal(messageSender(chat, chat.messages[1]).kind, 'self')
  assert(buildContext(chat, 'q', 12)[1].content.includes('"author":"王工"'))
  assert.deepEqual(loadChats({ getItem: () => JSON.stringify(data) }), data)
  const normal = loadChats({ getItem: () => raw.replace('技术交流群（本地测试）', '私人会话') })
  assert.equal(normal.conversations[0].messages[0].text, messages[0].text)
  assert.equal(normal.conversations[0].members, undefined)
  chat.messages[1].quoteId = 'source'
  assert(buildContext(chat, 'q', 12)[1].content.includes('"author":"王工"'))
  delete chat.messages[1].quoteId
  delete chat.messages[1].summarySourceIds
  assert.equal(buildContext(chat, 'q', 12)[1].content, '王工：明天验证索引')
})

test('quoted AI reply includes only the quoted message and persists its reference', () => {
  const messages: LocalMessage[] = [
    { id: 'source', role: 'user', text: '引用内容', status: 'done', createdAt: '' },
    { id: 'other', role: 'user', text: '不相关内容', status: 'done', createdAt: '' },
    { id: 'question', role: 'user', text: '@AI 解释', status: 'done', createdAt: '', quoteId: 'source' }
  ]
  const chat = { id: 'c', name: 'test', messages }
  const result = buildContext(chat, 'question', 30)
  assert.equal(result.length, 2)
  assert(JSON.stringify(result).includes('引用内容'))
  assert(!JSON.stringify(result).includes('不相关内容'))
  const restored = loadChats({ getItem: () => JSON.stringify({ version: 1, selectedId: 'c', conversations: [chat] }) })
  assert.deepEqual(buildContext(restored.conversations[0], 'question', 12), result)
  messages[2].quoteId = 'missing'
  assert.throws(() => buildContext(chat, 'question', 30), /找不到引用/)
})

test('selected summary excludes unselected context and retains scope on reload/retry', () => {
  const messages: LocalMessage[] = ['selected-first', 'private-unselected', 'selected-last'].map((text, i) => ({
    id: String(i),
    text,
    role: 'user',
    status: 'done',
    createdAt: '2026-10-14T01:00:00Z'
  }))
  messages.push({
    id: 'request',
    text: '@AI 总结',
    role: 'user',
    status: 'done',
    createdAt: '',
    summarySourceIds: ['2', '0']
  })
  const chat = { id: 'c', name: 'test', messages }
  const result = buildContext(chat, 'request', 30)
  assert.equal(result.length, 2)
  assert(!JSON.stringify(result).includes('private-unselected'))
  assert(result[1].content.indexOf('selected-first') < result[1].content.indexOf('selected-last'))
  const raw = JSON.stringify({ version: 1, selectedId: 'c', conversations: [chat] })
  assert.deepEqual(buildContext(loadChats({ getItem: () => raw }).conversations[0], 'request', 0), result)
  messages.push({ id: 'later', text: 'later-secret', role: 'user', status: 'done', createdAt: '' })
  assert.deepEqual(buildContext(chat, 'request', 30), result)
  messages[3].summarySourceIds = ['missing']
  assert.throws(() => buildContext(chat, 'request', 30), /找不到/)
})

test('local messages survive reload and interrupted requests are recoverable', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
  const data = loadChats(storage)
  const chat = data.conversations[0]
  chat.messages.push({
    id: 'u',
    role: 'user',
    text: '真实本地消息',
    createdAt: new Date().toISOString(),
    status: 'done'
  })
  chat.messages.push({
    id: 'a',
    role: 'assistant',
    text: '',
    createdAt: new Date().toISOString(),
    status: 'pending',
    replyTo: 'u'
  })
  saveChats(storage, data)
  const restored = loadChats(storage)
  assert.equal(restored.conversations[0].messages[0].text, '真实本地消息')
  assert.equal(restored.conversations[0].messages[1].status, 'error')
  assert.equal(restored.conversations[0].messages[1].replyTo, 'u')
  assert.throws(
    () =>
      saveChats(
        {
          setItem() {
            throw new Error('quota')
          }
        },
        data
      ),
    /quota/
  )
})
test('invalid data is not silently replaced', () => {
  assert.throws(() => loadChats({ getItem: () => '{broken' }))
  assert.throws(() => loadChats({ getItem: () => '{"version":2,"conversations":[]}' }))
})
test('@AI detection, URL validation and context stay bounded to the original request', () => {
  assert.equal(mentionsAi('@AI 你好'), true)
  assert.equal(mentionsAi('请 @ai：总结'), true)
  assert.equal(mentionsAi('user@ai.example.com'), false)
  assert.equal(normalizeBaseUrl('https://models.example/v1/chat/completions/'), 'https://models.example/v1')
  assert.throws(() => normalizeBaseUrl('http://models.example/v1'))
  const messages = [
    { id: '1', role: 'user' as const, text: '之前的问题', status: 'done' as const, createdAt: '' },
    { id: '2', role: 'assistant' as const, text: '之前的回答', status: 'done' as const, createdAt: '' },
    { id: '3', role: 'user' as const, text: '@AI 当前问题', status: 'done' as const, createdAt: '' },
    { id: '4', role: 'user' as const, text: '后来的消息', status: 'done' as const, createdAt: '' }
  ]
  const chat = { id: 'c', name: 'test', messages }
  assert.deepEqual(
    buildContext(chat, '3', 1)
      .map((m) => m.content)
      .slice(1),
    ['之前的回答', '当前问题']
  )
  assert.deepEqual(
    buildContext(chat, '3', 0)
      .map((m) => m.content)
      .slice(1),
    ['当前问题']
  )
})
test('compatible request uses only configured key and parses real response/error', async () => {
  const config = { baseUrl: 'https://models.example/v1', model: 'test-model', contextCount: 12 }
  const signal = new AbortController().signal
  const reply = await requestAi(config, 'test-key', [{ role: 'user', content: 'hi' }], signal, async (url, init) => {
    assert.equal(url, 'https://models.example/v1/chat/completions')
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-key')
    assert.equal(JSON.parse(init.body as string).model, 'test-model')
    assert.equal(init.signal, signal)
    return new Response(JSON.stringify({ choices: [{ message: { content: '真实回复' } }] }))
  })
  assert.equal(reply, '真实回复')
  await assert.rejects(
    requestAi(config, '', [], signal, async () => new Response('', { status: 401 })),
    /鉴权失败/
  )
  await assert.rejects(
    requestAi(config, '', [], signal, async () => new Response('{}')),
    /没有返回文字/
  )
})
