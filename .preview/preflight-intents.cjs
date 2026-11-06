const { storageForOrigin } = require('./inspect-local-ai-storage.cjs')
const storage = storageForOrigin('http://tauri.localhost')
const chats = JSON.parse(storage['em.local-chat.v1'])
const pending = chats.conversations.flatMap(c => c.messages).filter(m => m.status === 'pending').length
console.log(JSON.stringify({ pendingRequests: pending, conversations: chats.conversations.length }))
if (pending) process.exitCode = 1
