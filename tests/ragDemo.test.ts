import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createDemoServer } from '../tools/rag-demo/server.mjs'
import { requestRag } from '../src/services/ragChat.ts'

const server = createDemoServer()
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
after(() => new Promise<void>(resolve => server.close(() => resolve())))
const port = (server.address() as { port: number }).port
const base = `http://127.0.0.1:${port}`
const storage = { getItem: () => JSON.stringify({ url: `${base}/` }) }
const ask = (question: string, previous?: Awaited<ReturnType<typeof requestRag>>) =>
  requestRag(question, new AbortController().signal, { storage, fetcher: fetch, previous })

test('serves the demo page, its assets and four explicitly fictional documents', async () => {
  assert.match(await (await fetch(base)).text(), /知识问答/)
  for (const file of ['/app.js', '/style.css']) assert.equal((await fetch(base + file)).status, 200)
  const health = await (await fetch(base + '/health')).json()
  assert.equal(health.service, 'em-rag-demo')
  const docs = await (await fetch(base + '/api/documents')).json()
  assert.equal(docs.length, 4)
  assert(docs.every((doc: { title: string }) => doc.title.includes('示例')))
})

test('existing EM RAG adapter consumes real HTTP/SSE answers and citations', async () => {
  const result = await ask('请假应该怎么申请？')
  assert.match(result.text, /提前 2 个工作日/)
  assert.match(result.text, /虚构/)
  assert(result.references.some(item => item.name === '员工请假指引（示例）'))
  assert(result.options.length > 0)
  const next = await ask('那病假呢？', result)
  assert.equal(next.sessionId, result.sessionId)
  assert.match(next.text, /就诊证明/)
})

test('follow-ups keep their topic and independent conversations do not share context', async () => {
  const first = await ask('出差怎么申请？')
  const followup = await ask('那需要哪些材料？', first)
  assert(followup.references.every(item => item.name === '出差管理办法（示例）'))
  const isolated = await ask('那需要哪些材料？')
  assert.equal(isolated.references.length, 0)
})

test('expense and remote queries find their own sources; absent answers stay explicit', async () => {
  assert.match((await ask('报销需要哪些材料？')).text, /付款凭证/)
  assert.match((await ask('远程办公怎么申请？')).text, /每周最多 2 天/)
  const missing = await ask('宇宙外面是什么？')
  assert.equal(missing.references.length, 0)
  assert.match(missing.text, /没有足够依据/)
})

test('missing sessions and malformed requests receive actionable errors', async () => {
  const response = await fetch(base + '/ragflow-api/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 'em-demo-policy', session_id: 'missing', messages: [{ role: 'user', content: '请假' }] })
  })
  assert.equal(response.status, 400)
  assert.match((await response.json()).message, /新建演示对话/)
  const malformed = await fetch(base + '/ragflow-api/chats/em-demo-policy/sessions', { method: 'POST', body: '{' })
  assert.equal(malformed.status, 400)
})
