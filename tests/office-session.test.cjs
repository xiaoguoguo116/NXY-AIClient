// Exercise the actual Pinia session store with persistence/native APIs stubbed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const pinia = require('pinia')

function harness() {
  const saved = []
  const closed = []
  let releaseCancel
  const services = {
    cancelSession: () => new Promise((resolve) => { releaseCancel = resolve }),
    closeSession: async (...args) => { closed.push(args) },
    resolvePermission: async () => {}
  }
  const stubs = {
    pinia,
    '@/db/workAssistant': {
      saveWorkMessage: async (record) => { saved.push(record) },
      saveWorkStep: async () => {}
    },
    '@/services/i18n': { global: { t: (key) => key } },
    '@/services/workService': services,
    '@/stores/user/user': { useUserStore: () => ({ authInfo: {}, userInfo: {} }) },
    '@/utils/desktop/notification': { showNotification: async () => false }
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/stores/app/workSession.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: (name) => {
      assert(name in stubs, `Unexpected dependency: ${name}`)
      return stubs[name]
    }, crypto: require('node:crypto').webcrypto, Date
  })
  pinia.setActivePinia(pinia.createPinia())
  const store = module.exports.useWorkSessionStore()
  store.setSessionId('session', 'office', 'conversation')
  store.startRun({
    conversationId: 'conversation', runId: 'run',
    userMessage: { id: 'user', role: 'user', content: 'process file', runId: 'run', attachments: [], createdAt: '' },
    assistantMessage: { id: 'assistant', role: 'assistant', content: '', runId: 'run', attachments: [], streaming: true, createdAt: '' },
    startingStep: { id: 'start', runId: 'run', status: 'in_progress' }
  })
  return { store, saved, closed, release: () => releaseCancel() }
}

const artifact = {
  runtimeId: 'office', sessionId: 'session', kind: 'session_update',
  payload: { sessionUpdate: 'artifact', path: 'C:/result.xlsx', name: 'result.xlsx', category: 'spreadsheet', size: 100 }
}

test('output artifacts survive persistence even without assistant text; duplicates and unrelated events are ignored', async () => {
  const { store, saved } = harness()
  store.handleEvent({ ...artifact, runtimeId: 'reasonix' })
  store.handleEvent({ ...artifact, sessionId: 'old-session' })
  assert.equal(store.liveMessages[1].attachments.length, 0)
  store.handleEvent(artifact)
  store.handleEvent(artifact)
  assert.equal(store.liveMessages[1].attachments.length, 1)
  await store.persistAssistant()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].attachments[0].messageId, 'assistant')
  assert.equal(saved[0].attachments[0].path, 'C:/result.xlsx')
})

test('cancel invalidates completion immediately, ignores late output and closes the bound runtime', async () => {
  const { store, closed, release } = harness()
  const pending = store.cancelRun('reasonix')
  assert.equal(store.currentRunId, '')
  store.handleEvent(artifact)
  assert.equal(store.liveMessages[1].attachments.length, 0)
  release()
  await pending
  assert.deepEqual(closed, [['office', 'session']])
  assert.equal(store.busy, false)
  assert.equal(store.sessionId, '')
  assert.equal(store.liveSteps[0].status, 'cancelled')
})

test('permission refusal is recorded as cancelled and pending UI is cleared at run end', async () => {
  const { store } = harness()
  store.handleEvent({
    runtimeId: 'office', sessionId: 'session', kind: 'permission_request', requestId: 'permission',
    payload: { toolCall: { title: 'Write result' }, options: [{ optionId: 'reject_once', kind: 'reject_once', name: 'Reject' }] }
  })
  await store.resolvePermission('reasonix', 'reject_once')
  assert.equal(store.liveSteps.find((step) => step.kind === 'approval').status, 'cancelled')
  store.clearRunFlags()
  assert.equal(store.permissionRequest, null)
  assert.equal(store.permissionQueue.length, 0)
})
