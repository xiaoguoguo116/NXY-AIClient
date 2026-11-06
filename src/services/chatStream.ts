/** Decode SSE without assuming a network chunk is a whole event or UTF-8 character. */
export async function readSse(
  response: Response,
  signal: AbortSignal,
  onData: (data: string) => void,
  onFirstByte?: () => void
) {
  if (!response.body) throw new Error('接口没有返回可读取的回复。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = false
  let buffer = '',
    lines: string[] = []
  const abort = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', abort, { once: true })
  const emit = () => {
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    lines = []
    if (data && !signal.aborted) onData(data)
  }
  try {
    if (signal.aborted) throw new Error('模型接口请求已取消。')
    while (true) {
      const { value, done } = await reader.read()
      if (signal.aborted) throw new Error('模型接口请求已取消。')
      if (!received && value?.length) {
        received = true
        onFirstByte?.()
      }
      buffer += decoder.decode(value, { stream: !done })
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        if (line) lines.push(line)
        else emit()
      }
      if (done) break
    }
    if (buffer) lines.push(buffer.replace(/\r$/, ''))
    emit()
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Render arriving text smoothly; a large final chunk catches up without a long artificial delay. */
export function progressiveText(update: (text: string) => void, signal: AbortSignal) {
  let shown = '',
    wanted = '',
    timer: ReturnType<typeof setTimeout> | undefined
  let finished: (() => void) | undefined
  let stopped = false
  function tick() {
    timer = undefined
    if (stopped || signal.aborted) return stop()
    if (!wanted.startsWith(shown)) shown = ''
    const remaining = Array.from(wanted.slice(shown.length))
    shown += remaining.slice(0, Math.max(1, Math.ceil(remaining.length / 8))).join('')
    update(shown)
    if (shown !== wanted) timer = setTimeout(tick, 16)
    else {
      finished?.()
      finished = undefined
    }
  }
  function push(text: string) {
    if (stopped || signal.aborted) return
    wanted = text
    if (!timer && shown !== wanted) tick()
  }
  function stop() {
    stopped = true
    clearTimeout(timer)
    signal.removeEventListener('abort', stop)
    finished?.()
    finished = undefined
  }
  signal.addEventListener('abort', stop, { once: true })
  return {
    push,
    stop,
    finish(text: string) {
      push(text)
      return new Promise<void>((resolve) => {
        if (stopped || signal.aborted || shown === wanted) resolve()
        else finished = resolve
      })
    }
  }
}

export function visibleAiText(text: string) {
  // Structured todo candidates are rendered separately only after a complete answer.
  const block = text.search(/```em-todos/i)
  return (block < 0 ? text : text.slice(0, block)).replace(
    /`{1,3}(?:e(?:m(?:-(?:t(?:o(?:d(?:o(?:s)?)?)?)?)?)?)?)?$/i,
    ''
  )
}
