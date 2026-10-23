// Fictional internal policies for the local demo. These are not company rules.
export const documents = [
  {
    id: 'leave', title: '员工请假指引（示例）', category: '人事制度', icon: '休',
    keywords: ['请假', '年假', '病假', '事假', '休假', '调休'],
    sections: [
      { title: '申请与审批', text: '演示规则：请假在办公系统中提交，填写假别、起止时间与工作交接人。年假、事假原则上提前 2 个工作日申请；不超过 3 天由直属主管审批，超过 3 天需部门负责人审批。', keywords: ['申请', '流程', '审批', '请假', '主管', '提前', '几天'] },
      { title: '病假与紧急情况', text: '演示规则：突发疾病可先通知直属主管，当天补交病假申请；连续病假超过 2 天时，需补充就诊证明。紧急情况无法及时提交的，可在返岗后 2 个工作日内补办。', keywords: ['病假', '生病', '疾病', '紧急', '证明', '补办'] },
      { title: '年假与交接', text: '演示规则：示例员工每年有 10 天年假，实际可用余额以办公系统为准。休假前应明确事项进度、待办及接手人，审批通过后再安排休假。', keywords: ['年假', '余额', '交接', '多少天'] }
    ],
    questions: ['请假应该怎么申请？', '病假需要提供什么材料？', '示例年假有多少天？']
  },
  {
    id: 'expense', title: '费用报销规范（示例）', category: '财务制度', icon: '报',
    keywords: ['报销', '发票', '费用', '付款', '财务', '票据'],
    sections: [
      { title: '报销材料', text: '演示规则：报销需提供有效发票、付款凭证和费用用途说明；差旅费用还需附已审批的出差申请。发票抬头需与示例公司名称一致，同一笔支出不得重复报销。', keywords: ['材料', '发票', '凭证', '票据', '需要', '报销'] },
      { title: '提交时间与审批', text: '演示规则：费用发生后 30 天内提交报销申请，经过直属主管与财务复核。材料齐全且审批通过的，按每周五的示例付款批次处理；具体到账时间在本演示中不作保证。', keywords: ['多久', '时间', '天', '审批', '付款', '到账', '30', '期限'] }
    ],
    questions: ['报销需要哪些材料？', '报销应在多少天内提交？', '出差住宿的示例标准是多少？']
  },
  {
    id: 'travel', title: '出差管理办法（示例）', category: '行政制度', icon: '行',
    keywords: ['出差', '差旅', '住宿', '酒店', '交通', '高铁', '机票', '补贴', '餐费'],
    sections: [
      { title: '出差申请', text: '演示规则：出差前提交目的、行程和预算，经直属主管批准后订票。行程或预算发生明显变化时应重新确认，不建议先支付后补审批。', keywords: ['申请', '出差', '流程', '审批', '订票'] },
      { title: '住宿与交通', text: '演示规则：国内出差住宿上限为每晚 400 元；高铁采用二等座，飞机采用经济舱。超过示例标准的费用需事先获得部门负责人批准并保留说明。', keywords: ['住宿', '酒店', '标准', '多少', '交通', '高铁', '机票', '超标'] },
      { title: '补贴与报销', text: '演示规则：出差餐费补贴为每天 80 元，已统一供餐时不重复领取。返程后 30 天内，凭出差申请、行程及有效票据办理报销。', keywords: ['餐费', '补贴', '报销', '返程', '材料'] }
    ],
    questions: ['出差住宿的示例标准是多少？', '出差餐费补贴是多少？', '报销需要哪些材料？']
  },
  {
    id: 'remote', title: '远程办公约定（示例）', category: '协作制度', icon: '协',
    keywords: ['远程', '居家', '打卡', '周报'],
    sections: [
      { title: '申请与时间', text: '演示规则：远程办公每周最多 2 天，至少提前 1 个工作日向直属主管申请。工作日 10:00—17:00 为核心协作时间，应保持可联系并按约定参加会议。', keywords: ['申请', '几天', '时间', '在线', '远程', '居家'] },
      { title: '信息保护与交付', text: '演示规则：使用公司批准的设备和连接方式，不向个人网盘传输业务资料；当天工作结束前同步进度、风险与次日计划。涉及敏感事项时应回到指定办公环境处理。', keywords: ['设备', '安全', '资料', '网盘', '进度', '交付', '要求'] }
    ],
    questions: ['远程办公怎么申请？', '远程办公有什么协作要求？', '请假应该怎么申请？']
  }
]

export function answerQuestion(question, session) {
  const text = question.toLowerCase()
  const ranked = documents.map(doc => ({ doc, score: doc.keywords.filter(word => text.includes(word)).length }))
    .sort((a, b) => b.score - a.score)
  let doc = ranked[0].score ? ranked[0].doc : undefined
  if (!doc && /^(那|这个|还|需要|怎么|多少|多久|能否|可以|要|有)/.test(text)) {
    doc = documents.find(item => item.id === session.topic)
  }
  if (!doc) return {
    answer: '这是本地知识问答演示，仅包含请假、报销、出差和远程办公四份示例制度。当前资料没有足够依据回答这个问题，请换一个示例问题；演示不会编造制度内容。',
    chunks: [], questions: ['请假应该怎么申请？', '报销需要哪些材料？', '出差住宿的示例标准是多少？']
  }
  session.topic = doc.id
  const sections = doc.sections.map(section => ({ ...section, score: section.keywords.filter(word => text.includes(word)).length }))
    .sort((a, b) => b.score - a.score)
  const hits = sections[0].score ? sections.filter(section => section.score > 0).slice(0, 2) : sections.slice(0, 2)
  return {
    answer: `根据《${doc.title}》：\n\n${hits.map((section, i) => `${i + 1}. ${section.text.replace(/^演示规则：/, '')}`).join('\n\n')}\n\n以上为虚构的演示制度，请勿作为真实公司政策使用。`,
    chunks: hits.map(section => ({ docnm_kwd: doc.title, content: `【${section.title}】${section.text}`, document_id: doc.id })),
    questions: doc.questions.filter(item => item !== question.trim()).slice(0, 3)
  }
}
