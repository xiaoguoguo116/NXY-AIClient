// Isolated browser acceptance. Model replies are fixtures, not a real compliance judgement.
const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {Document,Packer,Paragraph}=require('docx');
const output='C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>localStorage.setItem('em.local-ai.v1',JSON.stringify({baseUrl:'http://127.0.0.1:19442/v1',model:'acceptance-fixture',contextCount:12})));
  await page.route('**/@tauri-apps_plugin-http.js*',r=>r.fulfill({contentType:'text/javascript',body:'export const fetch = globalThis.fetch.bind(globalThis);'}));
  let calls=0;
  await page.route('http://127.0.0.1:19442/v1/chat/completions',r=>{
   calls++;const input=JSON.parse(JSON.parse(r.request().postData()).messages[1].content);
   const refs=input.documents.filter(d=>d.paragraphs.length).slice(0,2).map(d=>({id:d.paragraphs[0].id,quote:d.paragraphs[0].text}));
   r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{message:{content:JSON.stringify({summary:`${input.task}测试结果（模拟模型）`,findings:[{title:'请人工核查申请材料要求',detail:'仅验收功能，不代表真实监管规定。',suggestion:'核查原文与适用条件。',refs}],draft:'测试草稿；全部结论待人工审核。'})}}]})});
  });
  await page.goto('http://127.0.0.1:1425/tests/compliance-preview.html');
  async function add(name,text,kind){await page.getByLabel('类型',{exact:true}).selectOption(kind);await page.getByLabel('资料名称',{exact:true}).fill(name);await page.getByLabel('文号',{exact:true}).fill('演示〔2026〕1号');await page.getByLabel('生效日期',{exact:true}).fill('2026-01-01');await page.getByLabel('适用对象 / 范围',{exact:true}).fill('仅用于本地功能测试');await page.getByLabel('资料全文',{exact:true}).fill(text);await page.getByRole('button',{name:'保存资料到本机',exact:true}).click();await page.locator('.cw-library-item').filter({hasText:name}).waitFor();}
  await add('测试监管文件','第一条 申请材料须包含申请书。\n\n第二条 现场核查须核实风险控制措施。','监管文件');
  await add('测试内部制度','第一条 申请材料须包含申请书和联系人。\n\n第二条 内部审批需要留存记录。','内部制度');
  await page.getByRole('button',{name:/收起资料库/}).click();
  async function run(){await page.locator('.cw-consent input').check();await page.getByRole('button',{name:'开始分析',exact:true}).click();await page.locator('.cw-results .cw-finding').waitFor({timeout:20000});assert.equal(await page.getByRole('alert').count(),0);}
  await page.getByLabel('合规任务说明').fill('申请材料要求是什么？');await run();
  await page.locator('.cw-evidence button').first().click();await page.getByRole('dialog',{name:'原文溯源'}).waitFor();assert((await page.locator('.cw-source-text .cited').innerText()).includes('申请材料'));await page.getByRole('button',{name:'关闭原文'}).click();
  await page.getByRole('button',{name:'制度比对',exact:true}).click();await page.getByLabel('合规任务说明').fill('对照两份文件');await run();
  await page.getByLabel('人工处理',{exact:true}).selectOption('已接受');await page.getByRole('button',{name:'保存审核与草稿'}).click();
  await page.getByRole('button',{name:'合规初审',exact:true}).click();await page.getByLabel('待审业务材料').selectOption({label:'测试内部制度'});await page.getByLabel('合规任务说明').fill('检查此材料');await run();
  await page.getByRole('button',{name:/管理资料库/}).click();await add('测试报告模板','# 季度报告\n\n报告期：{{报告期}}\n\n交易金额：{{交易金额}}\n\n整改情况：{{整改情况}}','报送模板');
  await page.getByRole('button',{name:'报送助手',exact:true}).click();await page.getByLabel('报送指标').fill('{"报告期":"2026年第三季度","交易金额":"123.4500 万元","数据来源":"验收模拟数据"}');
  await page.getByRole('button',{name:'仅填充模板（不调用模型）'}).click();assert.match(await page.getByLabel('合规草稿').inputValue(),/123.4500 万元/);assert.match(await page.getByLabel('合规草稿').inputValue(),/待补充：整改情况/);assert.equal(calls,3);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出 Word'}).click();const file=await download;await file.saveAs(output+'compliance-report-test.docx');
  const exported=await require('mammoth').extractRawText({path:output+'compliance-report-test.docx'});assert.match(exported.value,/123.4500 万元/);assert.match(exported.value,/待补充：整改情况/);assert.match(exported.value,/待人工审核/);
  await page.getByLabel('合规任务说明').fill('生成季度草稿');await run();assert.equal(calls,4);
  await page.getByRole('button',{name:'制度比对',exact:true}).click();await page.locator('.cw-history').first().click();assert.equal(await page.getByLabel('人工处理',{exact:true}).inputValue(),'已接受');
  await page.screenshot({path:output+'compliance-workbench.png',fullPage:true});
  await page.reload();await page.getByRole('button',{name:'制度比对',exact:true}).click();await page.locator('.cw-history').first().click();assert.equal(await page.getByLabel('人工处理',{exact:true}).inputValue(),'已接受');
  await page.getByRole('button',{name:/管理资料库/}).click();
  const buf=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('DOCX acceptance original paragraph.')] }]}));
  await page.locator('input[type=file]').setInputFiles({name:'docx-import-test.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:buf});await page.getByRole('button',{name:'保存资料到本机',exact:true}).click();await page.locator('.cw-library-item').filter({hasText:'docx-import-test.docx'}).waitFor({timeout:30000});
  const pdfPage=await browser.newPage();await pdfPage.setContent('<h1>PDF evidence test</h1><p>Application requires an application form.</p>');const pdf=await pdfPage.pdf();await pdfPage.close();
  await page.locator('input[type=file]').setInputFiles({name:'pdf-import-test.pdf',mimeType:'application/pdf',buffer:pdf});await page.getByRole('button',{name:'保存资料到本机',exact:true}).click();await page.locator('.cw-library-item').filter({hasText:'pdf-import-test.pdf'}).waitFor({timeout:30000});
  await page.locator('.cw-library-item').filter({hasText:'pdf-import-test.pdf'}).getByRole('button',{name:'查看原文'}).click();assert((await page.locator('.cw-source-text').innerText()).includes('第 1 页'));await page.getByRole('button',{name:'关闭原文'}).click();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: four workflows (mock model), citation jump, review persistence, exact template values, missing markers, PDF page extraction and DOCX import/export. No real regulatory judgement tested.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
