import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitParagraphs, retrieveParagraphs, parseMetrics, fillTemplate, parseWorkResult, buildWorkRequest, scanRiskPhrases, type PolicyDocument } from '../src/services/compliance.ts'
const doc: PolicyDocument = { id: 'd', name: '示例制度', number: '测试〔2026〕1号', issuer: '测试机构', version: '1', effective: '2026-01-01', expires: '', scope: '测试', kind: '监管文件', createdAt: '2026-10-15', paragraphs: splitParagraphs('第一条 接入申请应提交申请书。\n\n第二条 现场核查应验证风险控制措施。', 'd') }
test('paragraph references stable and keyword retrieval includes original source', () => {
  assert.equal(doc.paragraphs[0].id, 'd-1')
  assert.equal(retrieveParagraphs([doc], '现场核查')[0].id, 'd-2')
  assert.equal(retrieveParagraphs([doc], '不存在主题').length, 0)
})
test('fabricated reference or non-verbatim quote is never validated', () => {
  const r = parseWorkResult(JSON.stringify({ summary: '示例', findings: [{title:'A',refs:[{id:'d-1',quote:'接入申请应提交申请书'}]},{title:'B',refs:[{id:'fake',quote:'不存在的要求'}]},{title:'C',refs:[{id:'d-1',quote:'可以随意接入'}]}] }), [doc])
  assert.equal(r.findings[0].refs[0].valid, true)
  assert.equal(r.findings[1].refs[0].valid, false)
  assert.equal(r.findings[2].refs[0].valid, false)
  assert.equal(r.warnings.length, 1)
})
test('template values preserve exact decimals and missing values are explicit', () => {
  const m = parseMetrics('{"金额":"123.4500 万元"}')
  assert.equal(fillTemplate('金额 {{金额}}；期间 {{报告期}}', m), '金额 123.4500 万元；期间 【待补充：报告期】')
  assert.throws(()=>parseMetrics('{"指标":{}}'))
  assert.throws(()=>parseMetrics('[]'))
})
test('large review refuses truncation and comparison requires exactly two docs', () => {
  assert.throws(()=>buildWorkRequest('compare',[doc],'对照','2026-10-15'))
  const big = {...doc, paragraphs: [{id:'big',text:'文'.repeat(76000)}]}
  assert.throws(()=>buildWorkRequest('compare',[doc,big],'对照','2026-10-15'), /上限/)
  assert.throws(()=>buildWorkRequest('review',[doc],'扫描','2026-10-15','d'))
})
test('unmatched retrieval does not call model; metadata warnings retained', () => {
  assert.throws(()=>buildWorkRequest('policy',[doc],'不存在主题','2026-10-15'), /未检索/)
  const r = buildWorkRequest('policy',[{...doc,effective:'2027-01-01'}],'接入申请','2026-10-15')
  assert.match(r.warnings.join(''),/尚未生效/)
  assert.match(r.messages[1].content,/测试〔2026〕1号/)
})
test('risk phrase rule flags review rather than asserting illegality', () => {
  const matches = scanRiskPhrases({...doc, paragraphs:splitParagraphs('本公司承诺资金实时兜底。','target')})
  assert.equal(matches.length,1)
  assert.match(matches[0].detail,/不认定违法/)
  assert.equal(matches[0].refs[0].id,'target-1')
})
