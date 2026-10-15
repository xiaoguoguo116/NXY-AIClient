<template>
  <section class="local-applications">
    <article v-if="matchesCompliance" class="ragflow-card">
      <div class="card-heading"><span class="app-logo">合</span><div><h3>合规工作台</h3><small>AI Work · 本地辅助审核</small></div><span class="local-badge">内置功能</span></div>
      <p>制度问答与原文定位、制度比对、文本合规初审、报送草稿。结果待人工审核。</p>
      <div class="tags"><span>原文溯源</span><span>条款比对</span><span>风险初审</span><span>Word 草稿</span></div>
      <div class="actions"><button class="primary" @click="router.push({ path: '/home/ai', query: { view: 'policy' } })">进入 AI Work</button></div>
    </article>
    <article v-if="matches" class="ragflow-card">
      <div class="card-heading">
        <span class="app-logo">R</span>
        <div>
          <h3>RAGFlow 知识助手</h3>
          <small>本机定制版 · 追问与知识检索</small>
        </div>
        <span class="local-badge">内嵌应用</span>
      </div>
      <p>打开已有的升级版 RAGFlow 前端，保留追问选项、召回块、耗时信息及云端历史会话。</p>
      <div class="tags">
        <span>追问选项</span>
        <span>召回块</span>
        <span>耗时信息</span>
        <span>会话历史</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!!opening" @click="launch">打开 RAGFlow</button>
        <button @click="edit = !edit">配置地址</button>
      </div>
      <form v-if="edit" @submit.prevent="save">
        <p class="hint">在 AI Work 内显示原前端，复用 RAGFlow 登录。地址仅保存在此电脑，不使用群聊 DeepSeek 密钥。</p>
        <label>
          RAGFlow 地址
          <input v-model="draft.url" required aria-label="RAGFlow 地址" />
        </label>
        <div class="actions">
          <button class="primary">保存地址</button>
          <button type="button" @click="edit = false">取消</button>
        </div>
      </form>
      <p v-if="status" role="status" class="status">{{ status }}</p>
    </article>
    <article v-if="matchesMarkdown" class="ragflow-card">
      <div class="card-heading">
        <span class="app-logo markdown-logo">MD</span>
        <div>
          <h3>Markdown 文档上传智能体</h3>
          <small>本机应用 · 文档上传</small>
        </div>
        <span class="local-badge">内嵌应用</span>
      </div>
      <p>在软件内直接使用 Markdown 文档上传智能体，无需切换浏览器。</p>
      <div class="tags"><span>Markdown</span><span>文档上传</span><span>智能体</span></div>
      <div class="actions">
        <button class="primary" @click="launchMarkdown">打开智能体</button>
        <button @click="markdownEdit = !markdownEdit">配置地址</button>
      </div>
      <form v-if="markdownEdit" @submit.prevent="saveMarkdown">
        <label>智能体地址<input v-model="markdownDraft" required aria-label="智能体地址" /></label>
        <div class="actions">
          <button class="primary">保存地址</button>
          <button type="button" @click="markdownEdit = false">取消</button>
        </div>
      </form>
      <p v-if="markdownStatus" role="status" class="status">{{ markdownStatus }}</p>
    </article>
    <p v-if="!matches && !matchesMarkdown && !matchesCompliance" class="hint">没有匹配的常用应用。</p>
    <p class="hint service-hint">文档上传智能体在应用中心内打开；需保持 8092 服务运行。</p>
    <p class="hint service-hint">RAGFlow 在 AI Work → 知识问答中使用；需保持本机服务运行。</p>
  </section>
</template>
<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  const router = useRouter()
  import {
    DEFAULT_RAGFLOW,
    DEFAULT_MARKDOWN_AGENT,
    MARKDOWN_AGENT_KEY,
    loadMarkdownAgent,
    LOCAL_APPS_KEY,
    loadRagflowLinks,
    validateApplicationUrl
  } from '@/services/localApplications'
  const props = defineProps<{ keyword: string }>()
  const matchesCompliance = computed(() => '合规 工作台 制度 问答 比对 初审 监管 报送 原文 溯源'.includes(props.keyword.trim().toLowerCase()))
  const emit = defineEmits<{ open: [url: string]; openMarkdown: [url: string] }>()
  const markdownUrl = ref(DEFAULT_MARKDOWN_AGENT.url)
  const markdownDraft = ref(DEFAULT_MARKDOWN_AGENT.url)
  const markdownEdit = ref(false)
  const markdownStatus = ref('')
  try {
    markdownUrl.value = loadMarkdownAgent(localStorage).url
    markdownDraft.value = markdownUrl.value
  } catch {
    markdownStatus.value = '原有地址配置无法读取，请重新配置并保存。'
  }
  const matchesMarkdown = computed(() =>
    'markdown md 文档 上传 智能体 agent'.includes(props.keyword.trim().toLowerCase())
  )
  function saveMarkdown() {
    try {
      const url = validateApplicationUrl(markdownDraft.value)
      localStorage.setItem(MARKDOWN_AGENT_KEY, JSON.stringify({ url }))
      markdownUrl.value = url
      markdownDraft.value = url
      markdownEdit.value = false
      markdownStatus.value = '地址已保存。'
    } catch (error) {
      markdownStatus.value = error instanceof Error ? error.message : '地址保存失败。'
    }
  }
  function launchMarkdown() {
    emit('openMarkdown', validateApplicationUrl(markdownUrl.value))
  }
  const links = reactive({ ...DEFAULT_RAGFLOW }),
    draft = reactive({ ...DEFAULT_RAGFLOW })
  const edit = ref(false),
    status = ref(''),
    opening = ref('')
  try {
    Object.assign(links, loadRagflowLinks(localStorage))
    Object.assign(draft, links)
  } catch {
    status.value = '原有地址配置无法读取，未覆盖。请配置并保存正确地址。'
  }
  const matches = computed(() =>
    'ragflow 知识助手 追问 澄清 知识库 问答 会话 历史'.includes(props.keyword.trim().toLowerCase())
  )
  function save() {
    try {
      const next = { url: validateApplicationUrl(draft.url) }
      localStorage.setItem(LOCAL_APPS_KEY, JSON.stringify(next))
      Object.assign(links, next)
      edit.value = false
      status.value = '地址已保存。'
    } catch (error) {
      status.value = error instanceof Error ? error.message : '地址保存失败。'
    }
  }
  function launch() {
    try {
      const url = validateApplicationUrl(links.url)
      emit('open', url)
    } catch {
      status.value = '地址无效，请重新配置 RAGFlow 地址。'
    }
  }
</script>
<style scoped>
  .local-applications {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 2px 4px 24px 0;
  }
  .ragflow-card {
    min-width: 0;
    align-self: start;
    border: 1px solid var(--border-color);
    border-radius: 9px;
    padding: 14px;
    background: var(--bg-primary-color);
    color: var(--text-color);
  }
  .card-heading {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-heading > div {
    min-width: 0;
  }
  .app-logo {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(145deg, #66baff, #2685ed);
    color: white;
    font: bold 24px sans-serif;
  }
  .card-heading h3 {
    font-size: 14px;
    margin: 0 0 4px;
  }
  .markdown-logo {
    background: linear-gradient(145deg, #5ddcc2, #18a999);
    font-size: 18px;
  }
  .card-heading small,
  .hint {
    color: var(--text-muted-color);
    font-size: 11px;
    line-height: 1.6;
  }
  .local-badge {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 10px;
    color: #1769c6;
    background: #edf4ff;
    padding: 3px 7px;
    border-radius: 12px;
  }
  .ragflow-card > p {
    font-size: 12px;
    line-height: 1.5;
    min-height: 36px;
    margin: 10px 0;
    color: var(--text-muted-color);
  }
  .tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .tags span {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 5px;
    background: #edf4ff;
    color: #1769c6;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
  }
  button {
    font: inherit;
    font-size: 12px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    padding: 5px 10px;
    background: #fff;
    color: var(--text-color);
    cursor: pointer;
  }
  button:hover {
    border-color: #2685ed;
  }
  button:focus-visible {
    outline: 2px solid #2685ed;
    outline-offset: 2px;
  }
  button.primary {
    background: #2685ed;
    color: white;
    border-color: #2685ed;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  form {
    margin-top: 14px;
    border-top: 1px solid var(--border-color);
  }
  label {
    display: block;
    margin: 12px 0;
    font-size: 12px;
  }
  input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary-color);
    color: var(--text-color);
  }
  .status {
    color: #1769c6;
    font-size: 12px;
  }
  .service-hint {
    grid-column: 1/-1;
    margin: 0;
  }
  @media (max-width: 640px) {
    .local-applications {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
