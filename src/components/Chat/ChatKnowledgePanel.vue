<template>
  <NDrawer
    :show="true"
    :width="560"
    :theme-overrides="lightDrawerTheme"
    style="max-width: 100vw"
    @update:show="emit('close')">
    <NDrawerContent title="问问本群" closable>
      <div class="knowledge-panel">
        <p class="group-name">{{ groupName }}</p>
        <p class="intro">查找历史讨论、处理过程和事项进展。回答仅自己可见。</p>
        <div class="coverage" role="status">
          <template v-if="history">
            已读取本机 {{ history.messages.length }} 条可检索文本
            <template v-if="history.messages.length">
              <br />
              {{ history.messages[0].createdAt }} — {{ history.messages[history.messages.length - 1].createdAt }}
            </template>
            <br />
            {{
              history.limited ? '本次仅扫描最近 5000 条候选文本。' : ''
            }}本机记录不代表完整群历史；图片、语音、附件正文和 AI 回复不参与检索。
          </template>
          <template v-else>查询时读取本机已保存的群聊文本，不自动下载云端历史。</template>
        </div>
        <form @submit.prevent="ask">
          <label for="chat-history-question">想回顾什么事情？</label>
          <textarea
            id="chat-history-question"
            v-model="question"
            maxlength="500"
            rows="3"
            placeholder="例如：10.20.30.40 之前为什么不通？订单接口新增字段的事进展如何？"
            :disabled="busy" />
          <p class="disclosure">点击查询会将问题及检索到的片段发送给“总设置 → AI 模型”中配置的模型，用于生成回答。</p>
          <div class="actions">
            <button type="submit" class="primary" :disabled="busy || !question.trim()">查询群聊记录</button>
            <button v-if="busy" type="button" @click="stop">停止查询</button>
          </div>
        </form>
        <p v-if="stage" role="status">{{ stage }}</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <section v-if="answer" class="answer" aria-label="群聊回溯结果">
          <p class="disclosure">
            以下是截至所检索记录的整理，历史原因不代表本次原因，计划不代表已执行。请结合原消息核对。
          </p>
          <article v-for="(finding, index) in answer.findings" :key="index" class="finding">
            <span class="kind">{{ finding.kind }}</span>
            <p>{{ finding.text }}</p>
            <button
              v-for="ref in finding.sources"
              :key="ref"
              type="button"
              class="source-link"
              @click="viewSource(ref)">
              [{{ ref }}] 查看原消息
            </button>
          </article>
          <div v-if="answer.unknowns.length" class="unknowns">
            <strong>仍需确认</strong>
            <ul>
              <li v-for="item in answer.unknowns" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
        <section v-if="context.length" ref="contextElement" class="context" aria-label="原消息上下文">
          <div class="context-heading">
            <strong>原消息与相邻讨论</strong>
            <button type="button" @click="context = []">收起</button>
          </div>
          <p class="disclosure">相邻消息可能属于其他事项，请结合引用和内容判断。</p>
          <article v-for="message in context" :key="message.id" :class="{ selected: message.id === selectedId }">
            <small>{{ message.author }} · {{ message.createdAt }}</small>
            <p>{{ message.text }}</p>
            <button v-if="message.quoteId" type="button" class="source-link" @click="viewMessage(message.quoteId)">
              查看这条消息引用的原文
            </button>
          </article>
        </section>
        <details v-if="evidence.length" class="evidence">
          <summary>检索依据 · {{ evidence.length }} 条候选消息</summary>
          <p class="disclosure">关键词匹配及引用、相邻上下文，可能混有其他话题；未命中不代表群里没有讨论过。</p>
          <article v-for="source in evidence" :key="source.ref">
            <small>
              [{{ source.ref }}] {{ source.author }} · {{ source.createdAt }} · {{ reasons[source.reason] }}
            </small>
            <p>{{ source.text }}</p>
            <small v-if="source.truncated">长消息已截取，查看原消息可读取完整文本。</small>
            <button type="button" class="source-link" @click="viewSource(source.ref)">查看原消息与上下文</button>
          </article>
        </details>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { NDrawer, NDrawerContent } from 'naive-ui'
  import { API_KEY_KEY, CONFIG_KEY, requestAi, validateConfig } from '@/services/localChat'
  import {
    historyPrompts,
    parseHistoryAnswer,
    retrieveHistory,
    sameHistory,
    type ChatHistory,
    type HistoryAnswer,
    type HistoryEvidence,
    type HistoryMessage
  } from '@/services/chatKnowledge'
  import { historyContext } from '@/services/chatHistorySource'

  // This workspace panel intentionally stays bright even when the shell uses dark tokens.
  const lightDrawerTheme = {
    color: '#ffffff',
    textColor: '#263446',
    titleTextColor: '#193652',
    headerBorderBottom: '1px solid #e1e9f2',
    footerBorderTop: '1px solid #e1e9f2',
    closeIconColor: '#657589',
    closeIconColorHover: '#2875cb',
    closeIconColorPressed: '#1e5ea4',
    closeColorHover: '#edf4fc',
    closeColorPressed: '#e1edfa',
    boxShadow: '-8px 0 32px rgba(35, 68, 104, 0.12)',
    peers: { Scrollbar: { color: 'rgba(101, 117, 137, 0.3)', colorHover: 'rgba(101, 117, 137, 0.5)' } }
  }

  const props = defineProps<{
    groupName: string
    loadHistory: () => Promise<ChatHistory>
    revision: unknown
  }>()
  const emit = defineEmits<{ close: [] }>()
  const question = ref('')
  const history = ref<ChatHistory>()
  const evidence = ref<HistoryEvidence[]>([])
  const answer = ref<HistoryAnswer>()
  const context = ref<HistoryMessage[]>([])
  const selectedId = ref('')
  const contextElement = ref<HTMLElement>()
  const busy = ref(false)
  const stage = ref('')
  const error = ref('')
  const reasons = { match: '内容匹配', reply: '引用关联', context: '相邻上下文' }
  let controller: AbortController | undefined
  let generation = 0
  let contextRequest = 0

  function stop() {
    generation++
    contextRequest++
    controller?.abort()
    busy.value = false
    stage.value = '查询已停止。'
  }
  function invalidate() {
    stop()
    history.value = undefined
    answer.value = undefined
    evidence.value = []
    context.value = []
    error.value = ''
    stage.value = '群聊记录已变化，请重新查询。'
  }
  watch(() => props.revision, invalidate, { deep: true })
  onBeforeUnmount(stop)
  onMounted(async () => {
    const run = generation
    try {
      const snapshot = await props.loadHistory()
      if (run === generation) history.value = snapshot
    } catch (err) {
      if (run === generation) error.value = err instanceof Error ? err.message : '无法读取本机群聊记录。'
    }
  })

  async function ask() {
    if (busy.value || !question.value.trim()) return
    const run = ++generation
    contextRequest++
    controller?.abort()
    const request = new AbortController()
    controller = request
    busy.value = true
    error.value = ''
    answer.value = undefined
    evidence.value = []
    context.value = []
    stage.value = '正在本机检索相关讨论…'
    try {
      const snapshot = await props.loadHistory()
      if (run !== generation) return
      history.value = snapshot
      const sources = retrieveHistory(question.value.trim(), snapshot.messages)
      evidence.value = sources
      if (!sources.length) {
        stage.value = snapshot.messages.length
          ? '在本次扫描范围内未找到相关记录。请补充接口名、IP、需求名或其他关键词；这不代表群里没有讨论过。'
          : '本机暂无可检索的群聊文本。请先同步或打开历史消息后重试。'
        return
      }
      const stored = localStorage.getItem(CONFIG_KEY)
      if (!stored) throw new Error('请先在“总设置 → AI 模型”配置模型；也可以直接查看下方检索依据。')
      const config = validateConfig(JSON.parse(stored))
      stage.value = `已选取 ${sources.length} 条候选消息，正在整理进展并核对出处…`
      const raw = await requestAi(
        config,
        localStorage.getItem(API_KEY_KEY) || '',
        historyPrompts(question.value.trim(), sources, new Date().toISOString()),
        request.signal
      )
      if (run !== generation) return
      const result = parseHistoryAnswer(raw, sources)
      const fresh = await props.loadHistory()
      if (run !== generation) return
      if (!sameHistory(snapshot, fresh)) {
        invalidate()
        return
      }
      answer.value = result
      stage.value = '整理完成。每条事实可查看对应原消息。'
    } catch (err) {
      if (run !== generation) return
      error.value = err instanceof Error ? err.message : '查询失败，请重试。'
      stage.value = ''
    } finally {
      if (run === generation) busy.value = false
    }
  }

  async function viewSource(ref: string) {
    const source = evidence.value.find((item) => item.ref === ref)
    if (source) await viewMessage(source.id)
  }

  async function viewMessage(id: string) {
    if (!history.value) return
    const run = generation
    const contextRun = ++contextRequest
    try {
      const fresh = await props.loadHistory()
      if (run !== generation || contextRun !== contextRequest) return
      if (!sameHistory(history.value, fresh)) {
        invalidate()
        return
      }
      context.value = historyContext(fresh.messages, id)
      selectedId.value = id
      await nextTick()
      contextElement.value?.querySelector('.selected')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch (err) {
      if (run === generation && contextRun === contextRequest)
        error.value = err instanceof Error ? err.message : '原消息无法读取，请重新查询。'
    }
  }
</script>

<style scoped>
  .knowledge-panel {
    --text-primary-color: #263446;
    --text-secondary-color: #657589;
    --bg-primary-color: #ffffff;
    --bg-tertiary-color: #f1f6fc;
    --border-color: #d9e3ef;
    --primary-color: #2875cb;
    --error-color: #b63838;
    color-scheme: light;
    color: var(--text-primary-color, #263446);
    font-size: 14px;
    line-height: 1.7;
  }
  .group-name {
    font-size: 17px;
    font-weight: 600;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .intro {
    margin: 4px 0 16px;
  }
  .coverage,
  .unknowns {
    background: var(--bg-tertiary-color, rgba(100, 140, 180, 0.09));
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .coverage,
  .disclosure,
  small {
    font-size: 12px;
    color: var(--text-secondary-color, #657589);
    overflow-wrap: anywhere;
  }
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    resize: vertical;
    padding: 10px;
    border: 1px solid var(--border-color, #c7d1dd);
    border-radius: 8px;
    color: inherit;
    background: var(--bg-primary-color, transparent);
    font: inherit;
  }
  textarea::placeholder {
    color: #7b8b9e;
    opacity: 1;
  }
  textarea:focus-visible {
    outline: 2px solid #9ac4f3;
    outline-offset: 1px;
    border-color: #2875cb;
  }
  button {
    cursor: pointer;
    border: 1px solid var(--border-color, #c7d1dd);
    border-radius: 6px;
    padding: 5px 10px;
    color: inherit;
    background: transparent;
    font: inherit;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: #2875cb;
    border-color: #2875cb;
    color: white;
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  .error {
    color: var(--error-color, #c44747);
  }
  .finding,
  .evidence article,
  .context article {
    border-bottom: 1px solid var(--border-color, #dbe2eb);
    padding: 12px 0;
  }
  article p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 8px 0;
  }
  .kind {
    font-size: 12px;
    color: var(--primary-color, #2875cb);
    font-weight: 600;
  }
  .source-link {
    border: 0;
    color: var(--primary-color, #2875cb);
    font-size: 12px;
    padding: 3px 8px 3px 0;
  }
  .unknowns {
    margin-top: 16px;
  }
  ul {
    padding-left: 20px;
    margin-bottom: 0;
  }
  .context {
    border: 1px solid var(--border-color, #c7d1dd);
    border-radius: 8px;
    padding: 12px;
    margin: 18px 0;
  }
  .context-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .context .selected {
    background: rgba(40, 117, 203, 0.1);
    border-left: 3px solid #2875cb;
    padding-left: 10px;
  }
  .evidence {
    margin-top: 20px;
  }
  summary {
    cursor: pointer;
  }
</style>
