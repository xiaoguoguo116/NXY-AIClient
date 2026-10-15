<template>
  <div class="ai-model-settings">
    <header>
      <h2>全局模型设置</h2>
      <p>在此设置一次，所有本地聊天和群共用。保存后应用重启仍会保留。</p>
    </header>

    <SettingCard>
      <SettingRow label="接口基础地址" desc="兼容 OpenAI Chat Completions 的服务地址">
        <n-input v-model:value="config.baseUrl" placeholder="https://api.deepseek.com/v1" />
      </SettingRow>
      <SettingRow label="模型名称" desc="填写服务商提供的模型 ID">
        <n-input v-model:value="config.model" placeholder="例如 deepseek-flash" />
      </SettingRow>
      <SettingRow label="API 密钥" desc="保存在此电脑，所有会话共用；本机免鉴权接口可留空">
        <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="输入 API Key" />
      </SettingRow>
      <SettingRow label="携带最近消息条数" desc="0–30 条，每次提问时使用">
        <n-input-number v-model:value="config.contextCount" :min="0" :max="30" :precision="0" />
      </SettingRow>
    </SettingCard>

    <div class="ai-model-settings__actions">
      <span v-if="result" :class="{ success: result.startsWith('连接成功') || result === '全局模型设置已保存。' }" role="status">
        {{ result }}
      </span>
      <span v-else-if="testing" role="status">正在连接模型服务…（最多等待 30 秒）</span>
      <n-button v-if="testing" @click="cancelTest">取消测试</n-button>
      <n-button :loading="testing" :disabled="testing" @click="testConnection">测试连接</n-button>
      <n-button type="primary" @click="save">保存全局设置</n-button>
    </div>
    <p class="ai-model-settings__note">API 密钥存储在本机 EM 的 WebView 数据中，不会写入聊天记录或上传至 EM 服务端。</p>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, reactive, ref } from 'vue'
  import SettingCard from '@/components/Set/SettingCard.vue'
  import SettingRow from '@/components/Set/SettingRow.vue'
  import {
    API_KEY_KEY,
    CONFIG_KEY,
    DEFAULT_CONFIG,
    requestAi,
    validateConfig,
    type AiConfig
  } from '@/services/localChat'

  const config = reactive<AiConfig>({ ...DEFAULT_CONFIG })
  const apiKey = ref('')
  const result = ref('')
  const testing = ref(false)
  let testController: AbortController | undefined
  onBeforeUnmount(() => testController?.abort())

  try {
    const rawConfig = localStorage.getItem(CONFIG_KEY)
    if (rawConfig) Object.assign(config, validateConfig(JSON.parse(rawConfig)))
    apiKey.value = localStorage.getItem(API_KEY_KEY) || ''
  } catch {
    result.value = '现有全局模型设置无法读取，请检查接口地址和配置格式。'
  }

  function save() {
    try {
      const normalized = validateConfig(config)
      localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized))
      const key = apiKey.value.trim()
      if (key) localStorage.setItem(API_KEY_KEY, key)
      else localStorage.removeItem(API_KEY_KEY)
      Object.assign(config, normalized)
      result.value = '全局模型设置已保存。'
    } catch (error) {
      result.value = error instanceof Error ? error.message : '设置保存失败。'
    }
  }

  async function testConnection() {
    if (testing.value) return
    try {
      validateConfig(config)
    } catch (error) {
      result.value = error instanceof Error ? error.message : '请检查模型设置。'
      return
    }
    testing.value = true
    result.value = ''
    const controller = new AbortController()
    testController = controller
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const reply = await Promise.race([
        requestAi(
          { ...config },
          apiKey.value,
          [{ role: 'user', content: '连接测试，请只回复“连接成功”。' }],
          controller.signal,
          undefined,
          { connectionTest: true }
        ),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('EM_TEST_TIMEOUT'))
            controller.abort()
          }, 30_000)
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('EM_TEST_ABORTED')), { once: true })
        })
      ])
      result.value = `连接成功：${reply.slice(0, 100)}`
    } catch (error) {
      result.value = error instanceof Error && error.message === 'EM_TEST_TIMEOUT'
        ? '测试超时（30 秒），请检查接口地址、网络或代理设置。'
        : error instanceof Error && error.message === 'EM_TEST_ABORTED'
          ? '测试已取消。'
        : error instanceof Error && /^(模型接口|接口路径|请求过于|接口没有|请输入|云端接口|请填写|上下文|接口地址)/.test(error.message)
          ? error.message
          : '连接失败，请检查网络、接口地址、模型名称和 API 密钥。'
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      testController = undefined
      testing.value = false
    }
  }

  function cancelTest() {
    testController?.abort()
  }
</script>

<style scoped lang="scss">
  .ai-model-settings {
    padding: 22px 24px;

    header {
      margin-bottom: 18px;
    }

    h2 {
      margin: 0;
      color: var(--text-color);
      font-size: 18px;
      font-weight: 600;
    }

    header p,
    &__note {
      color: var(--text-secondary-color);
      font-size: 12px;
      line-height: 1.6;
    }

    header p {
      margin: 7px 0 0;
    }

    &__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;

      span {
        flex: 1;
        color: var(--red);
        font-size: 12px;
      }

      span.success {
        color: var(--primary-color);
      }
    }

    &__note {
      margin-top: 14px;
    }
  }
</style>
