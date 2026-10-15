export const LOCAL_APPS_KEY = 'em.local-applications.v1'
export const DEFAULT_RAGFLOW = { url: 'http://127.0.0.1:8090/' }
export const MARKDOWN_AGENT_KEY = 'em.markdown-agent.v1'
export const DEFAULT_MARKDOWN_AGENT = { url: 'http://127.0.0.1:8092/' }
export function loadMarkdownAgent(storage: Pick<Storage, 'getItem'>) {
  const raw = storage.getItem(MARKDOWN_AGENT_KEY)
  if (!raw) return { ...DEFAULT_MARKDOWN_AGENT }
  const value = JSON.parse(raw)
  if (typeof value?.url !== 'string') throw new Error('智能体地址配置损坏，请重新设置。')
  return { url: validateApplicationUrl(value.url) }
}
export function validateApplicationUrl(value: string) {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('请输入完整的 HTTP(S) 网页地址。')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) {
    throw new Error('仅支持 HTTP(S) 地址；请勿在地址中包含账号、密码、密钥或查询参数。')
  }
  return url.toString()
}
export function loadRagflowLinks(storage: Pick<Storage, 'getItem'>) {
  const raw = storage.getItem(LOCAL_APPS_KEY)
  if (!raw) return { ...DEFAULT_RAGFLOW }
  const value = JSON.parse(raw)
  if (typeof value.url !== 'string') throw new Error('RAGFlow 地址配置损坏，请重新设置。')
  return { url: validateApplicationUrl(value.url) }
}
