import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  answerFromContactKnowledge,
  findResponsibleContacts,
  getResponsibility,
  LOCAL_SELF_ID,
  saveSelfResponsibility
} from '../src/services/contactKnowledge.ts'

const emptyStorage = { getItem: () => null }

test('responsibility routing handles distinct departments and varied phrasings', () => {
  const cases = [
    ['产品规划', '林知夏'],
    ['产品需求调研', '陈澄'],
    ['数据库访问关系', '周屿'],
    ['前端页面开发', '苏晴'],
    ['客户端性能优化', '罗凯'],
    ['服务端接口故障', '陈默'],
    ['平台部署', '高远'],
    ['质量保障', '裴宁'],
    ['设计规范', '顾言'],
    ['视觉设计', '唐可'],
    ['市场推广', '宋然'],
    ['客户问题协调', '陆瑶'],
    ['入职流程', '乔安'],
    ['产品上线运营', '魏然'],
    ['业务规则', '顾寻'],
    ['移动应用崩溃', '许岚'],
    ['自动化测试', '方宁'],
    ['数据仓库', '许知远'],
    ['BI 报表', '卫青'],
    ['网络安全', '韩策'],
    ['告警配置', '白河'],
    ['用户访谈', '何清'],
    ['客户投诉', '叶宁'],
    ['CRM 商机线索', '梁晨'],
    ['工资发放', '苏一'],
    ['设备采购', '郑言'],
    ['工位申请', '沈茉'],
    ['企业邮箱账号', '陆北'],
    ['员工报销', '阮明'],
    ['供应商付款', '宋禾'],
    ['合同条款', '季恬']
  ] as const
  for (const [topic, expected] of cases) {
    for (const question of [`${topic}找谁？`, `请问${topic}应该联系哪位同事？`, `${topic}由谁负责？`]) {
      assert.deepEqual(
        findResponsibleContacts(question, emptyStorage).map((contact) => contact.name),
        [expected],
        question
      )
    }
  }
})

test('unsupported or ambiguous duties do not create misleading contact cards', () => {
  const topics = [
    '医保定点医院变更',
    '个人所得税专项附加扣除',
    '停车位租赁',
    '食堂菜谱',
    '股票交易',
    '天气预报',
    '护照签证',
    '房屋贷款'
  ]
  for (const topic of topics) {
    for (const question of [`${topic}找谁审批？`, `${topic}由谁负责？`]) {
      assert.deepEqual(findResponsibleContacts(question, emptyStorage), [], question)
      assert.equal(answerFromContactKnowledge(question, emptyStorage), null, question)
    }
  }
})

test('unrelated domains paired with generic actions do not hijack recommendations', () => {
  const domains = [
    '食堂菜谱',
    '护照签证',
    '股票交易',
    '停车位租赁',
    '房屋贷款',
    '旅游景点',
    '快递包裹',
    '私家车保险',
    '个人住房贷款',
    '学校招生'
  ]
  const actions = ['审批', '账号开通', '权限申请', '系统访问', '流程处理', '问题协调']
  for (const domain of domains) {
    for (const action of actions) {
      const question = `${domain}${action}找谁？`
      assert.deepEqual(findResponsibleContacts(question, emptyStorage), [], question)
    }
  }
})

test('only strongly related colleagues get multiple cards', () => {
  assert.deepEqual(
    findResponsibleContacts('服务端接口开发和前端页面开发找谁？', emptyStorage).map((contact) => contact.name),
    ['陈默', '苏晴']
  )
  assert.deepEqual(
    findResponsibleContacts('客户端性能优化找谁？', emptyStorage).map((contact) => contact.name),
    ['罗凯']
  )
})

test('similar-sounding responsibilities route to their distinct owners', () => {
  const cases = [
    ['数据库访问关系应该找谁开通？', '周屿'],
    ['数据表权限找谁审批？', '周屿'],
    ['企业邮箱账号找谁开通？', '陆北'],
    ['办公电脑故障找谁处理？', '陆北'],
    ['数据仓库的数据同步找谁负责？', '许知远'],
    ['经营数据分析找谁负责？', '卫青'],
    ['网络安全漏洞扫描找谁负责？', '韩策'],
    ['线上故障告警找谁负责？', '白河'],
    ['员工报销找谁审批？', '阮明'],
    ['供应商付款找谁处理？', '宋禾'],
    ['合同审核找谁负责？', '季恬'],
    ['采购申请找谁审批？', '郑言'],
    ['办公工位申请找谁处理？', '沈茉'],
    ['工资条找谁负责？', '苏一'],
    ['客户投诉找谁处理？', '叶宁'],
    ['客户培训找谁负责？', '陆瑶'],
    ['移动端性能找谁负责？', '许岚'],
    ['桌面客户端性能找谁负责？', '罗凯'],
    ['自动化测试失败找谁处理？', '方宁'],
    ['发布前验收找谁负责？', '裴宁']
  ] as const
  for (const [question, expected] of cases) {
    assert.deepEqual(
      findResponsibleContacts(question, emptyStorage).map((contact) => contact.name),
      [expected],
      question
    )
  }
})

test('clear short duty names work without a longer descriptive phrase', () => {
  const cases = [
    ['报销', '阮明'],
    ['合同', '季恬'],
    ['采购', '郑言'],
    ['工资', '苏一'],
    ['工位', '沈茉'],
    ['门禁', '沈茉'],
    ['差旅', '沈茉'],
    ['社保', '苏一'],
    ['发票', '阮明'],
    ['付款', '宋禾'],
    ['收款', '宋禾'],
    ['招聘', '乔安'],
    ['投诉', '叶宁'],
    ['告警', '白河'],
    ['漏洞', '韩策']
  ] as const
  for (const [topic, expected] of cases) {
    assert.deepEqual(
      findResponsibleContacts(`${topic}审批找谁？`, emptyStorage).map((contact) => contact.name),
      [expected],
      topic
    )
  }
})

test('all directory members have a searchable, nonempty responsibility', () => {
  const contacts = new Set<string>()
  for (const topic of [
    '产品规划',
    '产品需求调研',
    '数据库访问关系',
    '前端页面开发',
    '客户端性能优化',
    '服务端接口故障',
    '平台部署',
    '质量保障',
    '设计规范',
    '视觉设计',
    '市场推广',
    '客户问题协调',
    '入职流程',
    '产品上线运营',
    '业务规则',
    '移动应用崩溃',
    '自动化测试',
    '数据仓库',
    'BI 报表',
    '网络安全',
    '告警配置',
    '用户访谈',
    '客户投诉',
    'CRM 商机线索',
    '工资发放',
    '设备采购',
    '工位申请',
    '企业邮箱账号',
    '员工报销',
    '供应商付款',
    '合同条款'
  ]) {
    const match = findResponsibleContacts(`${topic}找谁？`, emptyStorage)
    assert.equal(match.length, 1, topic)
    assert.ok(match[0].responsibility.length >= 20, topic)
    contacts.add(match[0].userId)
  }
  assert.equal(contacts.size, 31)
})

test('database access question recommends the responsible colleague with a contact card', () => {
  const storage = { getItem: () => null }
  const answer = answerFromContactKnowledge('数据库访问关系应该找谁开通？', storage)
  assert.equal(answer?.contacts?.[0].userId, 'local-colleague-zhou-yu')
  assert.match(answer?.contacts?.[0].responsibility || '', /数据库访问权限/)
  assert.equal(answer?.references[0].name, '周屿 · 工作职责')
  assert.equal(answerFromContactKnowledge('今天的天气怎么样？', storage), null)
})

test('my editable responsibility persists in the local contact knowledge module', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
  saveSelfResponsibility('负责合同权限审核和合同系统账号开通。', storage)
  assert.equal(getResponsibility(LOCAL_SELF_ID, storage), '负责合同权限审核和合同系统账号开通。')
  assert.equal(answerFromContactKnowledge('合同权限审核应该找谁？', storage)?.contacts?.[0].userId, LOCAL_SELF_ID)
  saveSelfResponsibility('负责蓝杉系统账号开通和蓝杉平台权限审批。', storage)
  assert.equal(answerFromContactKnowledge('蓝杉系统账号应该找谁开通？', storage)?.contacts?.[0].userId, LOCAL_SELF_ID)
  assert.throws(() => saveSelfResponsibility('a'.repeat(2001), storage), /2000/)
})
