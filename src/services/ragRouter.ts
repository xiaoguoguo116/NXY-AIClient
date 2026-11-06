import { answerFromContactKnowledge } from './contactKnowledge.ts'
import { classifyRagIntent } from './ragIntent.ts'
import { requestRag, type RagResult } from './ragChat.ts'

type RoutingOptions = {
  storage?: Pick<Storage, 'getItem'>
  previous?: RagResult
  selection?: { cache_id: string; option_id: string }
  onText?: (text: string) => void
}

function localReply(text: string, intent: 'people' | 'clarify', query: string): RagResult {
  return {
    text,
    baseUrl: 'local-contact-knowledge',
    chatId: 'contact-responsibilities',
    sessionId: '',
    references: [],
    options: [],
    routing: { intent, query }
  }
}

export async function requestRoutedRag(
  question: string,
  signal: AbortSignal,
  options: RoutingOptions = {},
  policyRequest: typeof requestRag = requestRag
): Promise<RagResult> {
  if (signal.aborted) throw new Error('RAGFlow：请求已停止。')
  if (!question.trim() || question.length > 12000) throw new Error('RAGFlow：请输入 1–12000 字的问题。')
  const previous = options.previous
  const localPrevious = previous?.baseUrl === 'local-contact-knowledge'
  if (
    localPrevious &&
    previous.routing &&
    /^(找人|找负责人|查制度|制度|查办理规定)[。！!？?]*$/.test(question.trim())
  ) {
    question = `${question.startsWith('找') ? '找人' : '查制度'}：${previous.routing.query}`
  }
  let route = classifyRagIntent(question)
  if (!route.query) throw new Error('RAGFlow：请补充要查找的岗位、业务或制度。')
  // A selected clarification belongs to its originating policy session, even
  // when its wording contains person-like phrases such as “由谁审批”.
  const policySelection =
    previous &&
    !localPrevious &&
    !route.explicit &&
    options.selection?.cache_id === previous.cacheId &&
    previous.options.some((option) => option.id === options.selection?.option_id && option.question === question)
  if (policySelection) route = { ...route, intent: 'policy' }
  if (route.intent === 'clarify' && previous && !route.explicit) {
    if (!localPrevious) route = { ...route, intent: 'policy' }
    else if (previous.routing?.intent === 'people') route = { ...route, intent: 'people' }
  }
  if (route.intent === 'policy') {
    const result = await policyRequest(route.query, signal, {
      ...(options.onText ? { onText: options.onText } : {}),
      ...(options.storage ? { storage: options.storage } : {}),
      ...(!localPrevious ? { previous, selection: options.selection } : {})
    })
    return { ...result, routing: { intent: 'policy', query: route.query } }
  }
  if (route.intent === 'people') {
    const answer = answerFromContactKnowledge(`找人：${route.query}`, options.storage)
    if (answer) return { ...answer, routing: { intent: 'people', query: route.query } }
    return {
      ...localReply(
        '暂时没有找到足够明确的联系人。请补充具体岗位、姓名或工作事项，例如“找产品经理”或“数据库访问权限找谁开通”。仅提供部门或宽泛范围时，请再说明要办理的业务。',
        'people',
        route.query
      ),
      needsInput: true
    }
  }
  return {
    ...localReply(
      '你想找负责此事的同事，还是查询相关制度和办理规定？请选择一个方向，也可以分别提问。',
      'clarify',
      route.query
    ),
    mode: 'intent',
    needsInput: true,
    options: [
      { id: 'people', question: `找人：${route.query}` },
      { id: 'policy', question: `查制度：${route.query}` }
    ]
  }
}
