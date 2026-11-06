const fs = require('node:fs');
const path = require('node:path');
const desktop = JSON.parse(fs.readFileSync(path.join(__dirname, 'desktop.json'), 'utf8'));
if (!desktop.passed) throw Error('Desktop test did not pass');
const workflow = desktop.checks.find(c => c.label === 'workflow');
const questions = {
  workflow: '出差流程', selected: workflow.options[0].question,
  'typed-followup': '如果我这次出差预算为6000元，需要哪些人审批？',
  'emergency-followup': '如果是紧急出差，来不及提前申请呢？'
};
fs.writeFileSync(path.join(__dirname, 'desktop-audit-input.json'), JSON.stringify({
  cases: desktop.checks.filter(c => questions[c.label]).map(c => ({ ...c, question: questions[c.label] }))
}, null, 2));
console.log('Prepared four native desktop requests for evidence audit.');
