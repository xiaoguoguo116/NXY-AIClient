const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
const cases = (process.argv.slice(2).length ? process.argv.slice(2) : ['improved', 'all-options']).flatMap(name => JSON.parse(fs.readFileSync(path.join(__dirname, name + '.json'), 'utf8')).cases);
  const outputs = cases.flatMap(c => [c, ...(c.clicks || []), ...(c.followups || [])]);
  const report = { checked: [], errors: [] };
  let next = 0;
  async function worker() {
    while (next < outputs.length) {
      const output = outputs[next++];
      try {
        assert(!output.error, output.error);
        assert(output.record, 'missing audit record');
        const response = await fetch('http://127.0.0.1:8090/ragflow-api/optimization/records/' + output.record);
        assert(response.ok, 'audit HTTP status');
        const payload = await response.json();
        assert.equal(payload.code, 0);
        const record = payload.data;
        assert.equal(record.question, output.question);
        assert(!['error', 'running', 'cancelled'].includes(record.status), 'unfinished response');
        const check = { record: output.record, question: output.question, options: output.options.length,
          cache: record.cache_status, answerValidation: record.answer_validation?.status,
          contextCount: record.context?.length || 0, status: record.status };
        if (output.options.length) {
          assert(record.options.every(o => o.answer_verified && o.evidence_quotes.length && o.chunk_ids.length));
          assert.equal(record.options.length, output.options.length);
        } else if (check.contextCount) {
          assert(['passed', 'repaired'].includes(check.answerValidation), 'answer evidence review failed');
          const indices = [...output.answer.matchAll(/\[ID:(\d+)\]/g)].map(m => Number(m[1]));
          if (record.answer_validation?.reviews?.at(-1)?.answerable) assert(indices.length > 0, 'answerable response lacks citations');
          assert(indices.every(i => i < check.contextCount), 'citation index outside current evidence');
        }
        report.checked.push(check);
      } catch (error) { report.errors.push({ question: output.question, record: output.record, error: error.message }); }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(path.join(__dirname, 'audit-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checked: report.checked.length, errors: report.errors }, null, 2));
  if (report.errors.length) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
