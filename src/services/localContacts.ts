import type { Contact } from '@/types/api/contacts'
import type { EnterprisInfo } from '@/types/api/enterprise'
import type { EnterpriseDepartment } from '@/types/api/enterpriseDepartment'
import type { EnterpriseMember } from '@/types/api/enterpriseMember'
import type { User } from '@/types/api/user'

export const LOCAL_ENTERPRISE_ID = 'local-enterprise-nxy'

const createdAt = '2025-01-06 09:00:00'
const updatedAt = '2026-10-16 09:00:00'

type LocalColleague = {
  id: string
  name: string
  account: string
  departmentId: string
  departmentName: string
  title: string
  email: string
  phone: string
  gender: string
  location: string
  signature: string
  role?: string
}

function exampleColleague(
  id: string,
  name: string,
  account: string,
  departmentId: string,
  departmentName: string,
  title: string,
  phoneSuffix: number,
  signature: string,
  role?: string
): LocalColleague {
  return {
    id,
    name,
    account,
    departmentId,
    departmentName,
    title,
    email: `${account}@example.local`,
    phone: `138 0000 ${phoneSuffix}`,
    gender: '未设置',
    location: '本地工作区',
    signature,
    role
  }
}

const colleagues: LocalColleague[] = [
  {
    id: 'local-colleague-lin-zhixia',
    name: '林知夏',
    account: 'lin.zhixia',
    departmentId: 'local-dept-product',
    departmentName: '产品中心',
    title: '产品负责人',
    email: 'zhixia.lin@example.local',
    phone: '138 0000 1001',
    gender: '女',
    location: '上海',
    signature: '把复杂的问题，变成清晰的产品。',
    role: 'leader'
  },
  {
    id: 'local-colleague-chen-cheng',
    name: '陈澄',
    account: 'chen.cheng',
    departmentId: 'local-dept-product',
    departmentName: '产品中心',
    title: '高级产品经理',
    email: 'cheng.chen@example.local',
    phone: '138 0000 1002',
    gender: '男',
    location: '杭州',
    signature: '先理解用户，再定义问题。'
  },
  {
    id: 'local-colleague-zhou-yu',
    name: '周屿',
    account: 'zhou.yu',
    departmentId: 'local-dept-engineering',
    departmentName: '研发中心',
    title: '技术负责人',
    email: 'yu.zhou@example.local',
    phone: '138 0000 2001',
    gender: '男',
    location: '深圳',
    signature: '可靠的软件来自清楚的边界。',
    role: 'leader'
  },
  {
    id: 'local-colleague-su-qing',
    name: '苏晴',
    account: 'su.qing',
    departmentId: 'local-dept-frontend',
    departmentName: '前端组',
    title: '前端工程师',
    email: 'qing.su@example.local',
    phone: '138 0000 2101',
    gender: '女',
    location: '上海',
    signature: '让每一次点击都有回应。'
  },
  {
    id: 'local-colleague-luo-kai',
    name: '罗凯',
    account: 'luo.kai',
    departmentId: 'local-dept-frontend',
    departmentName: '前端组',
    title: '客户端工程师',
    email: 'kai.luo@example.local',
    phone: '138 0000 2102',
    gender: '男',
    location: '成都',
    signature: '关注体验，也关注性能。'
  },
  {
    id: 'local-colleague-chen-mo',
    name: '陈默',
    account: 'chen.mo',
    departmentId: 'local-dept-backend',
    departmentName: '服务端组',
    title: '后端工程师',
    email: 'mo.chen@example.local',
    phone: '138 0000 2201',
    gender: '男',
    location: '北京',
    signature: '保持简单，保持稳定。'
  },
  {
    id: 'local-colleague-gao-yuan',
    name: '高远',
    account: 'gao.yuan',
    departmentId: 'local-dept-backend',
    departmentName: '服务端组',
    title: '平台工程师',
    email: 'yuan.gao@example.local',
    phone: '138 0000 2202',
    gender: '男',
    location: '武汉',
    signature: '自动化重复工作，把时间留给创造。'
  },
  {
    id: 'local-colleague-pei-ning',
    name: '裴宁',
    account: 'pei.ning',
    departmentId: 'local-dept-quality',
    departmentName: '质量保障组',
    title: '测试工程师',
    email: 'ning.pei@example.local',
    phone: '138 0000 2301',
    gender: '女',
    location: '南京',
    signature: '好质量，是被持续验证出来的。'
  },
  {
    id: 'local-colleague-gu-yan',
    name: '顾言',
    account: 'gu.yan',
    departmentId: 'local-dept-design',
    departmentName: '设计中心',
    title: '设计负责人',
    email: 'yan.gu@example.local',
    phone: '138 0000 3001',
    gender: '女',
    location: '上海',
    signature: '设计是信息的秩序。',
    role: 'leader'
  },
  {
    id: 'local-colleague-tang-ke',
    name: '唐可',
    account: 'tang.ke',
    departmentId: 'local-dept-design',
    departmentName: '设计中心',
    title: '视觉设计师',
    email: 'ke.tang@example.local',
    phone: '138 0000 3002',
    gender: '女',
    location: '厦门',
    signature: '用视觉讲清楚故事。'
  },
  {
    id: 'local-colleague-song-ran',
    name: '宋然',
    account: 'song.ran',
    departmentId: 'local-dept-market',
    departmentName: '市场与客户成功',
    title: '市场负责人',
    email: 'ran.song@example.local',
    phone: '138 0000 4001',
    gender: '男',
    location: '广州',
    signature: '让好产品被更多人看见。',
    role: 'leader'
  },
  {
    id: 'local-colleague-lu-yao',
    name: '陆瑶',
    account: 'lu.yao',
    departmentId: 'local-dept-market',
    departmentName: '市场与客户成功',
    title: '客户成功经理',
    email: 'yao.lu@example.local',
    phone: '138 0000 4002',
    gender: '女',
    location: '苏州',
    signature: '客户的成功，才是合作的开始。'
  },
  {
    id: 'local-colleague-qiao-an',
    name: '乔安',
    account: 'qiao.an',
    departmentId: 'local-dept-operations',
    departmentName: '综合支持',
    title: '行政与人力伙伴',
    email: 'an.qiao@example.local',
    phone: '138 0000 5001',
    gender: '女',
    location: '上海',
    signature: '让团队安心地把事情做好。',
    role: 'leader'
  },
  exampleColleague(
    'local-colleague-wei-ran',
    '魏然',
    'wei.ran',
    'local-dept-product',
    '产品中心',
    '产品运营经理',
    6001,
    '让上线后的产品持续产生价值。'
  ),
  exampleColleague(
    'local-colleague-gu-xun',
    '顾寻',
    'gu.xun',
    'local-dept-product',
    '产品中心',
    '业务分析师',
    6002,
    '用业务流程连接需求与交付。'
  ),
  exampleColleague(
    'local-colleague-xu-lan',
    '许岚',
    'xu.lan',
    'local-dept-frontend',
    '前端组',
    '移动端工程师',
    6101,
    '让移动体验稳定、顺畅。'
  ),
  exampleColleague(
    'local-colleague-fang-ning',
    '方宁',
    'fang.ning',
    'local-dept-quality',
    '质量保障组',
    '自动化测试工程师',
    6301,
    '把高频回归交给自动化。'
  ),
  exampleColleague(
    'local-colleague-xu-zhiyuan',
    '许知远',
    'xu.zhiyuan',
    'local-dept-data',
    '数据平台组',
    '数据工程师',
    6401,
    '让数据链路可追溯。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-wei-qing',
    '卫青',
    'wei.qing',
    'local-dept-data',
    '数据平台组',
    '数据分析师',
    6402,
    '用统一口径解释业务变化。'
  ),
  exampleColleague(
    'local-colleague-han-ce',
    '韩策',
    'han.ce',
    'local-dept-security',
    '安全运维组',
    '信息安全工程师',
    6501,
    '把安全要求落实到流程。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-bai-he',
    '白河',
    'bai.he',
    'local-dept-security',
    '安全运维组',
    '站点可靠性工程师',
    6502,
    '先发现故障，再缩短恢复时间。'
  ),
  exampleColleague(
    'local-colleague-he-qing',
    '何清',
    'he.qing',
    'local-dept-design',
    '设计中心',
    '用户研究员',
    7001,
    '从真实使用场景中发现体验问题。'
  ),
  exampleColleague(
    'local-colleague-ye-ning',
    '叶宁',
    'ye.ning',
    'local-dept-market',
    '市场与客户成功',
    '客户服务经理',
    7101,
    '让客户反馈得到明确回应。'
  ),
  exampleColleague(
    'local-colleague-liang-chen',
    '梁晨',
    'liang.chen',
    'local-dept-market',
    '市场与客户成功',
    '销售运营专员',
    7102,
    '让商机和交付衔接顺畅。'
  ),
  exampleColleague(
    'local-colleague-su-yi',
    '苏一',
    'su.yi',
    'local-dept-hr',
    '人力资源组',
    '薪酬福利专员',
    8001,
    '把薪酬福利事项办理清楚。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-zheng-yan',
    '郑言',
    'zheng.yan',
    'local-dept-admin',
    '行政采购组',
    '采购专员',
    8101,
    '让采购有记录、有交付。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-shen-mo',
    '沈茉',
    'shen.mo',
    'local-dept-admin',
    '行政采购组',
    '行政专员',
    8102,
    '让日常办公更省心。'
  ),
  exampleColleague(
    'local-colleague-lu-bei',
    '陆北',
    'lu.bei',
    'local-dept-it',
    'IT 支持组',
    '内部 IT 专员',
    8201,
    '让办公账号和设备保持可用。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-ruan-ming',
    '阮明',
    'ruan.ming',
    'local-dept-finance',
    '财务组',
    '费用会计',
    9001,
    '让费用与发票流程准确透明。',
    'leader'
  ),
  exampleColleague(
    'local-colleague-song-he',
    '宋禾',
    'song.he',
    'local-dept-finance',
    '财务组',
    '结算会计',
    9002,
    '按时完成付款和结算。'
  ),
  exampleColleague(
    'local-colleague-ji-tian',
    '季恬',
    'ji.tian',
    'local-dept-legal',
    '法务组',
    '法务专员',
    9101,
    '让合同条款和合规边界清晰。',
    'leader'
  )
]

function toMember(colleague: LocalColleague): EnterpriseMember {
  return {
    id: `local-member-${colleague.id}`,
    enterpriseId: LOCAL_ENTERPRISE_ID,
    departmentId: colleague.departmentId,
    userId: colleague.id,
    memberName: colleague.name,
    jobNumber: colleague.account,
    jobTitle: colleague.title,
    email: colleague.email,
    phone: colleague.phone,
    roles: colleague.role || 'member',
    status: 'NORMAL',
    joinedAt: createdAt,
    createdAt,
    updatedAt,
    deletedAt: null,
    username: colleague.name,
    userLevel: 1,
    emotionName: '',
    emotionUrl: '',
    departmentName: colleague.departmentName
  }
}

const members = colleagues.map(toMember)

function membersOf(departmentId: string) {
  return members.filter((member) => member.departmentId === departmentId)
}

function department(id: string, name: string, sort: number, parentId = '', leaderUserId = ''): EnterpriseDepartment {
  const departmentMembers = membersOf(id)
  const leader = colleagues.find((item) => item.id === leaderUserId)
  return {
    id,
    enterpriseId: LOCAL_ENTERPRISE_ID,
    parentId,
    name,
    describe: '',
    leaderUserId,
    sort,
    level: parentId ? 2 : 1,
    memberNum: departmentMembers.length,
    createdAt,
    updatedAt,
    deletedAt: null,
    leaderUsername: leader?.name || '',
    members: departmentMembers
  }
}

const departments: EnterpriseDepartment[] = [
  department('local-dept-product', '产品中心', 10, '', 'local-colleague-lin-zhixia'),
  department('local-dept-engineering', '研发中心', 20, '', 'local-colleague-zhou-yu'),
  department('local-dept-frontend', '前端组', 21, 'local-dept-engineering', 'local-colleague-su-qing'),
  department('local-dept-backend', '服务端组', 22, 'local-dept-engineering', 'local-colleague-chen-mo'),
  department('local-dept-quality', '质量保障组', 23, 'local-dept-engineering', 'local-colleague-pei-ning'),
  department('local-dept-data', '数据平台组', 24, 'local-dept-engineering', 'local-colleague-xu-zhiyuan'),
  department('local-dept-security', '安全运维组', 25, 'local-dept-engineering', 'local-colleague-han-ce'),
  department('local-dept-design', '设计中心', 30, '', 'local-colleague-gu-yan'),
  department('local-dept-market', '市场与客户成功', 40, '', 'local-colleague-song-ran'),
  department('local-dept-operations', '综合支持', 50, '', 'local-colleague-qiao-an'),
  department('local-dept-hr', '人力资源组', 51, 'local-dept-operations', 'local-colleague-su-yi'),
  department('local-dept-admin', '行政采购组', 52, 'local-dept-operations', 'local-colleague-zheng-yan'),
  department('local-dept-it', 'IT 支持组', 53, 'local-dept-operations', 'local-colleague-lu-bei'),
  department('local-dept-finance-legal', '财务与法务', 60),
  department('local-dept-finance', '财务组', 61, 'local-dept-finance-legal', 'local-colleague-ruan-ming'),
  department('local-dept-legal', '法务组', 62, 'local-dept-finance-legal', 'local-colleague-ji-tian')
]

for (const entry of departments) {
  const includedDepartmentIds = new Set([entry.id])
  let foundChild = true
  while (foundChild) {
    foundChild = false
    for (const candidate of departments) {
      if (includedDepartmentIds.has(candidate.parentId) && !includedDepartmentIds.has(candidate.id)) {
        includedDepartmentIds.add(candidate.id)
        foundChild = true
      }
    }
  }
  entry.memberNum = members.filter((member) => includedDepartmentIds.has(member.departmentId)).length
}

const enterpriseInfo: EnterprisInfo = {
  id: LOCAL_ENTERPRISE_ID,
  creatorUserId: 'local-colleague-lin-zhixia',
  enterpriseNumber: 'LOCAL-001',
  location: '本地工作区',
  name: '协作示例组织',
  avatar: '',
  describe: '保存在当前设备上的示例组织架构',
  ownerUserId: 'local-colleague-lin-zhixia',
  enterpriseTag: '本地',
  memberNum: members.length,
  createdAt,
  updatedAt,
  deletedAt: null,
  roles: 'member',
  userEnterpriseMembers: members
}

function toContact(colleague: LocalColleague): Contact {
  return {
    id: `local-contact-${colleague.id}`,
    userId: colleague.id,
    peerId: colleague.id,
    remark: '',
    tag: colleague.departmentName,
    isBack: true,
    isTop: false,
    isConcern: false,
    isMute: false,
    peerType: 'USER',
    status: 'NORMAL',
    createdAt,
    updatedAt,
    deletedAt: null,
    username: colleague.name,
    account: colleague.account,
    userLevel: 1,
    emotionName: '',
    emotionUrl: ''
  }
}

function toUser(colleague: LocalColleague): User {
  return {
    id: colleague.id,
    username: colleague.name,
    account: colleague.account,
    phone: colleague.phone,
    email: colleague.email,
    gitee: null,
    gender: colleague.gender,
    avatar: '',
    userLevel: 1,
    signature: colleague.signature,
    location: colleague.location,
    momentBgUrl: '',
    birthday: '',
    emotionId: '',
    status: 'NORMAL',
    createdAt,
    updatedAt,
    deletedAt: null,
    emotionName: '',
    emotionUrl: '',
    remark: '',
    tag: colleague.departmentName,
    moment: null
  }
}

const users = new Map(colleagues.map((colleague) => [colleague.id, toUser(colleague)]))

export function getLocalFriendList(): Contact[] {
  return colleagues.map(toContact)
}

export function getLocalEnterpriseList(): Contact[] {
  return [
    {
      id: 'local-contact-enterprise-nxy',
      userId: '',
      peerId: LOCAL_ENTERPRISE_ID,
      remark: '',
      tag: '本地组织',
      isBack: true,
      isTop: false,
      isConcern: false,
      isMute: false,
      peerType: 'ENTERPRISE',
      status: 'NORMAL',
      createdAt,
      updatedAt,
      deletedAt: null,
      username: '',
      userLevel: 1,
      emotionName: '',
      emotionUrl: '',
      enterpriseName: enterpriseInfo.name,
      enterpriseMemberNum: enterpriseInfo.memberNum
    }
  ]
}

export function getLocalUser(userId: string): User | null {
  const user = users.get(userId)
  return user ? { ...user } : null
}

export function getLocalEnterprise(enterpriseId: string): EnterprisInfo | null {
  if (enterpriseId !== LOCAL_ENTERPRISE_ID) return null
  return {
    ...enterpriseInfo,
    userEnterpriseMembers: enterpriseInfo.userEnterpriseMembers.map((member) => ({ ...member }))
  }
}

export function getLocalEnterpriseDepartments(enterpriseId: string): EnterpriseDepartment[] | null {
  if (enterpriseId !== LOCAL_ENTERPRISE_ID) return null
  return departments.map((item) => ({ ...item, members: item.members?.map((member) => ({ ...member })) }))
}
