export type RagIntent = 'people' | 'policy' | 'clarify'

export interface RagRoute {
  intent: RagIntent
  query: string
  explicit?: boolean
}

// Action words such as “申请/开通/审批” describe both people and policy questions.
// They are deliberately not sufficient to choose the people directory.
export function classifyRagIntent(input: string): RagRoute {
  const original = input.trim()
  const forced = /^(找人|查制度|查询制度|检索制度)\s*[:：]\s*([\s\S]*)$/.exec(original)
  if (forced) return { intent: forced[1] === '找人' ? 'people' : 'policy', query: forced[2].trim(), explicit: true }
  const query = original
    .replace(/(?:不要|不用|不想|不是要|不)(?:查(?:询)?|检索|搜索)(?:制度|政策)[,，\s]*/g, '')
    .replace(/(?:不要|不用|不想|不是要|不是|不)找人[,，\s]*/g, '')
    .trim()
  const policyTerms = /制度|政策|规定|办法|条例|条款|标准|流程|条件|材料|额度|期限|岗位职责|要求/
  const personRoleRequest = /(?:找|联系)[^，,。？?；;]*(?:同事|人员|负责人)(?:[。？?！!]|$)/.test(query)
  const personQuestion =
    /找谁|联系谁|问谁|由谁|谁(?:来|能|可以)?(?:负责|管|处理|开通|审批|审核|帮)|哪位|哪个同事|联系人|联系方式|名片/.test(
      query
    ) || personRoleRequest
  const personRequest =
    query
      .split(/[，,。？?；;]/)
      .some(
        (clause) => /(?:找|寻找|联系)(?:一下|一位|一个|个|位)?[^，,。？?；;]+/.test(clause) && !policyTerms.test(clause)
      ) || personRoleRequest
  const policyTarget = policyTerms.test(query)
  const policyRequest =
    /(?:查(?:询|阅)?|检索|搜索|找(?:一下)?|了解|解释|阅读|看看)[^，,。？?；;]*(?:制度|政策|规定|办法|条例|条款|标准|流程|条件|材料|额度|期限)/.test(
      query.replace(/(?:找|联系)[^，,。？?；;]*(?:同事|人员|负责人)/g, '')
    )
  const policyQuestion = /(?:什么|哪些|怎样|如何|怎么|多少|是否|能否|可不可以|能不能|几天|多久)/.test(query)
  const asksPolicyAuthority =
    /(?:(?:按|根据|依据).*(?:制度|政策|规定|办法|条例|条款)|(?:制度|政策|办法|条例|条款)(?:中|里)?(?:规定|明确|要求)).*(?:谁|哪位)/.test(
      query
    )

  if ((personQuestion || personRequest) && (policyRequest || (policyTarget && policyQuestion))) {
    // “制度规定谁审批” asks for an authoritative rule, not a guessed directory owner.
    if (asksPolicyAuthority && !/找谁|联系谁|名片/.test(query)) return { intent: 'policy', query }
    return { intent: 'clarify', query }
  }
  if (asksPolicyAuthority) return { intent: 'policy', query }
  if (/谁(?:可以|能|有资格|符合条件).*(?:申请|报销|享受)/.test(query)) return { intent: 'policy', query }
  if (personQuestion) return { intent: 'people', query }
  if (policyRequest || policyTarget || policyQuestion) return { intent: 'policy', query }
  if (personRequest) return { intent: 'people', query }
  return { intent: 'clarify', query }
}
