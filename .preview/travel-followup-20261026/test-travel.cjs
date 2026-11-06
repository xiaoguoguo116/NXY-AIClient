const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:8090';
const cases = [
  { id: 'travel', q: '出差', shape: 'clarify' },
  { id: 'workflow', q: '出差流程', shape: 'useful', clickAll: true },
  { id: 'directions', q: '我准备出差，请根据差旅制度给我几个可以继续了解的办理方向。', shape: 'clarify', clickAll: true },
  { id: 'application', q: '国内出差需要提前多久申请，填写哪些信息？', shape: 'answer', includes: ['两|2|二', '工作日', '预算', '地点', '交通'],
    followups: [
      { q: '那去香港呢？', includes: ['五|5', '工作日'] },
      { q: '如果是紧急出差，来不及提前申请呢？', includes: ['口头', '返程', '两|2|二', '工作日'] },
      { q: '回来以后怎么报销，多久内要提交？', includes: ['十五|15', '工作日', '财务', '出纳'] }
    ] },
  { id: 'approval', q: '出差预算为5000元、5001元、20000元和20001元时，分别需要哪些人审批？', shape: 'answer', includes: ['部门负责人', '成本中心', '分管负责人', '财务负责人'] },
  { id: 'approval-followup', q: '我这次国内出差预算6000元，要找谁审批？', shape: 'answer', includes: ['部门负责人', '成本中心', '分管负责人'],
    followups: [
      { q: '如果预算改成25000元呢？', includes: ['财务负责人'] },
      { q: '审批人可以批准自己的费用吗？', includes: ['不得|不能|不可以'] }
    ] },
  { id: 'reimbursement', q: '出差回来报销，具体流程和时限是什么？', shape: 'answer', includes: ['十五|15', '五|5', '出纳', '凭证', '成本中心'] },
  { id: 'emergency', q: '如果是紧急出差，来不及提前申请呢？', shape: 'answer', includes: ['口头', '返程', '两|2|二', '工作日'] },
  { id: 'urgent-departure', q: '临时通知我今天就要出差，正常的提前申请时间来不及了，该怎么办？', shape: 'answer', includes: ['口头', '返程', '两|2|二', '工作日'] },
  { id: 'urgent-return', q: '我已经紧急出差回来了，补办审批最晚是什么时候？', shape: 'answer', includes: ['返程', '两|2|二', '工作日'] },
  { id: 'accommodation', q: '我是P2员工，出差到北京，住宿每晚最多报销多少？', shape: 'answer', includes: ['500'],
    followups: [{ q: '遇到大型展会房价超过标准怎么办？', includes: ['三|3', '事前', '30%|百分之三十'] }] },
  { id: 'allowance', q: '出差到上海，主办方包一顿正餐并统一提供市内交通，当天伙食和交通补助怎么算？', shape: 'answer', includes: ['90|九十', '不再|不发|不予|0元|零'] },
  { id: 'change', q: '出差审批通过后行程延期或取消，需要怎么办？', shape: 'answer', includes: ['更新', '审批'] },
  { id: 'missing-invoice', q: '出差住宿发票丢失，可以直接用付款截图代替发票报销吗？', shape: 'answer' },
  { id: 'unsupported', q: '差旅制度中去火星出差的每日补贴标准是多少？', shape: 'answer' }
];
const selected = new Set((process.env.TRAVEL_CASES || '').split(',').filter(Boolean));
const phase = process.env.TRAVEL_PHASE || 'travel';
const report = { started: new Date().toISOString(), cases: [], errors: [] };
const save = () => fs.writeFileSync(path.join(__dirname, phase + '.json'), JSON.stringify(report, null, 2));
async function json(route, body) {
  const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(150000) });
  if (!r.ok) throw Error('HTTP ' + r.status);
  const v = await r.json();
  if ('code' in v) { if (v.code !== 0) throw Error('API code ' + v.code); return v.data; }
  return v;
}
let chatId;
async function ask(question, sessionId, selection) {
  const started = Date.now();
  const r = await json('/ragflow-api/chat/completions', { chat_id: chatId, session_id: sessionId,
    messages: [{ role: 'user', content: question }], stream: false, reasoning: 0,
    clarification_mode: true, return_diagnostics: true, store_history_messages: true,
    pass_all_history_messages: false, ...(selection ? { clarification_selection: selection } : {}) });
  const d = r.diagnostics || {};
  return { question, session: r.session_id || sessionId, answer: d.answer || r.answer,
    options: r.clarification?.options || [], cacheId: r.clarification?.cache_id,
    needsInput: !!r.clarification?.needs_input, cacheStatus: d.cache_status,
    record: d.record_id, preprocessing: d.preprocessing, decision: d.clarification_decision,
    candidateCount: d.retrieved_chunks?.length || 0, contextCount: d.context_chunks?.length || 0,
    documents: [...new Set((d.retrieved_chunks || []).map(c => c.docnm_kwd))],
    context: (d.context_chunks || []).map(c => ({ id: c.chunk_id, document: c.docnm_kwd, text: c.content_with_weight || c.content })),
    timings: d.timings_ms, elapsed: Date.now() - started };
}
function check(result, spec) {
  const problems = [];
  if (!result.answer?.trim()) problems.push('missing answer');
  if (result.options.length > 5 || new Set(result.options.map(o => o.question)).size !== result.options.length) problems.push('invalid option count/dedup');
  if (spec.shape === 'clarify' && result.options.length < 2) problems.push('expected selectable directions');
  if (spec.shape === 'answer' && result.options.length) problems.push('specific question did not receive an answer');
  for (const pattern of spec.includes || []) if (!new RegExp(pattern).test(result.answer)) problems.push('missing expected fact: ' + pattern);
  result.problems = problems;
  for (const problem of problems) report.errors.push({ question: result.question, problem });
}
async function run(spec) {
  const entry = { id: spec.id };
  report.cases.push(entry);
  try {
    const session = await json(`/ragflow-api/chats/${chatId}/sessions`, { name: `出差流程测试-20261026-${spec.id}` });
    Object.assign(entry, await ask(spec.q, session.id));
    check(entry, spec); save();
    if (spec.clickAll && entry.options.length) {
      entry.clicks = [];
      for (const option of entry.options) {
        const r = await ask(option.question, session.id, { cache_id: entry.cacheId, option_id: option.id });
        check(r, { shape: 'answer' });
        if (r.cacheStatus !== 'hit') report.errors.push({ question: r.question, problem: 'option did not reuse verified evidence' });
        entry.clicks.push(r); save();
      }
    }
    if (spec.followups) {
      entry.followups = [];
      for (const next of spec.followups) {
        const r = await ask(next.q, session.id); check(r, { ...next, shape: 'answer' });
        entry.followups.push(r); save();
      }
    }
  } catch (error) { entry.error = error.message; report.errors.push({ id: spec.id, problem: error.message }); }
  save();
  console.log(JSON.stringify({ id: spec.id, options: entry.options?.length, candidates: entry.candidateCount,
    problems: entry.problems, error: entry.error, clicks: entry.clicks?.map(c => ({ question: c.question, cache: c.cacheStatus, problems: c.problems })),
    followups: entry.followups?.map(c => ({ question: c.question, normalized: c.preprocessing?.normalized_question, problems: c.problems })) }));
}
(async () => {
  chatId = (await json('/config')).chatId;
  const todo = cases.filter(c => !selected.size || selected.has(c.id));
  let index = 0;
  async function worker() { while (index < todo.length) await run(todo[index++]); }
  await Promise.all([worker(), worker()]);
  report.finished = new Date().toISOString(); save();
  console.log(JSON.stringify({ cases: report.cases.length, requests: report.cases.reduce((n, c) => n + 1 + (c.clicks?.length || 0) + (c.followups?.length || 0), 0), errors: report.errors }));
  if (report.errors.length) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
