import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { documents, answerQuestion } from './documents.mjs'

const chatId = 'em-demo-policy'
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
])

export function createDemoServer() {
  const sessions = new Map()
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    const origin = req.headers.origin
    if (origin && !/^https?:\/\/(?:tauri\.localhost|(?:127\.0\.0\.1|localhost)(?::\d+)?|\[::1\](?::\d+)?)$/.test(origin)) {
      return json(403, { code: 403, message: 'origin_not_allowed' })
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    try {
      if ((req.method === 'GET' || req.method === 'HEAD') && assets.has(path)) {
        const [file, type] = assets.get(path)
        res.setHeader('Content-Type', type)
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'")
        return res.end(req.method === 'HEAD' ? undefined : await readFile(new URL(file, import.meta.url)))
      }
      if (req.method === 'GET' && path === '/health') return json(200, { service: 'em-rag-demo', mode: 'demo', documents: documents.length })
      if (req.method === 'GET' && path === '/config') return json(200, { chatId, title: '制度知识助手 · 本地演示', mode: 'demo' })
      if (req.method === 'GET' && path === '/api/documents') return json(200, documents)
      if (req.method === 'POST' && path === `/ragflow-api/chats/${chatId}/sessions`) {
        await body()
        const now = Date.now()
        for (const [id, session] of sessions) if (now - session.updated > 2 * 60 * 60 * 1000) sessions.delete(id)
        if (sessions.size >= 200) sessions.delete(sessions.keys().next().value)
        const id = randomUUID()
        sessions.set(id, { updated: now })
        return json(200, { code: 0, data: { id } })
      }
      if (req.method === 'POST' && path === '/ragflow-api/chat/completions') {
        const input = await body()
        const question = input.messages?.filter(item => item.role === 'user').at(-1)?.content
        if (input.chat_id !== chatId || !sessions.has(input.session_id)) return json(400, { code: 400, message: '请新建演示对话后重试。' })
        if (typeof question !== 'string' || !question.trim() || question.length > 12000) return json(400, { code: 400, message: '请输入 1–12000 字的问题。' })
        const session = sessions.get(input.session_id)
        session.updated = Date.now()
        const started = performance.now()
        const result = answerQuestion(question.trim(), session)
        const data = {
          final: true, answer: result.answer, reference: { chunks: result.chunks },
          clarification: { mode: 'demo', cache_id: randomUUID(), options: result.questions.map((question, i) => ({ id: `followup-${i}`, question })) },
          diagnostics: { mode: 'demo', elapsed_ms: Math.max(1, Math.round(performance.now() - started)), model: 'none' }
        }
        if (input.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
          res.write(`data: ${JSON.stringify({ code: 0, data })}\n\n`)
          return res.end('data: [DONE]\n\n')
        }
        return json(200, { code: 0, data })
      }
      return json(404, { code: 404, message: '接口不存在。' })
    } catch (error) {
      if (!res.headersSent) json(error.status || 500, { code: error.status || 500, message: error.status ? error.message : '演示服务处理失败，请重试。' })
      else res.end()
    }
    function json(status, value) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(value))
    }
    async function body() {
      let size = 0
      const parts = []
      for await (const part of req) {
        size += part.length
        if (size > 64 * 1024) throw Object.assign(new Error('请求内容过大。'), { status: 413 })
        parts.push(part)
      }
      try { return JSON.parse(Buffer.concat(parts).toString() || '{}') }
      catch { throw Object.assign(new Error('请求格式不正确。'), { status: 400 }) }
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createDemoServer()
  const port = Number(process.env.RAG_DEMO_PORT || 8090)
  server.on('error', error => { console.error(`Demo service: ${error.message}`); process.exitCode = 1 })
  server.listen(port, '127.0.0.1', () => console.log(`EM knowledge demo ready: http://127.0.0.1:${port}/`))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
}
