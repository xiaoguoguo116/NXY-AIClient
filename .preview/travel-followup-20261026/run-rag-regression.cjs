const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const base = 'http://127.0.0.1:8090';
const phase = process.argv[2] || 'baseline';
const selected = new Set((process.env.RAG_CASES || '').split(',').filter(Boolean));
const cases = [
  ['compressed', '加值班制度', 'clarify'],
  ['overtime', '加班', 'clarify'],
  ['duty', '值班制度', 'clarify'],
  ['expense', '报销制度', 'clarify'],
  ['leave', '请假制度', 'clarify'],
  ['account', '账号怎么处理？', 'clarify'],
  ['missing-topic', '怎么申请？', 'needs_input'],
  ['missing-reference', '这个呢？', 'needs_input'],
  ['specific', '加班与调休管理制度的适用范围是什么？', 'answer'],
  ['explicit-document', '《值班管理制度》由哪个部门负责解释？', 'answer'],
  ['parallel-specific', '加班和值班制度分别适用于哪些人？', 'answer'],
  ['comparison', '加班与值班制度有什么区别？', 'answer'],
  ['three-topics', '加班、值班和请假制度', 'clarify'],
  ['typo', '住宿报消标准是多少？', 'answer'],
  ['out-of-scope', '火星驻外津贴制度的领取标准是多少？', 'no_evidence'],
  ['long-broad', '我刚入职，对公司的工作安排和员工管理规定还不熟悉，暂时没有具体的办理事项，也不确定应该先看哪些条款。我想先了解一下加班和值班这两类制度，请根据已有制度列出几个有依据、可以继续了解的方向让我选择。', 'clarify'],
];
const report = { phase, started: new Date().toISOString(), cases: [] };
const save = () => fs.writeFileSync(path.join(root, `${phase}.json`), JSON.stringify(report, null, 2));
async function json(route, body) {
  const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(150000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const v = await r.json();
  if ('code' in v) { if (v.code !== 0) throw Error(v.message || `code ${v.code}`); return v.data; }
  return v;
}
let chatId;
async function ask(question, session, selection) {
  const start = Date.now();
  const response = await json('/ragflow-api/chat/completions', { chat_id: chatId, session_id: session,
    messages: [{ role: 'user', content: question }], stream: false, reasoning: 0,
    clarification_mode: true, return_diagnostics: true, store_history_messages: true,
    pass_all_history_messages: false, ...(selection ? { clarification_selection: selection } : {}) });
  const d = response.diagnostics || {};
  return { question, session: response.session_id || session, elapsed: Date.now() - start,
    answer: d.answer || response.answer, options: response.clarification?.options || [],
    needsInput: !!response.clarification?.needs_input, cacheId: response.clarification?.cache_id,
    cacheStatus: d.cache_status, preprocessing: d.preprocessing, decision: d.clarification_decision,
    timings: d.timings_ms, record: d.record_id, candidateCount: d.retrieved_chunks?.length || 0,
    contextCount: d.context_chunks?.length || 0,
    documents: [...new Set((d.retrieved_chunks || []).map(c => c.docnm_kwd))],
    context: (d.context_chunks || []).map(c => ({ id: c.chunk_id, document: c.docnm_kwd, text: c.content_with_weight || c.content })) };
}
async function run(item) {
  const [id, question, expected] = item;
  const entry = { id, question, expected };
  try {
    const session = await json(`/ragflow-api/chats/${chatId}/sessions`, { name: `追问验证-${phase}-${id}` });
    Object.assign(entry, await ask(question, session.id));
    entry.contractPassed = !!entry.answer && entry.options.length <= 5 && new Set(entry.options.map(o => o.question)).size === entry.options.length;
    entry.expectedShape = expected === 'clarify' ? entry.options.length >= 2 : expected === 'needs_input' ? entry.needsInput && !entry.options.length : !entry.options.length;
    if ((process.env.RAG_CLICK_ALL || ['compressed', 'account', 'expense'].includes(id)) && entry.options.length) {
      entry.clicks = [];
      for (const o of entry.options.slice(0, process.env.RAG_CLICK_ALL ? 5 : 2)) {
        const click = await ask(o.question, session.id, { cache_id: entry.cacheId, option_id: o.id });
        entry.clicks.push(click);
      }
    }
    if (id === 'specific') {
      entry.followups = [];
      for (const q of ['那外包人员呢？', '由哪个部门负责解释？']) entry.followups.push(await ask(q, session.id));
    }
    if (id === 'missing-topic') entry.followups = [await ask('我是想申请加班，需要哪些步骤？', session.id)];
  } catch (e) { entry.error = e.message; }
  report.cases.push(entry); save();
  console.log(JSON.stringify({ id, options: entry.options?.length, expectedShape: entry.expectedShape, ms: entry.elapsed,
    reason: entry.decision?.reason, rejection: entry.decision?.rejections, error: entry.error,
    followups: entry.followups?.map(f => ({question:f.question, normalized:f.preprocessing?.normalized_question, needsInput:f.needsInput})),
    clicks: entry.clicks?.map(c => ({ cache:c.cacheStatus, ms:c.elapsed })) }));
}
(async () => {
  chatId = (await json('/config')).chatId;
  const todo = cases.filter(c => !selected.size || selected.has(c[0]));
  let index = 0;
  async function worker() { while (index < todo.length) await run(todo[index++]); }
  await Promise.all([worker(), worker()]);
  report.finished = new Date().toISOString(); save();
  console.log(`DONE ${phase}: ${report.cases.length} initial questions`);
})().catch(e => { console.error(e); process.exitCode = 1; });
