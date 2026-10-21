const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const backup = 'C:/Users/94719/AppData/Local/chat.linyu/backups/formal-consolidation-20261020-162239'
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  if (!page) throw Error('Formal home window not found')
  const snapshots = {}
  try {
    await page.route('**/__em_migration__.html', route => route.fulfill({
      contentType: 'text/html', body: '<html><body>正在安全合并本地数据，请稍候。</body></html>'
    }))
    for (const [name, origin] of [['development', 'http://localhost:1420'], ['formal', 'http://tauri.localhost']]) {
      await page.goto(origin + '/__em_migration__.html')
      const snapshot = await page.evaluate(async () => {
        const storage = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))
        const databases = []
        for (const info of await indexedDB.databases()) {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(info.name)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(Error('Cannot inspect database'))
          })
          const stores = []
          for (const name of db.objectStoreNames) {
            const store = db.transaction(name).objectStore(name)
            const count = await new Promise((resolve, reject) => {
              const request = store.count()
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(Error('Cannot count records'))
            })
            stores.push({ name, count, keyPath: store.keyPath, autoIncrement: store.autoIncrement })
          }
          databases.push({ name: info.name, version: info.version, stores })
          db.close()
        }
        return { storage, databases }
      })
      snapshots[name] = snapshot
      fs.writeFileSync(`${backup}/${name}-origin.json`, JSON.stringify(snapshot), { mode: 0o600 })
      const chat = JSON.parse(snapshot.storage['em.local-chat.v1'] || '{}')
      console.log(JSON.stringify({ origin, keys: Object.keys(snapshot.storage),
        chats: chat.conversations?.map(c => ({ id: c.id, name: c.name, messages: c.messages.length })),
        databases: snapshot.databases }, null, 2))
    }
    const keys = Object.keys(snapshots.development.storage)
    console.log('DIFFERING KEYS', JSON.stringify(keys.filter(k => snapshots.formal.storage[k] !== snapshots.development.storage[k])))
  } finally {
    await page.goto('http://tauri.localhost/home/message')
    await browser.close()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
