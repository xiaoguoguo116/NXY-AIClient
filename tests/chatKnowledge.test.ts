import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { loadGroupHistory } from '../src/db/chatKnowledge.ts'
import {
  retrieveHistory,
  parseHistoryAnswer,
  historyPrompts,
  sameHistory,
  HISTORY_LIMIT,
  type HistoryMessage
} from '../src/services/chatKnowledge.ts'
import { historyContext, localChatHistory } from '../src/services/chatHistorySource.ts'

const message = (id: string, text: string, day = 1, quoteId?: string): HistoryMessage => ({
  id,
  text,
  author: '张工',
  createdAt: `2026-11-${String(day).padStart(2, '0')} 10:00:00`,
  quoteId
})

test('exact IP avoids prefix matches; quoted recovery crosses days and unrelated chatter', () => {
  const history = [message('wrong', '10.20.30.400 不通'), message('start', '10.20.30.40 不通')]
  for (let i = 0; i < 10; i++) history.push(message(`noise${i}`, '周会材料准备好了', 2))
  history.push(message('fix', '白名单已增加，请再试试', 3, 'start'))
  history.push(message('ok', '现在可以了', 5, 'fix'))
  const evidence = retrieveHistory('10.20.30.40 之前为什么不通？', history)
  assert.equal(evidence.find((item) => item.id === 'start')?.reason, 'match')
  assert.notEqual(evidence.find((item) => item.id === 'wrong')?.reason, 'match')
  assert.equal(evidence.find((item) => item.id === 'ok')?.reason, 'reply')
  assert.ok(evidence.findIndex((item) => item.id === 'ok') > evidence.findIndex((item) => item.id === 'start'))
  assert.deepEqual(retrieveHistory('10.20.30.4', history), [])
})

test('topic progress keeps original proposal, later reversal and quoted follow-up', () => {
  const history = [message('a', '订单接口新增状态字段，计划周五上线')]
  for (let i = 0; i < 30; i++) history.push(message(`b${i}`, '订单接口新增状态字段正在确认', 2))
  history.push(message('c', '订单接口改为下周上线', 4))
  history.push(message('d', '前端还未完成联调', 5, 'c'))
  const evidence = retrieveHistory('11月5日订单接口新增字段的进展如何？', history)
  assert.ok(evidence.some((item) => item.id === 'a'))
  assert.ok(evidence.some((item) => item.id === 'c'))
  assert.ok(evidence.some((item) => item.id === 'd'))
  const prompt = historyPrompts('进展如何', evidence, '2026-11-05')[0].content
  assert.match(prompt, /日期已过不代表计划已经完成/)
  assert.match(prompt, /相邻的“好了”若指代不明/)
})

test('an issue lookup includes later corrections in the same discussion without repeating its ID', () => {
  const history = [
    '今天确认接口联调安排。',
    '发现 TASK-42 重复创建订单，待修复。',
    'TASK-42 我负责，16:00 前提交。',
    '测试计划 17:30 前反馈回归结果。',
    '监控看板已配置。',
    '上线需要回归、监控、审批都完成。',
    '告警验证计划 18:00 前反馈。',
    '更正一下：提交时间调整为 16:30。',
    '验收数据联系人还没确定。',
    '请整理联调纪要。',
    '上线窗口尚未审批，不能认为今晚能发布。',
    '最终口径：修复16:30、回归17:30、验证18:00，上线待审批。'
  ].map((text, index) => ({
    ...message(`progress-${index}`, text),
    createdAt: `2026-11-05 10:${String(index).padStart(2, '0')}:00`
  }))
  history.push({ ...message('unrelated-later', '其他项目最终口径已确认'), createdAt: '2026-11-07 10:00:00' })
  const evidence = retrieveHistory('TASK-42 联调进展现在如何？', history)
  assert.equal(evidence.find((item) => item.id === 'progress-7')?.reason, 'context')
  assert.ok(evidence.some((item) => item.id === 'progress-11'))
  assert.ok(!evidence.some((item) => item.id === 'unrelated-later'))
})

test('no topic match stays empty; context is labeled and evidence is bounded', () => {
  assert.deepEqual(retrieveHistory('数据库备份进度', [message('a', '午饭吃什么')]), [])
  const history = Array.from({ length: 100 }, (_, i) => message(`a${i}`, `订单接口 ${'测试'.repeat(5000)}`))
  const evidence = retrieveHistory('订单接口', history)
  assert.ok(evidence.length <= 80)
  assert.ok(evidence.reduce((sum, item) => sum + item.text.length, 0) <= 48000)
  assert.ok(evidence.every((item) => item.truncated))
  assert.equal(new Set(evidence.map((item) => item.ref)).size, evidence.length)
})

test('answer rejects invented or missing citations, malformed structures and incomplete output', () => {
  const evidence = retrieveHistory('订单接口', [message('a', '订单接口后端已完成')])
  const good = { findings: [{ kind: '进展', text: '后端已完成', sources: ['S1'] }], unknowns: ['未找到前端完成确认'] }
  assert.deepEqual(parseHistoryAnswer(JSON.stringify(good), evidence), good)
  assert.deepEqual(parseHistoryAnswer('```json\n' + JSON.stringify(good) + '\n```', evidence), good)
  for (const sources of [[], ['S999'], [1], null]) {
    assert.throws(() =>
      parseHistoryAnswer(JSON.stringify({ ...good, findings: [{ ...good.findings[0], sources }] }), evidence)
    )
  }
  for (const raw of ['null', '{}', '{"findings":[', '{"findings":[],"unknowns":[]}', '{"findings":[],"unknowns":[1]}'])
    assert.throws(() => parseHistoryAnswer(raw, evidence))
})

test('local adapter excludes generated AI and summary requests and limits to current chat', () => {
  const human = {
    id: 'h',
    text: '订单接口后端完成',
    role: 'user' as const,
    status: 'done' as const,
    createdAt: '2026-11-05',
    senderId: 'zhang'
  }
  const snapshot = localChatHistory({
    id: 'group',
    name: '群',
    members: [{ id: 'zhang', name: '张工', color: '#333', kind: 'simulated' }],
    messages: [
      human,
      { ...human, id: 'ai', role: 'assistant' },
      { ...human, id: 'summary', summarySourceIds: ['h'] },
      { ...human, id: 'request', text: '@AI 汇总订单接口进展' },
      { ...human, id: 'failed', status: 'error' }
    ]
  })
  assert.deepEqual(
    snapshot.messages.map((item) => item.id),
    ['h']
  )
  assert.equal(snapshot.messages[0].author, '张工')
  assert.throws(() => historyContext(snapshot.messages, 'deleted'))
  assert.equal(sameHistory(snapshot, { ...snapshot, messages: [] }), false)
  assert.equal(sameHistory(snapshot, { ...snapshot, messages: [{ ...snapshot.messages[0], text: '已更正' }] }), false)
})

test('SQLite adapter enforces account/group scope and excludes deleted, robot, failed and non-text records', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`CREATE TABLE t_message (id TEXT, user_id TEXT, session_id TEXT, scene_type TEXT, deleted_at TEXT,
      msg_type TEXT, from_type TEXT, status TEXT, from_id TEXT, content TEXT, created_at TEXT, quote_msg_id TEXT)`)
    const insert = db.prepare('INSERT INTO t_message VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const row = (id: string, overrides: Record<string, unknown> = {}) => {
      const record = {
        id,
        user: 'u1',
        group: 'g1',
        scene: 'group',
        deleted: null,
        type: 'text',
        from: 'user',
        status: 'sent',
        author: 'author',
        content: '{"text":"订单接口完成"}',
        time: '2026-11-05 10:00:00',
        quote: null,
        ...overrides
      }
      insert.run(...(Object.values(record) as (string | null)[]))
    }
    row('valid')
    row('other-account', { user: 'u2' })
    row('other-group', { group: 'g2' })
    row('deleted', { deleted: '2026-11-05' })
    row('robot', { from: 'robot' })
    row('failed', { status: 'failed' })
    row('pending', { status: 'sending' })
    row('local-x')
    row('image', { type: 'image' })
    row('private', { scene: 'user' })
    row('corrupt', { content: 'not json' })
    row('assistant', { content: '{"text":"【制度知识助手】结论"}' })
    const adapter = {
      select: async <T>(sql: string, values?: unknown[]) => db.prepare(sql).all(...(values as string[])) as T
    }
    assert.deepEqual(
      (await loadGroupHistory('u1', 'g1', adapter)).messages.map((item) => item.id),
      ['valid']
    )
    await assert.rejects(loadGroupHistory('', 'g1', adapter))
    for (let i = 0; i < HISTORY_LIMIT; i++) row(`bulk-${i}`)
    const capped = await loadGroupHistory('u1', 'g1', adapter)
    assert.equal(capped.limited, true)
    assert.ok(capped.messages.length <= HISTORY_LIMIT)
  } finally {
    db.close()
  }
})
