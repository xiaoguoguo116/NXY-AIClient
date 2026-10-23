const $ = selector => document.querySelector(selector)
const make = (tag, className, text) => {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}
let sessionId = '', busy = false
async function api(path, data) {
  const response = await fetch(path, { ...(data === undefined ? {} : { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }), signal: AbortSignal.timeout(10000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '演示服务暂不可用，请重试。')
  return result
}
function chip(question) {
  const button = make('button', '', question)
  button.type = 'button'
  button.onclick = () => send(question)
  return button
}
for (const question of ['请假应该怎么申请？', '报销需要哪些材料？', '出差住宿的示例标准是多少？', '远程办公怎么申请？']) $('#suggestions').append(chip(question))
function append(role, text) {
  const message = make('article', `message ${role}`)
  if (role === 'assistant') {
    const identity = make('div', 'identity')
    identity.append(make('span', 'spark', '✦'), make('span', '', '制度知识助手 · 演示回答'))
    message.append(identity)
  }
  message.append(make('div', 'text', text))
  $('#messages').append(message)
  $('.conversation').scrollTop = $('.conversation').scrollHeight
  return message
}
async function send(question) {
  question = question.trim()
  if (!question || busy) return
  busy = true
  $('#send').disabled = true
  $('#error').hidden = true
  $('#welcome').hidden = true
  $('#question').value = ''
  append('user', question)
  try {
    if (!sessionId) sessionId = (await api('/ragflow-api/chats/em-demo-policy/sessions', { name: question.slice(0, 50) })).data.id
    const { data } = await api('/ragflow-api/chat/completions', { chat_id: 'em-demo-policy', session_id: sessionId, messages: [{ role: 'user', content: question }], stream: false })
    const message = append('assistant', data.answer)
    if (data.reference.chunks.length) {
      const details = make('details', 'sources')
      details.append(make('summary', '', `查看制度依据 · ${data.reference.chunks.length} 条`))
      for (const chunk of data.reference.chunks) {
        const source = make('div', 'source')
        source.append(make('strong', '', chunk.docnm_kwd), make('p', '', chunk.content))
        details.append(source)
      }
      message.append(details)
    }
    const followups = make('div', 'followups')
    for (const option of data.clarification.options) followups.append(chip(option.question))
    message.append(followups)
    $('.conversation').scrollTop = $('.conversation').scrollHeight
  } catch (error) {
    $('#error').textContent = `${error.message} 问题已保留，可重新发送。`
    $('#error').hidden = false
    $('#question').value = question
    sessionId = ''
  } finally {
    busy = false
    $('#send').disabled = false
    $('#question').focus()
  }
}
$('.composer').addEventListener('submit', event => { event.preventDefault(); void send($('#question').value) })
$('#question').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send($('#question').value) }
})
$('.new-chat').onclick = () => {
  if (busy) return
  sessionId = ''
  $('#messages').replaceChildren()
  $('#welcome').hidden = false
  $('#error').hidden = true
  $('#question').value = ''
  $('#question').focus()
}
$('#close-document').onclick = () => $('#document-dialog').close()
try {
  for (const doc of await api('/api/documents')) {
    const button = make('button', 'document')
    button.type = 'button'
    const name = make('span')
    name.append(make('strong', '', doc.title.replace('（示例）', '')), make('small', '', `${doc.category} · 示例文档`))
    button.append(make('span', 'document-icon', doc.icon), name)
    button.onclick = () => {
      $('#document-title').textContent = doc.title
      $('#document-content').replaceChildren()
      for (const section of doc.sections) $('#document-content').append(make('h3', '', section.title), make('p', '', section.text))
      $('#document-dialog').showModal()
    }
    $('#documents').append(button)
  }
} catch {
  $('#error').textContent = '无法连接演示知识库，请确认本机服务已启动后刷新。'
  $('#error').hidden = false
}
