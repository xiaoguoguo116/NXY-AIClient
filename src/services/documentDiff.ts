export interface DiffPart {
  text: string
  changed: boolean
}
export interface DiffRow {
  kind: 'same' | 'added' | 'removed' | 'modified'
  leftLine?: number
  rightLine?: number
  left: DiffPart[]
  right: DiffPart[]
}

// Bounded LCS: large unmatched blocks remain complete additions/deletions.
// This prevents quadratic memory use without omitting any source text.
function sequenceDiff(a: string[], b: string[]): { kind: 'same' | 'removed' | 'added'; text: string }[] {
  let start = 0,
    endA = a.length,
    endB = b.length
  while (start < endA && start < endB && a[start] === b[start]) start++
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const output: { kind: 'same' | 'removed' | 'added'; text: string }[] = a
    .slice(0, start)
    .map((text) => ({ kind: 'same', text }))
  const n = endA - start,
    m = endB - start
  if (n * m > 1_000_000) {
    for (const text of a.slice(start, endA)) output.push({ kind: 'removed', text })
    for (const text of b.slice(start, endB)) output.push({ kind: 'added', text })
  } else {
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        table[i][j] =
          a[start + i] === b[start + j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    let i = 0,
      j = 0
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        output.push({ kind: 'same', text: a[start + i++] })
        j++
      } else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1]))
        output.push({ kind: 'removed', text: a[start + i++] })
      else output.push({ kind: 'added', text: b[start + j++] })
    }
  }
  for (const text of a.slice(endA)) output.push({ kind: 'same', text })
  return output
}

function inlineParts(left: string, right: string): [DiffPart[], DiffPart[]] {
  const sides: [DiffPart[], DiffPart[]] = [[], []]
  for (const edit of sequenceDiff(Array.from(left), Array.from(right))) {
    for (const side of edit.kind === 'same' ? [0, 1] : edit.kind === 'removed' ? [0] : [1]) {
      const parts = sides[side],
        changed = edit.kind !== 'same',
        previous = parts[parts.length - 1]
      if (previous?.changed === changed) previous.text += edit.text
      else parts.push({ text: edit.text, changed })
    }
  }
  return sides
}

export function compareDocumentText(left: string, right: string): DiffRow[] {
  const lines = (text: string) => (text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n'))
  const edits = sequenceDiff(lines(left), lines(right)),
    rows: DiffRow[] = []
  let leftLine = 1,
    rightLine = 1,
    i = 0
  while (i < edits.length) {
    const edit = edits[i]
    if (edit.kind === 'same') {
      rows.push({
        kind: 'same',
        leftLine: leftLine++,
        rightLine: rightLine++,
        left: [{ text: edit.text, changed: false }],
        right: [{ text: edit.text, changed: false }]
      })
      i++
      continue
    }
    const removed: string[] = [],
      added: string[] = []
    while (i < edits.length && edits[i].kind !== 'same') {
      const item = edits[i++]
      ;(item.kind === 'removed' ? removed : added).push(item.text)
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      const hasLeft = j < removed.length,
        hasRight = j < added.length
      const [before, after] =
        hasLeft && hasRight
          ? inlineParts(removed[j], added[j])
          : [hasLeft ? [{ text: removed[j], changed: true }] : [], hasRight ? [{ text: added[j], changed: true }] : []]
      rows.push({
        kind: hasLeft && hasRight ? 'modified' : hasLeft ? 'removed' : 'added',
        leftLine: hasLeft ? leftLine++ : undefined,
        rightLine: hasRight ? rightLine++ : undefined,
        left: before,
        right: after
      })
    }
  }
  return rows
}
