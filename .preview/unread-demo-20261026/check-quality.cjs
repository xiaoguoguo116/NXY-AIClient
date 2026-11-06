const fs=require('node:fs'),assert=require('node:assert/strict');
const root='.preview/unread-demo-20261026';
const result=JSON.parse(fs.readFileSync(`${root}/native-retest-result.json`,'utf8')),text=result.answer.text;
const checks={
 completed:result.answer.status==='done',
 exactSources:result.request.summarySourceIds.length===12&&result.request.summarySourceIds.every(id=>id.startsWith('unread-demo-release-20261026-')&&!id.endsWith('-old')),
 correctedDeadline:/周铭[\s\S]*?16[:：]30/.test(text),
 regressionOwner:/李妍[\s\S]*?17[:：]30/.test(text),
 monitoringOwner:/赵宁[\s\S]*?18[:：]00/.test(text),
 completedDocument:text.includes('文档更新已完成'),
 releaseNotInvented:/上线日期[\s\S]*?(未明确|审批)/.test(text),
 personalTodo:/10[:：]00[\s\S]*?联调纪要/.test(text),
 progressiveRendering:result.samples.length>1,
 noOtherConversation:!text.includes('网关在 09:20'),
 noReadHistory:!text.includes('旧版登录页')
};
for(const [name,passed]of Object.entries(checks))assert(passed,name);
const report={passed:true,checks,observations:['原模拟消息没有明确监控验证与指标核对的范围完全相同；模型保留关系确认提醒。保留已知的赵宁及18:00安排，不将这项范围确认误判为漏掉负责人。','总结为辅助结果，仍需结合可展开的原消息核对。']};
fs.writeFileSync(`${root}/quality-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
