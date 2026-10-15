import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishedTodos, parseTodoCommand, parseAssignedCommand, resolveRecipients, parseTodoSuggestions, isDue, loadTodos, validDraft, TODOS_KEY } from '../src/services/localTodos.ts'
test('publisher sees independent recipient progress, legacy assignments and separate same-title tasks', () => {
  const base = { title:'报告',createdAt:'2026-10-15T00:00:00Z',completed:false,groupId:'g',assignmentKey:'a' }
  const items = [{...base,id:'1',assigneeId:'one',completed:true}, {...base,id:'2',assigneeId:'two'}, {...base,id:'3',assigneeId:'self',assignmentKey:'personal'}, {...base,id:'4',assigneeId:'two',publisherId:'someone-else',assignmentKey:'other'}, {...base,id:'5',assigneeId:'two',assignmentKey:'new'}]
  const groups = publishedTodos(items)
  assert.equal(groups.length,2)
  assert.equal(groups[0].completed,1)
  assert.equal(groups[0].total,2)
  assert.equal(publishedTodos(items.map(t=>({...t,completed:true})))[0].completed,2)
})
test('local assignment defaults to self, supports selected and all, rejects unknown names and excludes AI', () => {
  const members = [{id:'self',name:'我',kind:'self' as const},{id:'a',name:'张三',kind:'simulated' as const},{id:'b',name:'李四',kind:'simulated' as const},{id:'ai',name:'AI 助手',kind:'ai' as const}]
  assert.deepEqual(parseAssignedCommand('@AI 把报告加入待办',members)?.recipients.map(m=>m.id), ['self'])
  assert.deepEqual(parseAssignedCommand('@AI @张三 @李四 把报告加入待办',members)?.recipients.map(m=>m.id), ['a','b'])
  assert.deepEqual(parseAssignedCommand('@AI 把报告加入待办 @张三 @李四',members)?.recipients.map(m=>m.id), ['a','b'])
  assert.deepEqual(parseAssignedCommand('@AI @全体成员 把报告加入待办',members)?.recipients.map(m=>m.id), ['self','a','b'])
  assert.throws(()=>parseAssignedCommand('@AI @不存在 把报告加入待办',members), /无法唯一找到/)
  assert.throws(()=>resolveRecipients(members,['removed']), /已不在群内/)
  assert.equal(isDue({id:'x',title:'x',createdAt:new Date().toISOString(),completed:false,dueAt:'2020-01-01T00:00:00Z',assigneeId:'a'}),false)
})
test('explicit command creates a draft with local relative time; negatives and summaries do not', () => {
  const now = new Date(2026, 9, 15, 10)
  const result = parseTodoCommand('@AI 把明天下午3点提交报告添加到待办事项中', now)!
  assert.equal(result.title, '明天下午3点提交报告')
  const due = new Date(result.dueAt!)
  assert.equal(due.getDate(), 16)
  assert.equal(due.getHours(), 15)
  for (const text of ['把提交报告加入待办', '@AI 不要把提交报告加入待办', '@AI 总结待办事项', '@AI 如果我说把提交报告加入待办']) assert.equal(parseTodoCommand(text, now), null)
  assert.equal(parseTodoCommand('@AI 添加待办：核对接口文档', now)?.dueAt, undefined)
  assert.equal(parseTodoCommand('@ai将提交报告添加到待办事项', now)?.title, '提交报告')
  assert.equal(parseTodoCommand('@AI 把今天上午9点提交报告加入待办', now)?.dueAt, undefined)
})
test('summary candidates are bounded, deduplicated and strip metadata only when valid', () => {
  const result = parseTodoSuggestions('总结内容\n```em-todos\n[{"title":"李工：更新接口","dueAt":null},{"title":"李工：更新接口"},{"title":"","dueAt":"bad"}]\n```')
  assert.equal(result.text, '总结内容')
  assert.deepEqual(result.suggestions, [{ title: '李工：更新接口' }])
  const invalid = '回复\n```em-todos\n{broken}\n```'
  assert.equal(parseTodoSuggestions(invalid).text, invalid)
  assert.equal(parseTodoSuggestions('无待办事项').suggestions.length, 0)
})
test('reminders exclude completed and previously reminded items; overdue catchup works', () => {
  const todo = { id:'1', title:'报告', createdAt:'2026-10-15T00:00:00Z', completed:false, dueAt:'2026-10-15T01:00:00Z' }
  const now = Date.parse('2026-10-15T02:00:00Z')
  assert.equal(isDue(todo, now), true)
  assert.equal(isDue({...todo, completed:true}, now), false)
  assert.equal(isDue({...todo, remindedAt:'2026-10-15T01:00:00Z'}, now), false)
  assert.equal(isDue({...todo, dueAt:undefined}, now), false)
  assert.equal(isDue({...todo, dueAt:'2026-10-16T01:00:00Z'}, now), false)
})
test('storage validation preserves invalid data, valid records survive serialization', () => {
  const items = [{id:'1',title:'测试',createdAt:new Date().toISOString(),completed:false,sourceKey:'message:0'}]
  assert.deepEqual(loadTodos({getItem:key => {assert.equal(key,TODOS_KEY);return JSON.stringify({version:1,items})}}),items)
  assert.throws(() => loadTodos({getItem:()=>'{broken'}))
  assert.throws(() => loadTodos({getItem:()=>JSON.stringify({version:1,items:[...items,...items]})}))
  assert.throws(() => validDraft({title:'',dueAt:'invalid'}))
})
