import assert from 'node:assert/strict'
import { requestRag } from '../../src/services/ragChat.ts'

const diagnostics = []
const transport = {
  storage: { getItem: () => JSON.stringify({ url: 'http://127.0.0.1:8090/' }) },
  fetcher: async (url, init) => {
    const response = await fetch(url, init)
    if (!url.endsWith('/completions')) return response
    const raw = await response.text()
    for (const line of raw.split('\n').filter((line) => line.startsWith('data:'))) {
      let data
      try { data = JSON.parse(line.slice(5)).data } catch { continue }
      if (!data?.final) continue
      const d = data.diagnostics || {}
      diagnostics.push(d)
      console.log(JSON.stringify({
        preprocessing: d.preprocessing, queries: d.queries,
        decision: d.clarification_decision,
        documents: [...new Set((d.retrieved_chunks || []).map((c) => c.docnm_kwd || c.doc_name))],
        clarification: data.clarification
      }, null, 2))
    }
    return new Response(raw, { status: response.status, headers: response.headers })
  }
}
const question = process.argv[2] || '加值班'
const result = await requestRag(question, new AbortController().signal, transport)
console.log('RESULT', JSON.stringify(result, null, 2))
if (question === '加值班') {
  assert.ok(result.options.some((o) => o.question.includes('加班')), 'Missing overtime option')
  assert.ok(result.options.some((o) => o.question.includes('值班')), 'Missing duty option')
  assert.ok(result.cacheId, 'Missing cached evidence')
  for (const topic of ['加班', '值班']) {
    const option = result.options.find((o) => o.question.includes(topic))
    const answer = await requestRag(option.question, new AbortController().signal, {
      ...transport, previous: result,
      selection: { cache_id: result.cacheId, option_id: option.id }
    })
    console.log('SELECTED', topic, JSON.stringify(answer, null, 2))
    assert.ok(answer.text.trim(), `Empty ${topic} answer`)
    assert.equal(answer.options.length, 0, `Repeated clarification for ${topic}`)
    assert.ok(answer.references.length > 0, `Missing ${topic} citations`)
  }
}
