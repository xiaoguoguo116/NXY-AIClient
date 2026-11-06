<template>
  <section class="document-diff" aria-label="制度原文差异">
    <header>
      <div>
        <h3>原文差异</h3>
        <p>红色 − 删除 · 绿色 + 新增 · 黄色行标记修改；文字差异不等于合规结论。</p>
      </div>
      <label>
        <input v-model="changesOnly" type="checkbox" />
        只看差异
      </label>
      <span class="diff-count">
        {{ counts.modified }} 处修改 · {{ counts.added }} 行新增 · {{ counts.removed }} 行删除
      </span>
    </header>
    <div class="diff-titles">
      <strong>基准 / 旧版：{{ leftName }}</strong>
      <strong>新版 / 待比对：{{ rightName }}</strong>
    </div>
    <p v-if="!rows.some((row) => row.kind !== 'same')" class="diff-empty">两份文件的提取文本一致，没有文字差异。</p>
    <div class="diff-scroll" tabindex="0" aria-label="左右原文对照，可滚动查看">
      <div v-for="(row, i) in visibleRows" :key="i" class="diff-row" :class="`diff-${row.kind}`">
        <div class="diff-cell diff-left">
          <small>{{ row.leftLine ?? '' }}</small>
          <b>{{ row.kind !== 'same' && row.leftLine ? '−' : '' }}</b>
          <pre><template v-for="(part, j) in row.left" :key="j"><mark v-if="part.changed">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></pre>
        </div>
        <div class="diff-cell diff-right">
          <small>{{ row.rightLine ?? '' }}</small>
          <b>{{ row.kind !== 'same' && row.rightLine ? '+' : '' }}</b>
          <pre><template v-for="(part, j) in row.right" :key="j"><mark v-if="part.changed">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></pre>
        </div>
      </div>
    </div>
    <p class="diff-footnote">
      按提取文本逐行比较，保留全文；不包含 Word 版式、批注或修订记录。段落移位可能显示为删除和新增。
    </p>
  </section>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { compareDocumentText } from '@/services/documentDiff'
  const props = defineProps<{ left: string; right: string; leftName: string; rightName: string }>()
  const changesOnly = ref(false)
  const rows = computed(() => compareDocumentText(props.left, props.right))
  const visibleRows = computed(() => (changesOnly.value ? rows.value.filter((row) => row.kind !== 'same') : rows.value))
  const counts = computed(() =>
    rows.value.reduce(
      (total, row) => {
        if (row.kind !== 'same') total[row.kind]++
        return total
      },
      { added: 0, removed: 0, modified: 0 }
    )
  )
</script>
<style scoped>
  .document-diff {
    border: 1px solid #cbd9e8;
    border-radius: 10px;
    background: white;
    overflow: hidden;
    margin: 16px 0;
    color: #253c55;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f7faff;
  }
  header div {
    flex: 1;
    min-width: 240px;
  }
  h3,
  p {
    margin: 0;
  }
  header p,
  .diff-footnote {
    font-size: 12px;
    color: #536a83;
    margin-top: 5px;
  }
  header label {
    display: flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
  }
  .diff-count {
    font-size: 12px;
  }
  .diff-titles,
  .diff-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .diff-titles strong {
    padding: 12px;
    overflow-wrap: anywhere;
    border-bottom: 1px solid #dce5ef;
    background: #f1f5fa;
  }
  .diff-scroll {
    max-height: 580px;
    overflow: auto;
  }
  .diff-cell {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    border-bottom: 1px solid #edf0f3;
  }
  .diff-left {
    border-right: 1px solid #dce5ef;
  }
  .diff-cell small {
    min-width: 35px;
    text-align: right;
    color: #6e8094;
    padding: 9px 4px;
    user-select: none;
  }
  .diff-cell b {
    min-width: 18px;
    padding-top: 7px;
  }
  pre {
    margin: 0;
    padding: 9px 10px 9px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font:
      13px/1.7 Consolas,
      'Microsoft YaHei',
      monospace;
  }
  .diff-removed .diff-left,
  .diff-modified .diff-left {
    background: #fff1f0;
  }
  .diff-added .diff-right,
  .diff-modified .diff-right {
    background: #effaf2;
  }
  .diff-modified {
    border-left: 3px solid #e8b340;
  }
  .diff-left mark {
    background: #ffc9c5;
    color: #8b2323;
    text-decoration: line-through;
  }
  .diff-right mark {
    background: #bbefcb;
    color: #14532d;
  }
  .diff-footnote,
  .diff-empty {
    padding: 12px 16px;
  }
</style>
