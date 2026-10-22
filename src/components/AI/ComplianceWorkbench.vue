<template>
  <section class="compliance-workbench">
    <header class="cw-heading">
      <div>
        <h2>{{ MODE_LABELS[mode] }}</h2>
        <p>证据可追溯 · 原文可核验 · 结果待人工审核</p>
      </div>
      <button @click="showLibrary = !showLibrary">
        {{ showLibrary ? '收起资料库' : '管理资料库' }}（{{ documents.length }}）
      </button>
    </header>
    <p class="cw-notice">
      本地试用版：资料与审核记录保存在此电脑，非正式合规结论。使用独立本地资料库，尚不自动同步 RAGFlow
      全库或监管更新。引用校验仅确认原文一致性，不代表结论或适用性已获审核。
    </p>
    <p v-if="error" class="cw-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <section v-if="showLibrary" class="cw-card">
      <h3>添加依据文件 / 业务材料 / 报送模板</h3>
      <p class="cw-muted">
        文件在本机解析并保留原件。PDF 保留页码；Word 以提取文本段落定位，不保留原始页码。扫描文件请先 OCR；Word
        修订痕迹、文本框等内容需人工核对。
      </p>
      <div class="cw-grid">
        <label>
          类型
          <select v-model="form.kind" aria-label="类型">
            <option v-for="k in kinds" :key="k">{{ k }}</option>
          </select>
        </label>
        <label>
          文件名称
          <input v-model="form.name" aria-label="资料名称" />
        </label>
        <label>
          文号
          <input v-model="form.number" placeholder="按原文登记，不自动编造" />
        </label>
        <label>
          发布机构
          <input v-model="form.issuer" />
        </label>
        <label>
          版本
          <input v-model="form.version" />
        </label>
        <label>
          生效日期
          <input v-model="form.effective" type="date" />
        </label>
        <label>
          失效日期（可空）
          <input v-model="form.expires" type="date" />
        </label>
        <label>
          适用对象 / 范围
          <input v-model="form.scope" />
        </label>
      </div>
      <label>
        选择文件
        <input type="file" accept=".txt,.md,.docx,.pdf" :disabled="busy || importing" @change="chooseFile" />
      </label>
      <label>
        或粘贴全文
        <textarea
          v-model="pasted"
          rows="5"
          aria-label="资料全文"
          placeholder="报送模板可用 {{指标名称}} 占位符，例如 {{报告期}}。"
          :disabled="!!pendingFile" />
      </label>
      <button class="cw-primary" :disabled="busy || importing" @click="addDocument">
        {{ importing ? '正在解析…' : '保存资料到本机' }}
      </button>
      <div v-for="doc in documents" :key="doc.id" class="cw-library-item">
        <span>{{ doc.kind }} · {{ doc.name }} · {{ doc.number || '文号未登记' }} · {{ doc.paragraphs.length }} 段</span>
        <button @click="openSource(doc, doc.paragraphs[0]?.id)">查看原文</button>
      </div>
    </section>
    <div class="cw-columns">
      <section class="cw-card cw-input">
        <h3>本次任务</h3>
        <label>
          适用日期
          <input v-model="applicableDate" type="date" />
        </label>
        <fieldset>
          <legend>
            {{
              mode === 'compare'
                ? '选择两份文件（依次为基准 / 新版或待检查制度）'
                : mode === 'report'
                  ? '选择报送模板与参考材料'
                  : '选择依据和材料'
            }}
          </legend>
          <label v-for="doc in documents" :key="doc.id" class="cw-check">
            <input v-model="selectedIds" type="checkbox" :value="doc.id" :disabled="busy" />
            {{ doc.name }}
            <small>{{ doc.kind }}</small>
          </label>
          <p v-if="!documents.length">暂无资料，请先在上方资料库上传或粘贴文件。</p>
        </fieldset>
        <label v-if="mode === 'review'">
          待审业务材料
          <select v-model="targetId" aria-label="待审业务材料">
            <option value="">请选择</option>
            <option v-for="doc in selectedDocs" :key="doc.id" :value="doc.id">{{ doc.name }}</option>
          </select>
        </label>
        <label>
          {{ mode === 'policy' ? '查询问题（说明机构类型、业务范围和时点）' : '任务说明' }}
          <textarea v-model="question" rows="4" aria-label="合规任务说明" :placeholder="hints[mode]" />
        </label>
        <template v-if="mode === 'report'">
          <label>
            本期指标 JSON（包含单位、期间和数据来源）
            <textarea v-model="metricText" rows="7" aria-label="报送指标" />
          </label>
          <p v-pre class="cw-muted">
            模板使用 {{ 指标名 }} 占位符可精确填值；缺项标记待补充。导入指标不会自动审计其真实性。
          </p>
          <button :disabled="busy" @click="templateOnly">仅填充模板（不调用模型）</button>
        </template>
        <label class="cw-check cw-consent">
          <input v-model="consent" type="checkbox" :disabled="busy" />
          我有权处理这些资料，并允许将本次选中的文本和指标发送到全局模型服务（{{
            modelHost
          }}）。如不允许出域，请先配置获准的私有模型。
        </label>
        <div class="cw-actions">
          <button class="cw-primary" :disabled="busy || importing || !consent" @click="run">
            {{ busy ? '正在分析…' : '开始分析' }}
          </button>
          <button v-if="busy" @click="controller?.abort()">取消</button>
        </div>
        <h3>本机历史</h3>
        <button
          v-for="r in history.filter((r) => r.mode === mode)"
          :key="r.id"
          class="cw-history"
          :disabled="busy"
          @click="result = r">
          {{ displayTime(r.createdAt) }} · {{ r.question.slice(0, 28) }}
        </button>
      </section>
      <section class="cw-card cw-results">
        <template v-if="result && result.mode === mode">
          <div class="cw-actions">
            <h3>结果 · 待人工审核</h3>
            <button @click="saveResult">保存审核与草稿</button>
            <button @click="downloadResult">导出 Word</button>
          </div>
          <p class="cw-muted">
            {{ result.coverage }} · 适用日期：{{ result.applicableDate || '未登记' }} · 模型：{{ result.model }}
          </p>
          <p v-for="w in result.warnings" :key="w" class="cw-warning">{{ w }}</p>
          <p class="cw-pre">{{ result.summary }}</p>
          <article v-for="(f, i) in result.findings" :key="i" class="cw-finding">
            <h4>{{ i + 1 }}. {{ f.title }}</h4>
            <p class="cw-pre">{{ f.detail }}</p>
            <p class="cw-pre">建议：{{ f.suggestion || '待人工补充' }}</p>
            <p v-if="!f.refs.length" class="cw-warning">未附可验证依据，不可直接作为合规结论。</p>
            <div v-for="(ref, ri) in f.refs" :key="ri" class="cw-evidence">
              <button v-if="ref.valid" @click="openReference(ref.id)">{{ referenceLabel(ref.id) }} ↗</button>
              <strong v-else class="cw-error">引用未通过原文校验</strong>
              <blockquote>{{ ref.quote }}</blockquote>
            </div>
            <label>
              人工处理
              <select v-model="f.state" aria-label="人工处理">
                <option>待审核</option>
                <option>已接受</option>
                <option>已忽略</option>
              </select>
            </label>
            <input v-model="f.note" placeholder="审核人 / 修改理由 / 待核实事项（本地记录，非签章）" />
          </article>
          <label>
            可编辑草稿
            <textarea v-model="result.draft" rows="15" aria-label="合规草稿" />
          </label>
          <details v-if="result.metrics">
            <summary>本期指标原值</summary>
            <dl>
              <template v-for="(v, k) in result.metrics" :key="k">
                <dt>{{ k }}</dt>
                <dd>{{ v }}</dd>
              </template>
            </dl>
          </details>
        </template>
        <div v-else class="cw-empty">
          <h3>从一份有依据的结果开始</h3>
          <p>选择材料并填写任务后，结果将在这里显示。引用链接会在软件内打开对应原文段落。</p>
          <p>没有依据的内容将提示待核实，不会自动成为合规结论。</p>
        </div>
      </section>
    </div>
    <div v-if="source" class="cw-source-backdrop" @click.self="source = undefined">
      <section class="cw-source" role="dialog" aria-label="原文溯源" aria-modal="true">
        <header>
          <h3>{{ source.name }}</h3>
          <button @click="source = undefined">关闭原文</button>
        </header>
        <p>
          {{ source.number || '文号未登记' }} · {{ source.issuer }} · 版本 {{ source.version || '未登记' }} · 生效
          {{ source.effective || '未登记' }}
        </p>
        <p>适用范围：{{ source.scope || '未登记，请核实' }}</p>
        <button v-if="source.original" @click="downloadOriginal">保存原始文件</button>
        <p class="cw-muted">下方为导入时的原文文本快照；高亮段落为引用定位。版式和签章请核对原始文件。</p>
        <div class="cw-source-text">
          <p
            v-for="(p, i) in source.paragraphs"
            :id="`source-${p.id}`"
            :key="p.id"
            :class="{ cited: p.id === activeParagraph }">
            <small>{{ p.page ? `第 ${p.page} 页 · ` : '' }}段落 {{ i + 1 }}</small>
            <br />
            {{ p.text }}
          </p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
  import { API_KEY_KEY, CONFIG_KEY, DEFAULT_CONFIG, requestAi } from '@/services/localChat'
  import {
    MODE_LABELS,
    buildWorkRequest,
    fillTemplate,
    listRecords,
    parseMetrics,
    parseWorkResult,
    persistRecord,
    scanRiskPhrases,
    splitParagraphs,
    validateDocuments,
    type DocumentKind,
    type PolicyDocument,
    type WorkMode,
    type WorkResult
  } from '@/services/compliance'
  import { downloadBlob, exportWork, extractDocument, sourceLabel } from '@/services/complianceFiles'
  const props = defineProps<{ mode: WorkMode }>()
  const kinds: DocumentKind[] = ['监管文件', '内部制度', '业务材料', '报送模板']
  const hints = {
    policy: '支付机构申请接入，需要哪些材料、核查要点和时限？',
    compare: '请对照新监管文件，列出内部制度疑似冲突和待核实缺口。',
    review: '请初审这份对外业务方案，检查承诺措辞与依据是否一致。',
    report: '生成季度报告初稿，缺失数据明确标记待补充。'
  }
  const form = reactive({
    name: '',
    number: '',
    issuer: '',
    version: '',
    effective: '',
    expires: '',
    scope: '',
    kind: '监管文件' as DocumentKind
  })
  const documents = ref<PolicyDocument[]>([]),
    history = ref<WorkResult[]>([]),
    selectedIds = ref<string[]>([])
  const selectedDocs = computed(() =>
    selectedIds.value.map((id) => documents.value.find((d) => d.id === id)!).filter(Boolean)
  )
  const question = ref(''),
    targetId = ref(''),
    consent = ref(false),
    busy = ref(false),
    importing = ref(false),
    showLibrary = ref(false)
  const error = ref(''),
    notice = ref(''),
    pasted = ref(''),
    pendingFile = ref<File>(),
    result = ref<WorkResult>(),
    source = ref<PolicyDocument>(),
    activeParagraph = ref('')
  const applicableDate = ref(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }))
  const displayTime = (value: string) =>
    new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  const metricText = ref('{\n  "报告期": "请填写",\n  "交易笔数": "请填写数值和单位",\n  "数据来源": "请填写"\n}')
  const modelBaseUrl = ref('')
  const modelHost = computed(() => {
    try {
      return new URL(modelBaseUrl.value).host
    } catch {
      return '未配置，请到全局模型设置配置'
    }
  })
  function refreshModel() {
    try {
      const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}').baseUrl || ''
      if (value !== modelBaseUrl.value) {
        modelBaseUrl.value = value
        consent.value = false
      }
    } catch {
      modelBaseUrl.value = ''
      consent.value = false
    }
  }
  let controller: AbortController | undefined
  watch(
    () => props.mode,
    () => {
      controller?.abort()
      consent.value = false
      error.value = ''
      notice.value = ''
    }
  )
  watch(
    [selectedIds, question, metricText, targetId, applicableDate],
    () => {
      consent.value = false
    },
    { deep: true }
  )
  onBeforeUnmount(() => {
    controller?.abort()
    window.removeEventListener('focus', refreshModel)
    window.removeEventListener('storage', refreshModel)
  })
  let libraryLoaded = false
  async function refreshLibrary() {
    try {
      documents.value = await listRecords('documents')
      history.value = (await listRecords<WorkResult>('results')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (!libraryLoaded) showLibrary.value = !documents.value.length
      libraryLoaded = true
    } catch {
      error.value = '本地资料库无法读取，请检查磁盘空间和应用存储权限。'
    }
  }
  onMounted(async () => {
    refreshModel()
    window.addEventListener('focus', refreshModel)
    window.addEventListener('storage', refreshModel)
    await refreshLibrary()
  })
  onActivated(() => {
    refreshModel()
    if (libraryLoaded) void refreshLibrary()
  })
  function chooseFile(e: Event) {
    pendingFile.value = (e.target as HTMLInputElement).files?.[0]
    if (pendingFile.value && !form.name) form.name = pendingFile.value.name
  }
  async function addDocument() {
    error.value = ''
    importing.value = true
    try {
      if (!form.name.trim()) throw new Error('请填写文件名称。')
      if (form.effective && form.expires && form.expires <= form.effective)
        throw new Error('失效日期必须晚于生效日期。')
      if (documents.value.length >= 100) throw new Error('本地试用版最多保存 100 份文件。')
      const id = crypto.randomUUID(),
        file = pendingFile.value
      if (!file && pasted.value.length > 300000) throw new Error('粘贴文本超过 30 万字符，请分卷处理。')
      const paragraphs = file ? await extractDocument(file, id) : splitParagraphs(pasted.value, id)
      if (!paragraphs.length) throw new Error('请选择文件或粘贴正文。')
      const doc: PolicyDocument = {
        ...form,
        name: form.name.trim(),
        id,
        createdAt: new Date().toISOString(),
        paragraphs,
        original: file || new Blob([pasted.value], { type: 'text/plain;charset=utf-8' }),
        filename: file?.name || `${form.name}.txt`
      }
      await persistRecord('documents', doc)
      documents.value.push(doc)
      selectedIds.value.push(id)
      pasted.value = ''
      pendingFile.value = undefined
      Object.assign(form, { name: '', number: '', issuer: '', version: '', effective: '', expires: '', scope: '' })
      notice.value = '资料和原件已保存到此电脑；请在原文中核对解析完整性。'
    } catch (e) {
      error.value = e instanceof Error ? e.message : '资料保存失败'
    } finally {
      importing.value = false
    }
  }
  async function record(r: WorkResult) {
    await persistRecord('results', r)
    result.value = r
    history.value = [r, ...history.value.filter((x) => x.id !== r.id)]
  }
  async function run() {
    if (busy.value || !consent.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    const mode = props.mode
    controller = new AbortController()
    try {
      if (!question.value.trim()) throw new Error('请填写问题或任务说明。')
      const submittedQuestion = question.value,
        submittedDate = applicableDate.value,
        submittedTarget = targetId.value
      const docs = structuredClone(toRaw(selectedDocs.value).map((d) => toRaw(d)))
      const metrics = mode === 'report' ? parseMetrics(metricText.value) : undefined
      if (mode === 'report' && !docs.some((d) => d.kind === '报送模板')) throw new Error('请至少选择一份报送模板。')
      const req = buildWorkRequest(mode, docs, submittedQuestion, submittedDate, submittedTarget, metrics)
      const config = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }
      if (config.baseUrl !== modelBaseUrl.value) {
        refreshModel()
        throw new Error('模型服务地址已变化，请重新确认材料发送授权。')
      }
      const raw = await requestAi(config, localStorage.getItem(API_KEY_KEY) || '', req.messages, controller.signal)
      if (controller.signal.aborted) return
      const parsed = parseWorkResult(raw, docs)
      if (mode === 'review') {
        const target = docs.find((d) => d.id === submittedTarget)
        if (target) parsed.findings = [...scanRiskPhrases(target), ...parsed.findings]
      }
      await record({
        ...parsed,
        id: crypto.randomUUID(),
        mode,
        createdAt: new Date().toISOString(),
        question: submittedQuestion,
        applicableDate: submittedDate,
        documents: docs,
        warnings: [
          ...req.warnings,
          ...parsed.warnings,
          ...(mode === 'report' ? ['模型草稿中的数字、口径与结论须逐项核对本期指标；缺失数据不得用于正式报送。'] : [])
        ],
        model: config.model,
        metrics,
        coverage: req.coverage
      })
      notice.value = '结果已保存到本机。请核验引用并人工审核，不能直接用于正式报送或合规认定。'
    } catch (e) {
      error.value = e instanceof Error ? e.message : '分析失败，请重试。'
    } finally {
      busy.value = false
      controller = undefined
    }
  }
  async function templateOnly() {
    error.value = ''
    try {
      const metrics = parseMetrics(metricText.value),
        docs = structuredClone(selectedDocs.value.map((d) => toRaw(d)))
      const templates = docs.filter((d) => d.kind === '报送模板')
      if (templates.length !== 1) throw new Error('精确填充请仅选择一份报送模板。')
      const text = templates[0].paragraphs.map((p) => p.text).join('\n\n')
      if (!/\{\{[^{}]+\}\}/.test(text))
        throw new Error('模板未包含 {{指标名}} 占位符，无法安全替换历史数字。请上传带占位符的模板。')
      await record({
        id: crypto.randomUUID(),
        mode: 'report',
        createdAt: new Date().toISOString(),
        applicableDate: applicableDate.value,
        question: question.value || '精确填充报送模板',
        summary: '已按指标名称精确填充，未调用模型。',
        findings: [],
        draft: fillTemplate(text, metrics),
        documents: docs,
        warnings: [
          ...validateDocuments(docs, applicableDate.value),
          '模板中的固定数字未自动替换，请核对是否包含历史期间或示例数据。'
        ],
        model: '本地模板填充',
        metrics,
        coverage: '完整模板，占位符逐项填充，缺失项显式标记'
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '模板填充失败'
    }
  }
  async function saveResult() {
    try {
      if (result.value) {
        await persistRecord('results', toRaw(result.value))
        notice.value = '人工处理状态和草稿已保存。'
      }
    } catch {
      error.value = '保存失败，请检查磁盘空间。'
    }
  }
  async function downloadResult() {
    try {
      if (result.value) await exportWork(result.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导出失败'
    }
  }
  async function openSource(doc: PolicyDocument, id?: string) {
    source.value = doc
    activeParagraph.value = id || ''
    await nextTick()
    document.getElementById(`source-${id}`)?.scrollIntoView({ block: 'center' })
  }
  function openReference(id: string) {
    const doc = result.value?.documents.find((d) => d.paragraphs.some((p) => p.id === id))
    if (doc) void openSource(doc, id)
  }
  function referenceLabel(id: string) {
    const doc = result.value?.documents.find((d) => d.paragraphs.some((p) => p.id === id))
    return doc ? sourceLabel(doc, id) : '未知来源'
  }
  function downloadOriginal() {
    if (source.value?.original) downloadBlob(source.value.original, source.value.filename || `${source.value.name}.txt`)
  }
</script>

<style scoped>
  .compliance-workbench {
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 24px;
    background: #f5f8fe;
    color: #273c56;
    box-sizing: border-box;
    font-size: 14px;
  }
  .cw-heading,
  .cw-actions,
  .cw-source header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .cw-heading h2 {
    font-size: 24px;
    margin: 0;
  }
  .cw-heading p,
  .cw-muted {
    color: #71839c;
    line-height: 1.7;
  }
  .cw-notice {
    background: #eaf3ff;
    padding: 12px 16px;
    border-radius: 10px;
    line-height: 1.7;
  }
  .cw-columns {
    display: grid;
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .cw-card {
    border: 1px solid #dbe5f2;
    border-radius: 14px;
    padding: 20px;
    background: white;
    margin-bottom: 18px;
    min-width: 0;
  }
  .cw-card h3 {
    margin: 0 0 16px;
    font-size: 17px;
  }
  .cw-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .compliance-workbench label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 14px;
    line-height: 1.6;
  }
  .compliance-workbench input:not([type='checkbox']),
  .compliance-workbench select,
  .compliance-workbench textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1deed;
    border-radius: 7px;
    padding: 9px;
    background: #fff;
    color: #263b54;
    font: inherit;
  }
  .compliance-workbench textarea {
    resize: vertical;
    line-height: 1.7;
  }
  .compliance-workbench button {
    border: 1px solid #d4e3f4;
    background: #fff;
    border-radius: 7px;
    padding: 8px 12px;
    color: #256bb4;
    cursor: pointer;
    font: inherit;
  }
  .compliance-workbench button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .compliance-workbench .cw-primary {
    background: #2784ed;
    color: #fff;
    border-color: #2784ed;
  }
  .compliance-workbench .cw-check {
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }
  .cw-check input {
    margin-top: 4px;
  }
  .cw-check small {
    color: #7a8ca3;
  }
  .cw-consent {
    background: #fff8e8;
    padding: 12px;
    border-radius: 8px;
    font-size: 12px;
  }
  .compliance-workbench fieldset {
    border: 1px solid #dbe5f2;
    border-radius: 8px;
    padding: 12px;
    margin: 12px 0 18px;
    max-height: 240px;
    overflow: auto;
  }
  .cw-library-item {
    padding: 12px 0;
    border-bottom: 1px solid #edf1f7;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .cw-error {
    color: #be3b40;
  }
  .cw-warning {
    color: #966323;
    background: #fff6df;
    padding: 9px;
    border-radius: 6px;
    line-height: 1.7;
  }
  .cw-finding {
    border: 1px solid #e0e9f4;
    border-radius: 10px;
    padding: 16px;
    margin: 14px 0;
  }
  .cw-finding h4 {
    margin: 0 0 10px;
  }
  .cw-evidence {
    background: #f5f9ff;
    padding: 10px;
    margin: 10px 0;
    border-radius: 8px;
  }
  .cw-evidence button {
    max-width: 100%;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .cw-evidence blockquote {
    white-space: pre-wrap;
    margin: 10px 0 0;
    padding-left: 12px;
    border-left: 3px solid #80b4ef;
    color: #58708b;
  }
  .cw-pre {
    white-space: pre-wrap;
    line-height: 1.9;
  }
  .cw-history {
    display: block;
    width: 100%;
    text-align: left;
    margin: 8px 0;
  }
  .cw-input h3:not(:first-child) {
    margin-top: 25px;
  }
  .cw-empty {
    padding: 60px 20px;
    line-height: 1.9;
    color: #71839c;
  }
  .cw-source-backdrop {
    position: fixed;
    inset: 0;
    background: #1c365b55;
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
  }
  .cw-source {
    width: min(760px, 90vw);
    height: 100%;
    box-sizing: border-box;
    background: white;
    padding: 24px;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 28px #1d3d5a22;
  }
  .cw-source-text {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .cw-source-text p {
    white-space: pre-wrap;
    line-height: 1.9;
    padding: 14px;
    border-radius: 8px;
    overflow-wrap: anywhere;
  }
  .cw-source-text small {
    color: #8292a6;
  }
  .cw-source-text .cited {
    background: #fff1b8;
    border: 1px solid #e4c75d;
  }
  .cw-source h3 {
    margin: 0;
  }
  .cw-source > p {
    line-height: 1.7;
  }
  @media (max-width: 1000px) {
    .cw-columns {
      grid-template-columns: 280px minmax(0, 1fr);
    }
    .compliance-workbench {
      padding: 14px;
    }
    .cw-card {
      padding: 14px;
    }
    .cw-actions {
      flex-wrap: wrap;
    }
  }
</style>
