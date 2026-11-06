import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyRagIntent } from '../src/services/ragIntent.ts'
import { findResponsibleContacts } from '../src/services/contactKnowledge.ts'
import { requestRoutedRag } from '../src/services/ragRouter.ts'
import { getLocalDirectoryProfiles } from '../src/services/localContacts.ts'
import type { RagResult } from '../src/services/ragChat.ts'

const storage = { getItem: () => null }
const signal = () => new AbortController().signal

test('selected policy follow-ups containing 由谁 keep their session and selection', async () => {
  const question = '国内出差和国际出差分别需要提前多久提交申请,以及不同预算金额由谁审批?'
  const previous: RagResult = {
    text: '请选择',
    baseUrl: 'https://policy.example',
    chatId: 'policy',
    sessionId: 'session-1',
    cacheId: 'cache-1',
    references: [],
    options: [{ id: 'option-1', question }]
  }
  const selection = { cache_id: 'cache-1', option_id: 'option-1' }
  const calls: unknown[] = []
  const policy = async (q: string, _signal: AbortSignal, options: unknown): Promise<RagResult> => {
    calls.push({ q, options })
    return { ...previous, text: '审批规定' }
  }
  const answer = await requestRoutedRag(question, signal(), { storage, previous, selection }, policy)
  assert.equal(answer.routing?.intent, 'policy')
  assert.equal(answer.sessionId, previous.sessionId)
  assert.deepEqual(calls, [{ q: question, options: { storage, previous, selection } }])
  const person = await requestRoutedRag('找人：产品经理', signal(), { storage, previous }, policy)
  assert.equal(person.routing?.intent, 'people')
  assert.equal(calls.length, 1)
  const stale = await requestRoutedRag(
    question,
    signal(),
    {
      storage,
      previous,
      selection: { ...selection, cache_id: 'stale' }
    },
    policy
  )
  assert.equal(stale.routing?.intent, 'people')
  assert.equal(calls.length, 1)
})

test('people, policy and incomplete questions take different routes', () => {
  const cases = {
    people: [
      '我要找产品经理',
      '帮我联系陈澄',
      '请找一位高级产品经理',
      '找产品负责人',
      '找产品 PM',
      '数据库访问关系应该找谁开通？',
      '数据库访问权限联系谁？',
      '谁负责员工报销？',
      '报销流程找谁？',
      '我想找负责制度修订的同事',
      '不查制度，找产品经理',
      '开通权限找谁？',
      '找报销制度的负责人'
    ],
    policy: [
      '产品需求管理制度',
      '帮我找一下产品需求管理制度',
      '报销怎么申请？',
      '数据库权限如何开通？',
      '开通数据库权限需要什么材料？',
      '报销额度是多少？',
      '制度规定谁审批报销？',
      '按制度谁负责审批？',
      '产品经理负责什么？',
      '不要找人，只查报销制度',
      '信息安全管理办法',
      '请假条件是什么？',
      '谁可以申请年假？'
    ],
    clarify: [
      '我要开通数据库权限',
      '产品经理',
      '报销',
      '财务',
      '报销制度是什么，找谁审批？',
      '我要找产品经理，了解需求管理制度'
    ]
  } as const
  for (const [expected, questions] of Object.entries(cases)) {
    for (const question of questions) assert.equal(classifyRagIntent(question).intent, expected, question)
  }
})

test('names, job titles, common role wording and department constraints match actual profiles', () => {
  const cases = [
    ['我要找产品经理', '陈澄'],
    ['请找一位高级产品经理', '陈澄'],
    ['找产品 PM', '陈澄'],
    ['帮我联系陈澄', '陈澄'],
    ['找产品负责人', '林知夏'],
    ['我想找前端开发', '苏晴'],
    ['帮我找后端开发', '陈默'],
    ['找产品中心的产品经理', '陈澄'],
    ['找薪酬专员', '苏一'],
    ['请给我产品经理的名片', '陈澄'],
    ['查看苏晴名片', '苏晴'],
    ['找人事', '乔安']
  ] as const
  for (const [question, expected] of cases) {
    const matches = findResponsibleContacts(question, storage)
    assert.deepEqual(
      matches.map((contact) => contact.name),
      [expected],
      question
    )
    assert.ok(matches[0].jobTitle)
    assert.ok(matches[0].matchReason)
  }
  for (const question of ['找财务组的产品经理', '找前端组的后端工程师', '找不存在的岗位', '找产品中心同事']) {
    assert.deepEqual(findResponsibleContacts(question, storage), [], question)
  }
  for (const question of ['产品经理负责什么', '数据库权限如何开通', '报销申请条件', '制度规定谁审批']) {
    assert.deepEqual(findResponsibleContacts(question, storage), [], question)
  }
})

test('routing keeps person misses local and sends policy questions only to the policy service', async () => {
  const requested: string[] = []
  const policy = async (question: string): Promise<RagResult> => {
    requested.push(question)
    return {
      text: '制度服务返回的答复',
      baseUrl: 'https://policy.example',
      chatId: 'policy',
      sessionId: 's',
      references: [],
      options: []
    }
  }
  const contact = await requestRoutedRag('我要找产品经理', signal(), { storage }, policy)
  assert.equal(contact.routing?.intent, 'people')
  assert.deepEqual(
    contact.contacts?.map((person) => person.name),
    ['陈澄']
  )
  const miss = await requestRoutedRag('我要找不存在的岗位', signal(), { storage }, policy)
  assert.equal(miss.routing?.intent, 'people')
  assert.equal(miss.needsInput, true)
  assert.equal(miss.contacts, undefined)
  assert.deepEqual(requested, [])
  const result = await requestRoutedRag('报销怎么申请？', signal(), { storage }, policy)
  assert.equal(result.routing?.intent, 'policy')
  assert.equal(result.text, '制度服务返回的答复')
  assert.deepEqual(requested, ['报销怎么申请？'])
})

test('clarification buttons preserve the question and do not send local history to the policy service', async () => {
  const policyCalls: unknown[] = []
  const policy = async (question: string, _signal: AbortSignal, options: unknown): Promise<RagResult> => {
    policyCalls.push({ question, options })
    return {
      text: '政策',
      baseUrl: 'https://policy.example',
      chatId: 'policy',
      sessionId: 's',
      references: [],
      options: []
    }
  }
  const choice = await requestRoutedRag('产品经理', signal(), { storage }, policy)
  assert.equal(choice.routing?.intent, 'clarify')
  assert.equal(choice.options.length, 2)
  assert.deepEqual(policyCalls, [])
  const people = await requestRoutedRag(choice.options[0].question, signal(), { storage, previous: choice }, policy)
  assert.deepEqual(
    people.contacts?.map((contact) => contact.name),
    ['陈澄']
  )
  const result = await requestRoutedRag('查制度', signal(), { storage, previous: choice }, policy)
  assert.equal(result.routing?.intent, 'policy')
  assert.deepEqual(policyCalls, [{ question: '产品经理', options: { storage } }])
  await requestRoutedRag('事假', signal(), { storage, previous: result }, policy)
  assert.equal(policyCalls.length, 2, 'short remote follow-ups must remain in the policy session')
  const mixed = await requestRoutedRag('报销制度是什么，找谁审批？', signal(), { storage }, policy)
  const owner = await requestRoutedRag(mixed.options[0].question, signal(), { storage, previous: mixed }, policy)
  assert.deepEqual(
    owner.contacts?.map((contact) => contact.name),
    ['阮明']
  )
})

test('routing validates empty mode selections and cancellation before any request', async () => {
  let calls = 0
  const policy = async (): Promise<RagResult> => {
    calls++
    throw new Error('unexpected request')
  }
  await assert.rejects(requestRoutedRag('查制度：', signal(), { storage }, policy), /补充/)
  await assert.rejects(requestRoutedRag('找产品经理', AbortSignal.abort(), { storage }, policy), /停止/)
  assert.equal(calls, 0)
})

test('every actual title and name can be looked up, while natural requests retain the business context', () => {
  const profiles = getLocalDirectoryProfiles()
  for (const person of profiles) {
    assert.deepEqual(
      findResponsibleContacts(`帮我联系${person.name}`, storage).map((match) => match.userId),
      [person.userId]
    )
    const expected = profiles
      .filter((candidate) => candidate.jobTitle === person.jobTitle)
      .map((candidate) => candidate.userId)
    assert.deepEqual(
      findResponsibleContacts(`我要找${person.jobTitle}`, storage).map((match) => match.userId),
      expected,
      person.jobTitle
    )
  }
  const cases = [
    ['帮我找个产品经理', '陈澄'],
    ['我有报销问题，应该联系谁？', '阮明'],
    ['我想申请一个企业邮箱，谁能帮我开通？', '陆北'],
    ['我要申请数据库的访问权限，找谁开通？', '周屿'],
    ['门禁卡找谁办？', '沈茉']
  ] as const
  for (const [question, expected] of cases) {
    assert.deepEqual(
      findResponsibleContacts(question, storage).map((contact) => contact.name),
      [expected],
      question
    )
  }
})
