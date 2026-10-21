import { getLocalFriendList, getLocalUser } from './localContacts.ts'
import type { RagResult } from './ragChat.ts'

export const LOCAL_SELF_ID = 'local-directory-self'
export const CONTACT_KNOWLEDGE_KEY = 'em.contact-responsibilities.v1'

const defaultResponsibilities: Record<string, string> = {
  'local-colleague-lin-zhixia': '负责产品规划、需求优先级和产品方案评审。',
  'local-colleague-chen-cheng': '负责产品需求调研、业务流程梳理和需求文档。',
  'local-colleague-zhou-yu': '负责研发技术方案、数据库访问权限和数据表权限开通；数据库账号及访问关系请联系我审批。',
  'local-colleague-su-qing': '负责前端页面开发、交互实现和浏览器兼容性。',
  'local-colleague-luo-kai': '负责客户端应用开发与性能优化。',
  'local-colleague-chen-mo': '负责服务端接口开发、后端服务及接口故障排查。',
  'local-colleague-gao-yuan': '负责平台部署、自动化发布和系统运维。',
  'local-colleague-pei-ning': '负责测试计划、质量保障和缺陷验证。',
  'local-colleague-gu-yan': '负责设计规范和产品视觉体验。',
  'local-colleague-tang-ke': '负责界面视觉设计和设计资源制作。',
  'local-colleague-song-ran': '负责市场推广和对外合作。',
  'local-colleague-lu-yao': '负责客户成功、客户问题协调和培训。',
  'local-colleague-qiao-an': '负责人事行政、入职流程和团队支持。'
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
  '开通',
  '申请',
  '权限',
  '关系'
])

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
  const terms = keywords(question)
  if (!terms.length) return []
  const contacts = getLocalFriendList().map((contact) => ({
    userId: contact.peerId,
    name: contact.username,
    department: contact.tag,
    responsibility: getResponsibility(contact.peerId, storage)
  }))
  const selfWork = getResponsibility(LOCAL_SELF_ID, storage)
  if (selfWork) contacts.push({ userId: LOCAL_SELF_ID, name: '我', department: '个人主页', responsibility: selfWork })
  return contacts
    .map((contact) => ({
      ...contact,
      score: terms.reduce(
        (score, term) => score + (contact.responsibility.toLowerCase().includes(term) ? term.length : 0),
        0
      )
    }))
    .filter((contact) => contact.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

export function answerFromContactKnowledge(question: string, storage: Reader = localStorage): RagResult | null {
  const matches = findResponsibleContacts(question, storage)
  if (!matches.length) return null
  const primary = matches[0]
  const profile = getLocalUser(primary.userId)
  return {
    text: `根据本机人员职责知识库，${primary.name}${profile?.tag ? `（${profile.tag}）` : ''}负责相关工作。你可以通过下方名片查看职责并发送消息。`,
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
