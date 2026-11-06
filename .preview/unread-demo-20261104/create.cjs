const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root='.preview/unread-demo-20261104';
const scenarios=[
{key:'pay',name:'答辩演示·支付联调（模拟）',rows:[
['pm','本群为答辩模拟材料。今天确认支付联调遗留问题、回归安排和上线条件。'],
['qa','重复请求场景发现PAY-217：超时后重试可能重复创建订单，目前待修复。'],
['dev','PAY-217由我负责，11月4日16:00前提交幂等修复，提交后通知测试。'],
['qa','我负责重复请求和超时重试回归，11月4日17:30前反馈结果。'],
['ops','演示环境的监控看板已配置完成，这项不用再列待办。'],
['pm','上线条件是修复回归通过、监控验证完成、变更审批通过，三项都满足才能安排。'],
['ops','我负责验证成功率和重复订单告警，11月4日18:00前反馈。'],
['dev','更正一下：代码提交时间调整到11月4日16:30，以这条为准。'],
['qa','验收数据还需要业务确认，联系人和反馈时间目前都没确定。'],
['pm','请本机用户“我”在11月5日10:00前整理联调纪要，并跟进业务验收数据联系人。'],
['ops','上线窗口尚未获批，不能将今晚发布写成确定计划。'],
['pm','最终口径：修复16:30、回归17:30、监控验证18:00；上线时间待审批，纪要明天10:00前完成。']]},
{key:'ops',name:'答辩演示·运维交接（模拟）',rows:[
['ops','本群为模拟值班交接，不涉及真实生产告警。今天交接网关超时、容量检查和巡检安排。'],
['dev','演示网关09:20出现一次超时，09:25已恢复，原因还没有确认。'],
['ops','我负责排查超时链路，11月4日15:00前提供日志分析结果。'],
['qa','我负责验证超时重试策略，11月4日16:00前反馈测试记录。'],
['ops','昨天的历史告警已归档，不需要再次处理。'],
['pm','今晚巡检先提议20:00，但还没有确认人员，暂时不要安排执行。'],
['dev','备用实例扩容需要补充容量数据，我在11月4日17:00前整理评估材料。'],
['pm','扩容审批人和实际执行时间仍待确认，当前只是准备评估材料。'],
['pm','请本机用户“我”在11月4日17:30前汇总交接事项，明确已恢复、待排查和待审批内容。'],
['ops','确认：超时已恢复不等于根因已解决；巡检时间和扩容执行计划都还未定。']]},
{key:'qa',name:'答辩演示·测试验收（模拟）',rows:[
['qa','本群是模拟测试验收。办公协作原型本轮重点检查未读总结、待办提取和RAG追问。'],
['qa','未读总结基本流程已验证通过，原消息来源能展开查看。'],
['dev','发现一个待验证点：总结后切换会话，候选待办是否仍关联正确来源。'],
['qa','我负责补充切换会话测试，11月4日16:00前提交测试结论。'],
['dev','我负责整理RAG模糊问题样例，11月4日15:30前发到本群。'],
['pm','验收评审原定11月5日10:00，现在调整为11月5日14:00，请以新时间为准。'],
['ops','演示机器和网络检查已完成，备用截图也已准备好。'],
['qa','异常网络下的重试还未测完，不能写成全部用例通过。'],
['pm','请本机用户“我”在11月5日12:00前整理验收问题清单，并附每个问题的处理状态。'],
['pm','业务验收代表尚未确定，由项目组继续协调，暂时没有承诺反馈时间。']]},
{key:'policy',name:'答辩演示·制度知识更新（模拟）',rows:[
['pm','本群为合成制度材料演示，讨论新版发布规范比对及知识库维护，不代表正式制度。'],
['qa','新旧文本差异有三处：增加幂等性测试、改为测试与研发双确认、记录保留30天改90天。'],
['dev','我负责整理三处差异对应的新旧原文，11月4日16:00前形成比对表。'],
['qa','我负责核对引用是否准确，11月4日17:00前完成复核，不能只看AI解释。'],
['ops','文档上传智能体的演示目录已配置，后台服务运行后可以监控新增和修改。'],
['ops','我负责检查预处理报告和RAGFlow入库回执，11月4日18:00前反馈数量及回读校验结果。'],
['pm','存在转换疑点的文件先停在待复核，不直接当作完整入库。'],
['dev','旧版资料保留用于比对，不删除。新版是否正式生效还要另行确认。'],
['pm','请本机用户“我”在11月5日10:30前整理知识更新说明，标明版本、差异和待确认事项。'],
['qa','正式生效日期和审批人尚未确认，演示问答中要保留这一条件。']]}
];
(async()=>{const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');try{
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));assert(page);
 const before=await page.evaluate(()=>{if([...document.querySelectorAll('textarea')].some(e=>e.value.trim()))throw Error('存在草稿');const raw=localStorage.getItem('em.local-chat.v1');const d=JSON.parse(raw);if(d.conversations.some(c=>c.messages.some(m=>m.status==='pending'))||document.querySelector('.workbench__composer--busy'))throw Error('存在运行任务');return raw;});
 fs.writeFileSync(root+'/chat-before.json',before,{flag:'wx'});
 const added=await page.evaluate(({scenarios,before})=>{
  if(localStorage.getItem('em.local-chat.v1')!==before)throw Error('聊天状态变化，请重试');const data=JSON.parse(before);
  const members=[{id:'self',name:'我',kind:'self',color:'#347ad9'},...['项目负责人','周铭','李妍','赵宁'].map((name,i)=>({id:['pm','dev','qa','ops'][i],name,kind:'simulated',color:['#7865c4','#408978','#547dc0','#bd8752'][i]}))];
  const groups=scenarios.map(s=>{const id='demo-unread-20261104-'+s.key;if(data.conversations.some(c=>c.id===id))throw Error('演示群已存在');return {id,name:s.name,pinned:true,members,readState:{seenIds:[],summaryIds:[]},messages:s.rows.map(([senderId,text],i)=>({id:id+'-'+(i+1),role:'user',senderId,text,status:'done',createdAt:new Date(Date.now()-(s.rows.length-i+2)*60000).toISOString()}))};});
  data.conversations.push(...groups);localStorage.setItem('em.local-chat.v1',JSON.stringify(data));return groups.map(c=>({id:c.id,name:c.name,count:c.messages.length}));
 },{scenarios,before});
 await page.reload();await page.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor({timeout:20000});
 const result=await page.evaluate(({before,added})=>{const old=JSON.parse(before),d=JSON.parse(localStorage.getItem('em.local-chat.v1'));return {preserved:old.conversations.every(c=>JSON.stringify(c.messages)===JSON.stringify(d.conversations.find(x=>x.id===c.id).messages)),selectedUnchanged:d.selectedId===old.selectedId,groups:added.map(a=>{const c=d.conversations.find(c=>c.id===a.id);return {...a,unread:c.messages.filter(m=>!c.readState.seenIds.includes(m.id)).length};})};},{before,added});
 assert(result.preserved);assert(result.selectedUnchanged);assert(result.groups.every(c=>c.unread===c.count));
 await page.screenshot({path:root+'/unread-groups.png'});fs.writeFileSync(root+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
