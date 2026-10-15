import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_RAGFLOW, DEFAULT_MARKDOWN_AGENT, MARKDOWN_AGENT_KEY, loadMarkdownAgent, loadRagflowLinks, validateApplicationUrl } from '../src/services/localApplications.ts'
test('Markdown agent uses 8092 and independent persisted configuration', () => {
  assert.equal(DEFAULT_MARKDOWN_AGENT.url, 'http://127.0.0.1:8092/')
  assert.deepEqual(loadMarkdownAgent({ getItem: () => null }), DEFAULT_MARKDOWN_AGENT)
  assert.equal(loadMarkdownAgent({ getItem: key => {
    assert.equal(key, MARKDOWN_AGENT_KEY)
    return JSON.stringify({ url: 'http://localhost:8092' })
  } }).url, 'http://localhost:8092/')
  assert.throws(() => loadMarkdownAgent({ getItem: () => '{broken' }))
  assert.throws(() => loadMarkdownAgent({ getItem: () => '{"url":"javascript:alert(1)"}' }))
})
test('RAGFlow defaults to the confirmed frontend and restores configured URLs', () => {
  assert.equal(DEFAULT_RAGFLOW.url, 'http://127.0.0.1:8090/')
  assert.deepEqual(loadRagflowLinks({ getItem: () => null }), DEFAULT_RAGFLOW)
  assert.equal(
    loadRagflowLinks({ getItem: () => JSON.stringify({ url: 'http://localhost:8090' }) }).url,
    'http://localhost:8090/'
  )
})
test('application links reject executable schemes, credentials and query secrets', () => {
  for (const value of [
    'javascript:alert(1)',
    'file:///C:/test',
    'https://user:pass@host',
    'https://host/?token=secret',
    'not a url'
  ])
    assert.throws(() => validateApplicationUrl(value))
  assert.throws(() => loadRagflowLinks({ getItem: () => '{bad' }))
  assert.equal(validateApplicationUrl('https://ragflow.example/chat'), 'https://ragflow.example/chat')
})
