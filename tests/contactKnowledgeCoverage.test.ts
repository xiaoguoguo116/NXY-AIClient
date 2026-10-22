import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  answerFromContactKnowledge,
  findResponsibleContacts,
  getResponsibility
} from '../src/services/contactKnowledge.ts'
import { getLocalFriendList } from '../src/services/localContacts.ts'

const storage = { getItem: () => null }

const duties = [
  ['林知夏', '产品路线图|产品规划|需求优先级|版本范围|产品方案评审'],
  ['陈澄', '产品需求调研|用户故事|需求文档|功能验收'],
  ['周屿', '研发技术架构|数据库访问权限|数据库账号|数据表权限|数据库访问关系'],
  ['苏晴', '网页前端页面开发|交互实现|浏览器兼容性|前端页面故障排查'],
  ['罗凯', '桌面客户端应用开发|桌面端安装升级|客户端性能优化|桌面客户端故障'],
  ['陈默', '服务端接口 API 开发|后端服务|接口故障|服务端业务逻辑排查'],
  ['高远', '平台部署|自动化发布|生产环境配置|版本上线|系统运维'],
  ['裴宁', '测试计划|功能测试|质量保障|缺陷验证|发布前验收'],
  ['顾言', '设计规范|设计系统|产品视觉体验|跨页面体验一致性'],
  ['唐可', '界面视觉设计|图标|插画|宣传视觉素材|设计资源制作'],
  ['宋然', '市场推广|品牌传播|市场活动|对外合作伙伴关系'],
  ['陆瑶', '客户成功|客户问题协调|客户培训|客户使用指导|客户续用跟进'],
  ['乔安', '人事管理|招聘|员工入职离职流程|组织信息维护|团队支持'],
  ['魏然', '产品上线运营|功能推广|产品使用率|活跃度跟踪|运营公告|运营活动'],
  ['顾寻', '业务需求分析|跨部门业务流程梳理|业务规则|验收标准定义'],
  ['许岚', 'iOS 移动端应用开发|Android 移动端应用开发|手机端兼容性|移动应用崩溃|移动端性能'],
  ['方宁', '自动化测试|回归测试脚本|持续集成质量门禁|自动化测试失败排查'],
  ['许知远', '数据仓库|ETL 数据同步|数据管道|数据质量|历史数据回填'],
  ['卫青', 'BI 报表|业务指标口径|经营数据分析|统计看板|数据报表需求'],
  ['韩策', '信息安全|网络安全|安全审查|漏洞扫描|安全风险评估|安全事件处置'],
  ['白河', '服务监控|告警配置|值班响应|线上故障应急|站点可靠性'],
  ['何清', '用户研究|用户访谈|可用性测试|体验反馈收集|研究结论整理'],
  ['叶宁', '客户投诉|客服工单|客户反馈受理|服务升级|投诉处理进度跟踪'],
  ['梁晨', '销售运营|CRM 商机线索|报价流程|售前支持|销售数据管理'],
  ['苏一', '工资发放|薪酬核算|社保公积金|员工福利|工资条问题'],
  ['郑言', '设备采购|供应商选择|采购申请|采购订单|采购审批流程'],
  ['沈茉', '办公工位申请|门禁卡|办公用品|差旅预订|日常行政后勤'],
  ['陆北', '办公电脑故障|笔记本故障|内部 IT 支持|企业邮箱账号|办公软件|内部账号开通'],
  ['阮明', '员工报销|费用审核|发票报销|费用归集|财务报销流程'],
  ['宋禾', '供应商付款|客户收款|结算对账|付款计划|应收应付账款'],
  ['季恬', '合同审核|合同条款|法律咨询|合规审查|法律风险评估']
] as const

test('every colleague has a responsibility and every listed duty returns the intended card', () => {
  const friends = getLocalFriendList()
  const failures: string[] = []
  assert.equal(friends.length, duties.length)
  for (const [name, topicList] of duties) {
    const friend = friends.find((contact) => contact.username === name)
    assert.ok(friend, name)
    assert.ok(getResponsibility(friend.peerId, storage).length >= 20, name)
    for (const topic of topicList.split('|')) {
      for (const question of [`${topic}找谁？`, `请问${topic}应该联系哪位同事？`, `${topic}由谁负责？`]) {
        const names = findResponsibleContacts(question, storage).map((contact) => contact.name)
        if (names.length !== 1 || names[0] !== name)
          failures.push(`${question}: expected ${name}, got ${names.join('、') || '无'}`)
        const cardNames = answerFromContactKnowledge(question, storage)?.contacts?.map((contact) => contact.name) ?? []
        if (cardNames.join('|') !== names.join('|')) failures.push(`${question}: card mismatch`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('each department has at least one resolvable contact', () => {
  const names = new Set(duties.map(([name]) => name))
  assert.equal(names.size, 31)
  for (const contact of getLocalFriendList()) assert.ok(names.has(contact.username), contact.username)
})

test('two clearly named duties retain both owners across the directory', () => {
  const samples = duties.map(([name, topicList]) => [name, topicList.split('|')[0]] as const)
  const failures: string[] = []
  for (let left = 0; left < samples.length; left++) {
    for (let right = left + 1; right < samples.length; right++) {
      const [firstName, firstTopic] = samples[left]
      const [secondName, secondTopic] = samples[right]
      const question = `${firstTopic}和${secondTopic}找谁？`
      const names = findResponsibleContacts(question, storage).map((contact) => contact.name)
      if (names.length !== 2 || !names.includes(firstName) || !names.includes(secondName)) {
        failures.push(`${question}: got ${names.join('、') || '无'}`)
      }
    }
  }
  assert.deepEqual(failures.slice(0, 30), [], `${failures.length} of 465 pairs failed`)
})

test('overlapping vocabulary respects the qualifying context', () => {
  const cases = [
    ['质量门禁', '方宁'],
    ['门禁卡', '沈茉'],
    ['产品使用率', '魏然'],
    ['客户使用指导', '陆瑶'],
    ['安全风险评估', '韩策'],
    ['法律风险评估', '季恬'],
    ['数据库账号', '周屿'],
    ['企业邮箱账号', '陆北'],
    ['服务端接口故障', '陈默'],
    ['线上故障应急', '白河'],
    ['供应商选择', '郑言'],
    ['供应商付款', '宋禾']
  ] as const
  for (const [topic, expected] of cases) {
    assert.deepEqual(
      findResponsibleContacts(`${topic}找谁？`, storage).map((contact) => contact.name),
      [expected],
      topic
    )
  }
})
