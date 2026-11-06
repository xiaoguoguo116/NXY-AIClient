const {storageForOrigin}=require('./inspect-local-ai-storage.cjs')
const s=storageForOrigin('http://tauri.localhost')
const todos=JSON.parse(s['em.local-todos.v1']||'{"items":[]}').items
const chats=JSON.parse(s['em.local-chat.v1']||'{"conversations":[]}').conversations
const match=t=>t?.includes('整理三处差异')
console.log(JSON.stringify({
  matchingTodos:todos.filter(t=>match(t.title)).map(t=>({id:t.id,title:t.title,assigneeId:t.assigneeId,assigneeName:t.assigneeName,completed:t.completed,dueAt:t.dueAt,assignmentKey:t.assignmentKey})),
  matchingDrafts:chats.flatMap(c=>c.messages.flatMap(m=>(m.actionDrafts||[]).filter(a=>match(a.title)).map(a=>({chat:c.name,id:a.id,status:a.status,participantIds:a.participantIds,resultIds:a.resultIds})))),
  pendingRequests:chats.flatMap(c=>c.messages).filter(m=>m.status==='pending').length
},null,2))
