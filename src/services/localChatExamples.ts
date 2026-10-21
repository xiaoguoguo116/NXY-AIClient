import type { LocalChatData, LocalConversation, LocalMember } from './localChat.ts'

const EXAMPLE_VERSION = 2
const members: Record<string, LocalMember> = {
  self: { id: 'self', name: '我', kind: 'self', color: '#2f92ed' },
  product: { id: 'local-colleague-lin-zhixia', name: '林知夏', kind: 'simulated', color: '#b77a50' },
  frontend: { id: 'local-colleague-su-qing', name: '苏晴', kind: 'simulated', color: '#547dc0' },
  backend: { id: 'local-colleague-chen-mo', name: '陈默', kind: 'simulated', color: '#408978' },
  qa: { id: 'local-colleague-pei-ning', name: '裴宁', kind: 'simulated', color: '#8e6cb1' },
  admin: { id: 'local-colleague-qiao-an', name: '乔安', kind: 'simulated', color: '#ad7394' }
}

type Example = { key: string; name: string; people: string[]; messages: [string, string][]; version?: number }
const examples: Example[] = [
  {
    key: 'project',
    name: '项目协作群（本地示例）',
    people: ['self', 'product', 'frontend', 'backend', 'qa'],
    messages: [
      ['product', '这轮先梳理聊天、会议和待办三个流程，大家把需要确认的问题发在群里。'],
      ['frontend', '我来整理日程页面，日期和星期放在同一行，提醒卡片的字号也一起统一。'],
      ['backend', '会议邀请需要保留每位成员的反馈，参加、不参加和待确认分别展示。'],
      ['self', '还要支持从全部联系人里选参会人，不要求大家先有共同的群聊。'],
      ['product', '收到。个人对话和群聊都需要会议入口，群聊可以选全体或部分成员。'],
      ['qa', '我把这些场景列进测试清单，同时检查原有聊天记录是否保留。'],
      ['frontend', '时间选择按十五分钟一个档位，选完再点确认，避免误操作。'],
      ['self', '先把待确认项整理好，评审时按清单逐项讨论。']
    ]
  },
  {
    key: 'engineering',
    name: '研发讨论群（本地示例）',
    people: ['self', 'frontend', 'backend', 'qa'],
    messages: [
      ['backend', '知识库问答先关注多主题问题，不能只召回其中一个方向。'],
      ['self', '比如输入“加值班”，追问里需要同时有加班和值班。'],
      ['frontend', '聊天中保留 @AI RAG助手 入口，模型和凭证统一到总设置配置。'],
      ['qa', '我会分别检查选项显示、点击后的回答和引用的制度来源。'],
      ['backend', '如果证据不足，要明确提示补充问题，不生成没有依据的选项。'],
      ['frontend', '已有对话继续保留，不因为切换助手或调整设置而清空消息。'],
      ['qa', '单独问加班、单独问值班，也会加入回归用例。'],
      ['self', '好，后续讨论按界面、检索和数据保存三个方面整理。']
    ]
  },
  {
    key: 'duty',
    name: '值班协调群（本地示例）',
    people: ['self', 'admin', 'backend', 'qa'],
    messages: [
      ['admin', '这里用一组示例讨论演示排班沟通，不代表实际值班安排。'],
      ['backend', '交接清单建议包含设备状态、待处理事项和异常联系信息。'],
      ['qa', '我可以协助检查交接模板，未完成事项单独标注负责人。'],
      ['self', '临时需要调班时，先在群里沟通，再按正式流程确认。'],
      ['admin', '对，群里的讨论不替代审批，最终以确认后的安排为准。'],
      ['backend', '涉及加班、调休的问题，可以通过 RAG 助手查询相应制度。'],
      ['qa', '如果某位成员不能参加交接会议，也需要保留“不参加”的反馈。'],
      ['self', '这些只是示例聊天，暂不生成真实排班、会议或提醒。']
    ]
  },
  {
    key: 'daily',
    name: '日常交流群（本地示例）',
    people: ['self', 'product', 'frontend', 'admin'],
    messages: [
      ['admin', '欢迎来到本地示例交流群，可以用这些记录体验搜索、引用和多选。'],
      ['product', '我习惯先引用原消息再回复，这样讨论上下文更清楚。'],
      ['frontend', '消息多的时候，可以打开消息记录面板找之前的关键词。'],
      ['self', '也可以选中几条相关记录，让 AI 帮忙整理讨论结论。'],
      ['product', '总结时最好区分已经确定的事项和仍待讨论的问题。'],
      ['admin', '如果需要创建待办，再明确负责人和提醒时间。'],
      ['frontend', '这些示例成员都只在本机模拟，不会收到真实通知。'],
      ['self', '收到，先用这几个群体验聊天和记录管理。']
    ]
  },
  {
    key: 'ticket-delivery',
    version: 2,
    name: '客户工单平台·一期交付（模拟项目）',
    people: ['self', 'product', 'frontend', 'backend', 'qa'],
    messages: [
      ['product', '一期范围确认：工单创建、指派、处理记录、超时提醒。数据看板放到二期，本期不做。'],
      ['self', '验收先按三个角色走：客服创建，组长分派，工程师处理。跨部门可见范围还需要客户确认。'],
      ['backend', '创建和指派接口已在测试环境部署，接口文档 v0.6 已补上状态枚举。附件上传还没接完。'],
      ['frontend', '列表页和详情页已完成，今天联调指派操作。批量指派接口预计什么时候能提供？'],
      ['backend', '批量指派不在本期接口里，先逐条操作；如果一定要做，需要补需求和排期。'],
      ['product', '确认，本期只做单条指派。批量指派进入二期需求池，不影响这次交付。'],
      ['qa', '联调发现 BUG-217：工单从处理中退回待分派，旧处理人仍可编辑，存在权限问题。'],
      ['backend', '已定位到权限缓存没有随状态失效。陈默负责修复，10月21日12:00前给测试包。'],
      ['frontend', '前端也会在状态变化后重新拉取权限，苏晴10月21日15:00前完成。按钮隐藏不能替代后端鉴权。'],
      ['self', 'BUG-217列为发布阻塞项，修复后要验证旧处理人的接口请求确实被拒绝。'],
      ['qa', '收到，裴宁10月22日17:00前完成三角色回归，重点覆盖退回、转派和重复提交。'],
      ['product', '原定10月23日上午演示，客户希望改到10月23日15:00。我还在等客户确认，先不要发正式邀请。'],
      ['frontend', '附件上传失败时，页面现在会清空已输入内容，我会一并调整成保留草稿并允许重试。'],
      ['backend', '附件接口受测试对象存储白名单限制，运维尚未开通，这项完成时间暂时无法承诺。'],
      ['self', '附件联调仍是外部阻塞，周会需要单独跟进；演示时间以客户最终回复为准。'],
      ['product', '林知夏负责跟客户确认数据可见范围和演示时间，10月21日18:00前同步结果。'],
      ['qa', '今天没有发布验收结论，当前只完成主流程冒烟。不要把“可联调”写成“已通过验收”。'],
      ['self', '先按这个分工推进。明天站会重点看BUG-217、附件白名单和客户反馈三项。']
    ]
  },
  {
    key: 'knowledge-search',
    version: 2,
    name: '企业知识库·检索优化（模拟项目）',
    people: ['self', 'product', 'backend', 'qa'],
    messages: [
      ['product', '本轮目标是让制度问答能说明依据，不追求只给一个看起来完整的答案。'],
      ['qa', '回归集里“加值班”只出现值班选项，缺少加班方向；问题编号RAG-42。'],
      ['backend', '检索诊断里只有原始词“加值班”，需要先展开并列主题，再分别检索。'],
      ['self', '展开不能改掉原问题的日期、金额和制度名，问加班费不能被改成值班补贴。'],
      ['backend', '计划保留原问题与两个独立检索词；最多四路检索，避免组合词挤掉第二个主题。'],
      ['qa', '裴宁负责补充12条多主题用例，包括加班和值班、报销与差旅，10月22日中午提交。'],
      ['product', '用户明确要求比较两项制度时，直接比较；只有范围不明确时才给追问选项。'],
      ['backend', '追问选项还需要证据校验。资料只有一边时不能编出另一边的规定。'],
      ['self', '请把“召回到了文档”和“答案受文档支持”分开评估，不能只看命中率。'],
      ['qa', '新增问题：点击选项后偶尔重新检索，导致答案与选项原来的依据不一致。'],
      ['backend', '需要检查缓存有效期和文档版本；缓存命中时复用证据，文档变更则重新校验。'],
      ['product', '前端保留制度来源展开入口，模型配置仍只放总设置，不放每个会话里。'],
      ['self', '另外测一下“加班申请要谁批准”，这是明确问题，不要再问用户想了解哪类加班。'],
      ['qa', '我会记录问题、追问、选中结果和引用片段，失败样本单独保留，不只截成功画面。'],
      ['backend', '陈默10月22日18:00前提交检索改动，当前尚未跑完全部回归。'],
      ['product', '这轮暂不接入外网搜索，只查询公司知识库，范围没有变化。'],
      ['qa', '大批量文档更新后的缓存失效测试还没有安排负责人和完成时间，需要会上确认。'],
      ['self', '这项保持待分配，不要替其他同事认领。通过回归之后再确定上线日期。']
    ]
  },
  {
    key: 'mobile-approval',
    version: 2,
    name: '移动审批·改版联调（模拟项目）',
    people: ['self', 'product', 'frontend', 'backend', 'qa', 'admin'],
    messages: [
      ['product', '移动审批改版先做请假、加班和报销三个入口，旧流程历史单据继续可查。'],
      ['frontend', '请假表单已按设计稿完成，小屏下日期和星期不会拆行，正在处理附件预览。'],
      ['backend', '历史单据接口仍返回旧字段，新页面要兼容旧状态，不要把已撤销显示成审批中。'],
      ['qa', '发现APP-86：从通知跳进单据再返回，会回到首页，丢失原来的筛选条件。'],
      ['frontend', '苏晴负责保存筛选和滚动位置，10月23日12:00前提测。'],
      ['admin', '加班申请要按哪份制度走？临时加班和计划加班是否是同一个审批流程？'],
      ['self', '先通过AI RAG助手查“计划加班如何申请和审批”，引用制度条文，不凭群里印象判断。'],
      ['product', '制度口径由行政确认后再写进表单说明，研发不要自行定义审批条件。'],
      ['admin', '乔安负责核对说明文案，10月23日17:00前给反馈；临时加班口径仍待确认。'],
      ['backend', '报销接口本周不改支付逻辑，只调整表单字段，不能把本次改版当作财务规则变更。'],
      ['qa', '弱网重复点击提交可能生成两张单据，APP-91优先级高于页面样式问题。'],
      ['backend', '陈默负责增加请求幂等校验，10月24日12:00前提供接口，前端同时禁用重复点击。'],
      ['self', 'APP-91未通过前不能进入灰度。请加上请求超时后重试的用例。'],
      ['qa', '裴宁负责弱网与历史单据兼容回归，预计10月24日18:00出结果，不代表现在已经通过。'],
      ['product', '原定周五评审，乔安那天不能参加，先收书面反馈；是否改期还未决定。'],
      ['admin', '我可以提供书面意见，但不能确认出席。会议里请保留不参加的状态。'],
      ['frontend', 'Android低版本附件预览仍有白屏，暂未定位；需要设备和日志，完成时间未知。'],
      ['self', '先把两个阻塞项和未确定事项列清楚，评审确认后再发灰度通知。']
    ]
  }
]

/** Append once, preserving existing chats, selection and any edits to examples. */
export function withExampleConversations(data: LocalChatData, now = new Date()): LocalChatData {
  if ((data.exampleGroupsVersion ?? 0) >= EXAMPLE_VERSION) return data
  const ids = new Set(data.conversations.map((chat) => chat.id))
  const added: LocalConversation[] = examples.flatMap((example, groupIndex) => {
    const version = example.version ?? 1
    if ((data.exampleGroupsVersion ?? 0) >= version) return []
    const id = `local-example-v${version}-${example.key}`
    if (ids.has(id)) return []
    return [
      {
        id,
        name: example.name,
        notifications: false,
        announcement: '本群为本地示例，成员与聊天内容均为模拟数据，不会发送真实消息或创建会议、待办及提醒。',
        members: example.people.map((key) => ({ ...members[key] })),
        messages: example.messages.map(([sender, text], index) => ({
          id: `${id}-message-${index + 1}`,
          role: 'user' as const,
          senderId: members[sender].id,
          text,
          status: 'done' as const,
          createdAt: new Date(
            now.getTime() - ((examples.length - groupIndex) * 24 * 60 - index * 5) * 60_000
          ).toISOString()
        }))
      }
    ]
  })
  return { ...data, exampleGroupsVersion: EXAMPLE_VERSION, conversations: [...data.conversations, ...added] }
}
