import { getLocalFriendList } from './localContacts.ts'
import type { RagResult } from './ragChat.ts'

export const LOCAL_SELF_ID = 'local-directory-self'
export const CONTACT_KNOWLEDGE_KEY = 'em.contact-responsibilities.v1'

const defaultResponsibilities: Record<string, string> = {
  'local-colleague-lin-zhixia':
    '负责产品路线图、产品规划、需求优先级、版本范围和产品方案评审；跨产品线的取舍与排期由我协调。',
  'local-colleague-chen-cheng':
    '负责产品需求调研、用户故事、需求文档 PRD 和功能验收；新功能要做什么、如何描述需求可以找我。',
  'local-colleague-zhou-yu': '负责研发技术架构和数据库访问权限审批；数据库账号、数据表权限、数据库访问关系开通请找我。',
  'local-colleague-su-qing': '负责网页前端页面开发、交互实现、浏览器兼容性和前端页面故障排查。',
  'local-colleague-luo-kai': '负责桌面客户端应用开发、桌面端安装升级、客户端性能优化和桌面客户端故障。',
  'local-colleague-chen-mo': '负责服务端接口 API 开发、后端服务、接口故障和服务端业务逻辑排查。',
  'local-colleague-gao-yuan': '负责平台部署、自动化发布、生产环境配置、版本上线和系统运维。',
  'local-colleague-pei-ning': '负责测试计划、功能测试、质量保障、缺陷验证和发布前验收。',
  'local-colleague-gu-yan': '负责设计规范、设计系统、产品视觉体验和跨页面体验一致性。',
  'local-colleague-tang-ke': '负责界面视觉设计、图标、插画、宣传视觉素材和设计资源制作。',
  'local-colleague-song-ran': '负责市场推广、品牌传播、市场活动和对外合作伙伴关系。',
  'local-colleague-lu-yao': '负责客户成功、客户问题协调、客户培训、客户使用指导和客户续用跟进。',
  'local-colleague-qiao-an': '负责人事管理、招聘、员工入职离职流程、组织信息维护和团队支持。',
  'local-colleague-wei-ran': '负责产品上线运营、功能推广、产品使用率和活跃度跟踪、运营公告与运营活动。',
  'local-colleague-gu-xun': '负责业务需求分析、跨部门业务流程梳理、业务规则和验收标准定义。',
  'local-colleague-xu-lan': '负责 iOS 和 Android 移动端应用开发、手机端兼容性、移动应用崩溃和移动端性能。',
  'local-colleague-fang-ning': '负责自动化测试、回归测试脚本、持续集成质量门禁和自动化测试失败排查。',
  'local-colleague-xu-zhiyuan': '负责数据仓库、ETL 数据同步、数据管道、数据质量与历史数据回填。',
  'local-colleague-wei-qing': '负责 BI 报表、业务指标口径、经营数据分析、统计看板和数据报表需求。',
  'local-colleague-han-ce': '负责信息安全、网络安全、安全审查、漏洞扫描、安全风险评估和安全事件处置。',
  'local-colleague-bai-he': '负责服务监控、告警配置、值班响应、线上故障应急和站点可靠性。',
  'local-colleague-he-qing': '负责用户研究、用户访谈、可用性测试、体验反馈收集和研究结论整理。',
  'local-colleague-ye-ning': '负责客户投诉、客服工单、客户反馈受理、服务升级和投诉处理进度跟踪。',
  'local-colleague-liang-chen': '负责销售运营、CRM 商机线索、报价流程、售前支持和销售数据管理。',
  'local-colleague-su-yi': '负责工资发放、薪酬核算、社保公积金、员工福利和工资条问题。',
  'local-colleague-zheng-yan': '负责设备采购、供应商选择、采购申请、采购订单和采购审批流程。',
  'local-colleague-shen-mo': '负责办公工位申请、门禁卡、办公用品、差旅预订和日常行政后勤。',
  'local-colleague-lu-bei': '负责办公电脑与笔记本故障、内部 IT 支持、企业邮箱账号、办公软件和内部账号开通。',
  'local-colleague-ruan-ming': '负责员工报销、费用审核、发票报销、费用归集和财务报销流程。',
  'local-colleague-song-he': '负责供应商付款、客户收款、结算对账、付款计划和应收应付账款。',
  'local-colleague-ji-tian': '负责合同审核、合同条款、法律咨询、合规审查和法律风险评估。'
}

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'getItem' | 'setItem'>

function savedResponsibilities(storage: Reader): Record<string, string> {
  try {
    const value = JSON.parse(storage.getItem(CONTACT_KNOWLEDGE_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(([id, text]) => id === LOCAL_SELF_ID && typeof text === 'string')
    ) as Record<string, string>
  } catch {
    return {}
  }
}

export function getResponsibility(userId: string, storage: Reader = localStorage): string {
  return savedResponsibilities(storage)[userId] ?? defaultResponsibilities[userId] ?? ''
}

export function saveSelfResponsibility(text: string, storage: Writer = localStorage): string {
  const value = text.trim()
  if (value.length > 2000) throw new Error('工作职责不能超过 2000 字。')
  storage.setItem(CONTACT_KNOWLEDGE_KEY, JSON.stringify({ ...savedResponsibilities(storage), [LOCAL_SELF_ID]: value }))
  return value
}

const stopWords = new Set([
  '应该',
  '什么',
  '怎么',
  '哪里',
  '哪个',
  '哪位',
  '需要',
  '可以',
  '一下',
  '联系',
  '负责',
  '找谁',
  '审批',
  '审核',
  '账号',
  '问题',
  '开通',
  '申请',
  '权限',
  '关系'
])

const topicStopWords = new Set([
  '请问',
  '应该',
  '联系',
  '同事',
  '哪位',
  '由谁',
  '找谁',
  '怎么',
  '哪里',
  '需要',
  '可以',
  '负责',
  '审批',
  '审核',
  '账号',
  '权限',
  '问题',
  '处理',
  '申请',
  '开通'
])
const genericTopics = new Set(['协调', '流程'])
const distinctiveShortTopicOwners = new Map([
  ['报销', 'local-colleague-ruan-ming'],
  ['合同', 'local-colleague-ji-tian'],
  ['采购', 'local-colleague-zheng-yan'],
  ['工资', 'local-colleague-su-yi'],
  ['工位', 'local-colleague-shen-mo'],
  ['门禁', 'local-colleague-shen-mo'],
  ['差旅', 'local-colleague-shen-mo'],
  ['社保', 'local-colleague-su-yi'],
  ['发票', 'local-colleague-ruan-ming'],
  ['付款', 'local-colleague-song-he'],
  ['收款', 'local-colleague-song-he'],
  ['招聘', 'local-colleague-qiao-an'],
  ['投诉', 'local-colleague-ye-ning'],
  ['告警', 'local-colleague-bai-he'],
  ['漏洞', 'local-colleague-han-ce'],
  ['图标', 'local-colleague-tang-ke'],
  ['插画', 'local-colleague-tang-ke']
])
const compoundTopics = ['客户端', '服务端', '数据库', '数据表', '前端', '后端', '入职']
const WordSegmenter = (
  Intl as unknown as {
    Segmenter: new (
      locale: string,
      options: { granularity: 'word' }
    ) => {
      segment: (input: string) => Iterable<{ segment: string; isWordLike: boolean }>
    }
  }
).Segmenter
const wordSegmenter = new WordSegmenter('zh', { granularity: 'word' })

function questionTopics(question: string): string[][] {
  return question
    .toLowerCase()
    .slice(0, 500)
    .split(/[和及与,，。?？;；]/)
    .map((clause) => {
      const terms = new Set<string>()
      let remainder = clause.replace(/请问|哪位|同事|应该|联系|找谁|由谁|谁|负责|需要|可以/g, ' ')
      for (const compound of compoundTopics) {
        if (!remainder.includes(compound)) continue
        terms.add(compound)
        remainder = remainder.split(compound).join(' ')
      }
      let singleRun = ''
      const flushSingles = () => {
        if (singleRun.length >= 2 && !topicStopWords.has(singleRun)) terms.add(singleRun)
        singleRun = ''
      }
      for (const part of wordSegmenter.segment(remainder)) {
        const term = part.segment.trim()
        if (part.isWordLike && /^[\u4e00-\u9fff]$/.test(term)) {
          singleRun += term
          continue
        }
        flushSingles()
        if (part.isWordLike && term.length >= 2 && !topicStopWords.has(term)) terms.add(term)
      }
      flushSingles()
      return [...terms]
    })
    .filter((terms) => terms.length > 0 && terms.some((term) => !genericTopics.has(term)))
}

function keywords(text: string): string[] {
  const terms = new Set<string>()
  for (const chunk of text
    .toLowerCase()
    .slice(0, 500)
    .match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || []) {
    if (/^[a-z0-9]+$/.test(chunk)) {
      if (chunk.length >= 2) terms.add(chunk)
      continue
    }
    for (const length of [2, 3]) {
      for (let index = 0; index + length <= chunk.length; index++) {
        const term = chunk.slice(index, index + length)
        if (!stopWords.has(term)) terms.add(term)
      }
    }
  }
  return [...terms]
}

export function findResponsibleContacts(question: string, storage: Reader = localStorage) {
  if (!/谁|找谁|哪位|联系人|负责|开通|申请|审批/.test(question)) return []
  const contacts = getLocalFriendList().map((contact) => ({
    userId: contact.peerId,
    name: contact.username,
    department: contact.tag,
    responsibility: getResponsibility(contact.peerId, storage)
  }))
  const selfWork = getResponsibility(LOCAL_SELF_ID, storage)
  if (selfWork) contacts.push({ userId: LOCAL_SELF_ID, name: '我', department: '个人主页', responsibility: selfWork })
  const clauses = question
    .toLowerCase()
    .slice(0, 500)
    .split(/[和及与,，。?？;；]/)
    .map((clause) => clause.trim())
    .filter((clause) => questionTopics(clause).length > 0)
  if (!clauses.length) return []

  const matchesForClause = (clause: string) => {
    const terms = keywords(clause)
    const topics = questionTopics(clause)
    if (!terms.length || !topics.length) return []
    const ranked = contacts
      .map((contact) => ({
        ...contact,
        score: terms.reduce(
          (score, term) => score + (contact.responsibility.toLowerCase().includes(term) ? term.length : 0),
          0
        )
      }))
      .filter((contact) =>
        topics.some(
          (topic) =>
            topic.filter((term) => contact.responsibility.toLowerCase().includes(term)).length / topic.length >= 0.75
        )
      )
      .sort((a, b) => b.score - a.score)
    const bestScore = ranked[0]?.score ?? 0
    return ranked.filter(
      (contact) =>
        (contact.score >= 4 ||
          topics.some((topic) => topic.length === 1 && distinctiveShortTopicOwners.get(topic[0]) === contact.userId)) &&
        contact.score >= bestScore * 0.7
    )
  }

  if (clauses.length === 1) return matchesForClause(clauses[0]).slice(0, 2)
  const distinct = new Map<string, ReturnType<typeof matchesForClause>[number]>()
  for (const clause of clauses) {
    const match = matchesForClause(clause)[0]
    if (match) distinct.set(match.userId, match)
    if (distinct.size === 2) break
  }
  return [...distinct.values()]
}

export function answerFromContactKnowledge(question: string, storage: Reader = localStorage): RagResult | null {
  const matches = findResponsibleContacts(question, storage)
  if (!matches.length) return null
  return {
    text: `根据本机人员职责知识库，下方同事的职责可能与问题相关。请查看名片核实具体事项后再联系。`,
    baseUrl: 'local-contact-knowledge',
    chatId: 'contact-responsibilities',
    sessionId: '',
    references: matches.map((contact) => ({ name: `${contact.name} · 工作职责`, text: contact.responsibility })),
    options: [],
    contacts: matches.map(({ userId, name, department, responsibility }) => ({
      userId,
      name,
      department,
      responsibility
    }))
  }
}
