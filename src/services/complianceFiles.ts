import { splitParagraphs, type PolicyDocument, type SourceParagraph, type WorkResult, MODE_LABELS } from './compliance'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export async function extractDocument(file: File, id: string): Promise<SourceParagraph[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error('单个文件上限 15 MB。')
  const ext = file.name.split('.').pop()?.toLowerCase()
  let paragraphs: SourceParagraph[]
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    const pdf = await task.promise
    try {
      if (pdf.numPages > 150) throw new Error('PDF 超过 150 页，请分卷导入。')
      paragraphs = []
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n), content = await page.getTextContent()
        const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('')
        if (text.trim().length < 10) throw new Error(`PDF 第 ${n} 页没有可用文本（可能是扫描页）。请先 OCR，不会跳过该页后宣称完成审核。`)
        paragraphs.push(...splitParagraphs(text, `${id}-page${n}`, n))
      }
    } finally { await task.destroy() }
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    paragraphs = splitParagraphs(result.value, id)
  } else if (ext === 'txt' || ext === 'md') paragraphs = splitParagraphs(await file.text(), id)
  else throw new Error('支持 TXT、Markdown、DOCX 和可选中文本的 PDF；旧版 DOC 请另存为 DOCX。')
  if (!paragraphs.length) throw new Error('未读取到文本，请检查文件或先完成 OCR。')
  if (paragraphs.reduce((n, p) => n + p.text.length, 0) > 300000) throw new Error('文件超过 30 万字符，请分卷导入。')
  return paragraphs
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export async function exportWork(result: WorkResult) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const lines = [`${MODE_LABELS[result.mode]} — 草稿 / 待人工审核`, `生成时间：${result.createdAt}`, result.coverage,
    ...result.warnings.map(w => `注意：${w}`), `需求：${result.question}`, result.summary,
    ...result.findings.flatMap((f, i) => [`${i + 1}. ${f.title}（${f.state}）`, f.detail, `建议：${f.suggestion}`, `审核备注：${f.note}`,
      ...f.refs.map(r => { const d = result.documents.find(d => d.paragraphs.some(p => p.id === r.id)); return `${r.valid ? '已校验原文' : '引用未核验'}：${d?.name || '未知文件'} / ${d?.number || '文号未登记'} / ${r.id}\n${r.quote}` })]),
    '草稿正文', result.draft, '本期指标（用户提供，未独立审计）', ...Object.entries(result.metrics || {}).map(([k, v]) => `${k}：${v}`)]
  const doc = new Document({ sections: [{ children: lines.flatMap(line => line.split('\n').map(text => new Paragraph({ children: [new TextRun(text)] }))) }] })
  downloadBlob(await Packer.toBlob(doc), `${MODE_LABELS[result.mode]}-待审核-${result.createdAt.slice(0, 10)}.docx`)
}
export function sourceLabel(doc: PolicyDocument, id: string) {
  const p = doc.paragraphs.find(p => p.id === id)
  return `${doc.name} · ${doc.number || '文号未登记'} · ${p?.page ? `第 ${p.page} 页` : `第 ${doc.paragraphs.findIndex(p => p.id === id) + 1} 段`}`
}
