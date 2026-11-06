import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareDocumentText } from '../src/services/documentDiff.ts'

const restore = (rows: ReturnType<typeof compareDocumentText>, side: 'left' | 'right') =>
  rows
    .filter((row) => row[side === 'left' ? 'leftLine' : 'rightLine'] !== undefined)
    .map((row) => row[side].map((part) => part.text).join(''))
    .join('\n')

test('Chinese clause changes highlight only modified characters and preserve line numbers', () => {
  const rows = compareDocumentText('第一条 保存3年。\n第二条 每季检查。', '第一条 保存5年。\n第二条 每月检查。')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'modified')
  assert.deepEqual(
    rows[0].left.filter((p) => p.changed).map((p) => p.text),
    ['3']
  )
  assert.deepEqual(
    rows[0].right.filter((p) => p.changed).map((p) => p.text),
    ['5']
  )
  assert.equal(rows[1].rightLine, 2)
})

test('insertions, deletions, duplicates, Unicode and whitespace retain exact original text', () => {
  for (const [a, b] of [
    ['A\nB\nC', 'A\n新增\nB\nC'],
    ['A\n删除\nB', 'A\nB'],
    ['A\nA\nB', 'A\nB\nA'],
    ['', '新条款'],
    ['旧条款', ''],
    ['😀 中文\n\n end ', '😃 中文\nend '],
    ['A\n', 'A']
  ]) {
    const rows = compareDocumentText(a, b)
    assert.equal(restore(rows, 'left'), a)
    assert.equal(restore(rows, 'right'), b)
  }
})

test('identical text, empty text and CRLF normalization', () => {
  assert.deepEqual(compareDocumentText('', ''), [])
  assert(compareDocumentText('A\r\nB', 'A\nB').every((row) => row.kind === 'same'))
})

test('large unmatched documents and long lines remain complete without quadratic allocation', () => {
  const a = Array.from({ length: 1200 }, (_, i) => `old ${i}`).join('\n')
  const b = Array.from({ length: 1200 }, (_, i) => `new ${i}`).join('\n')
  const rows = compareDocumentText(a, b)
  assert.equal(restore(rows, 'left'), a)
  assert.equal(restore(rows, 'right'), b)
  const long = compareDocumentText('甲'.repeat(150000), '乙'.repeat(150000))
  assert.equal(restore(long, 'left').length, 150000)
  assert.equal(restore(long, 'right').length, 150000)
})

test('random edit sequences reconstruct both sides without losing lines', () => {
  let seed = 17
  const random = () => (seed = (seed * 16807) % 2147483647) % 8
  for (let sample = 0; sample < 200; sample++) {
    const a = Array.from({ length: random() }, () => String(random())).join('\n')
    const b = Array.from({ length: random() }, () => String(random())).join('\n')
    const rows = compareDocumentText(a, b)
    assert.equal(restore(rows, 'left'), a)
    assert.equal(restore(rows, 'right'), b)
  }
})
