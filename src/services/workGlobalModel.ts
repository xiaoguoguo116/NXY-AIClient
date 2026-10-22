import { API_KEY_KEY, CONFIG_KEY, validateConfig } from '@/services/localChat'

export interface WorkGlobalModel {
  baseUrl: string
  model: string
  apiKey: string
}

// Read at each task boundary. Never fall back to the old task-specific provider.
export function readWorkGlobalModel(): WorkGlobalModel {
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) throw new Error('WORK_PROVIDER_NOT_CONFIGURED')
  let config
  try {
    config = validateConfig(JSON.parse(raw))
  } catch {
    throw new Error('WORK_PROVIDER_NOT_CONFIGURED')
  }
  const apiKey = localStorage.getItem(API_KEY_KEY)?.trim() || ''
  if (new URL(config.baseUrl).hostname === 'api.deepseek.com' && !apiKey) {
    throw new Error('WORK_PROVIDER_KEY_REQUIRED')
  }
  return { baseUrl: config.baseUrl, model: config.model, apiKey }
}

// Only the digest belongs in session state; credentials are transient IPC data.
export async function workModelSignature(config: WorkGlobalModel): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}
