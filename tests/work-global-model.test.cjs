const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const pinia = require('pinia')

function harness() {
  const data = new Map()
  const localStorage = { getItem: key => data.get(key) ?? null }
  const modules = { pinia, './ragChat.ts': { ragQuestion: () => null } }
  const load = (name, file) => {
    const module = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    vm.runInNewContext(code, { module, exports: module.exports, localStorage, URL, TextEncoder,
      crypto: require('node:crypto').webcrypto,
      require: name => { assert(name in modules, name); return modules[name] }
    })
    modules[name] = module.exports
    return module.exports
  }
  const global = load('@/services/localChat', 'src/services/localChat.ts')
  const helper = load('@/services/workGlobalModel', 'src/services/workGlobalModel.ts')
  modules['@/services/workService'] = {}
  const stores = load('store', 'src/stores/app/workAssistant.ts')
  pinia.setActivePinia(pinia.createPinia())
  const store = stores.useWorkAssistantStore()
  const set = (baseUrl, model, key = '') => {
    data.set(global.CONFIG_KEY, JSON.stringify({ baseUrl, model, contextCount: 12 }))
    data.set(global.API_KEY_KEY, key)
  }
  return { data, global, helper, store, set }
}

test('task model follows actual global settings; key changes invalidate session signature', async () => {
  const { helper, set } = harness()
  set('http://127.0.0.1:1234/v1/chat/completions', ' first ', ' key-a ')
  const first = helper.readWorkGlobalModel()
  assert.equal(first.baseUrl, 'http://127.0.0.1:1234/v1')
  assert.equal(first.model, 'first')
  assert.equal(first.apiKey, 'key-a')
  const digest = await helper.workModelSignature(first)
  set('http://127.0.0.1:1234/v1', 'first', 'key-b')
  assert.notEqual(await helper.workModelSignature(helper.readWorkGlobalModel()), digest)
  set('http://127.0.0.1:1234/v1', 'second', '')
  assert.equal(helper.readWorkGlobalModel().apiKey, '')
  assert.equal(helper.readWorkGlobalModel().model, 'second')
})

test('invalid/deleted global settings clear old providers and never expose API keys in store state', () => {
  const { store, set, data, global, helper } = harness()
  store.status = { runtime: { id: 'office' } }
  store.activeRuntimeId = 'reasonix'
  store.providers = [{ id: 'old-provider' }]
  set('https://model.example/v1', 'current', 'secret-not-for-state')
  store.refreshGlobalModel()
  assert.equal(store.activeRuntimeId, 'office')
  assert.equal(store.status.model, 'current')
  assert(!JSON.stringify(store.$state).includes('secret-not-for-state'))
  data.delete(global.CONFIG_KEY)
  store.refreshGlobalModel()
  assert.equal(store.providers.length, 0)
  assert.equal(store.status.model, undefined)
  assert.throws(() => helper.readWorkGlobalModel(), /WORK_PROVIDER_NOT_CONFIGURED/)
  set('http://external.example/v1', 'model', 'secret')
  assert.throws(() => helper.readWorkGlobalModel(), /WORK_PROVIDER_NOT_CONFIGURED/)
})

test('DeepSeek missing key produces actionable global-model setup error', () => {
  const { set, helper } = harness()
  set('https://api.deepseek.com/v1', 'configured-model')
  assert.throws(() => helper.readWorkGlobalModel(), /WORK_PROVIDER_KEY_REQUIRED/)
})
