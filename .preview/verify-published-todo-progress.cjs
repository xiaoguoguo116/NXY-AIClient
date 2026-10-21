const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => {
      if (localStorage.getItem('diagnostic-seeded')) return;
      localStorage.setItem('diagnostic-seeded', 'true');
      localStorage.setItem('em.local-chat.v1', JSON.stringify({version:1,exampleGroupsVersion:2,selectedId:'progress-check',conversations:[{
        id:'progress-check',name:'进度隔离验证群',messages:[],members:[
          {id:'self',name:'我',kind:'self',color:'#2685ed'},
          {id:'progress-zhang',name:'张三',kind:'simulated',color:'#2685ed'},
          {id:'progress-li',name:'李四',kind:'simulated',color:'#2685ed'}]}]}));
    });
    await page.goto('http://127.0.0.1:1425/tests/todo-flow-preview.html');
    const input = page.getByRole('textbox',{name:'消息输入框',exact:true});
    const send = async text => { await input.fill(text); await page.getByRole('button',{name:'发送',exact:true}).click(); };
    // No model configured in this isolated context: a meeting command incorrectly reaches the model config gate.
    await send('@AI 发布会议：明天下午三点召开联调会');
    await page.getByText('请先在总设置 → AI 模型中配置一次；所有会话共用。你的提问仍保留在输入框中。').waitFor();
    assert.equal(await page.locator('.assistant-dialog').count(),0);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-meetings.v1')||'{"items":[]}').items.length),0);
    console.log('CONFIRMED GAP: textual meeting command reaches generic AI configuration, not the meeting form.');
    await send('@AI @张三 @李四 把联调验收进度验证加入待办');
    await page.locator('.bubble').filter({hasText:'已添加到待办：联调验收进度验证'}).waitFor();
    const readTodos = () => page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items);
    let items = await readTodos();
    assert.equal(items.length,2);
    assert.deepEqual(items.map(t=>t.assigneeName).sort(),['张三','李四'].sort());
    await page.getByRole('button',{name:'测试切换到待办'}).click();
    const published = () => page.getByRole('button',{name:'我发布的',exact:true}).click();
    const card = page.locator('.published-task').filter({hasText:'联调验收进度验证'});
    const checkProgress = async (value) => {
      await card.waitFor();
      assert.equal(await card.locator('progress').getAttribute('value'),String(value));
      assert.equal(await card.locator('progress').getAttribute('max'),'2');
      assert.equal(await card.locator('.recipient-progress').count(),2);
    };
    await published(); await checkProgress(0);
    const selectRecipient = async name => {
      await page.getByRole('button',{name:'接收的待办',exact:true}).click();
      const expand = page.getByRole('button',{name:'筛选接收联系人',exact:true});
      if (await expand.count()) await expand.click();
      await page.getByRole('button',{name:'清空选择',exact:true}).click();
      await page.locator('.viewer-label .n-base-selection').click();
      const search = page.getByLabel('搜索待办接收人',{exact:true});
      await search.fill(name);
      await page.locator('.n-base-select-option').filter({hasText:name}).click();
      await search.press('Escape');
      await page.getByRole('button',{name:'收起接收人筛选',exact:true}).click();
    };
    await selectRecipient('张三');
    await page.getByRole('checkbox',{name:'完成：联调验收进度验证',exact:true}).click();
    await published(); await checkProgress(1);
    assert.match(await card.locator('.recipient-progress').filter({hasText:'张三'}).innerText(),/已完成[\s\S]*完成于/);
    assert.match(await card.locator('.recipient-progress').filter({hasText:'李四'}).innerText(),/未完成/);
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/published-progress-one-of-two.png',fullPage:true});
    await page.reload();
    await page.getByRole('button',{name:'测试切换到待办'}).click();
    await published(); await checkProgress(1);
    await page.getByRole('button',{name:'未完成',exact:true}).click(); await checkProgress(1);
    await selectRecipient('李四');
    await page.getByRole('checkbox',{name:'完成：联调验收进度验证',exact:true}).click();
    await published(); await checkProgress(2);
    assert.match(await card.innerText(),/全部完成/);
    await page.getByRole('button',{name:'未完成',exact:true}).click(); assert.equal(await card.count(),0);
    await page.getByRole('button',{name:'已完成',exact:true}).click(); await checkProgress(2);
    await selectRecipient('张三');
    await page.getByRole('button',{name:'已完成',exact:true}).click();
    await page.getByRole('checkbox',{name:'完成：联调验收进度验证',exact:true}).click();
    await published(); await checkProgress(1);
    items=await readTodos();
    assert.equal(items.find(t=>t.assigneeName==='张三').completedAt,undefined);
    assert(items.find(t=>t.assigneeName==='李四').completedAt);
    console.log('PASS: chat assigns two recipients; published progress 0/2 -> 1/2 -> reload 1/2 -> 2/2 -> undo 1/2; independent completion timestamps and pending/done filters.');
    // The existing explicit meeting form should create a meeting without creating another todo.
    await page.getByRole('button',{name:'测试切换到对话'}).click();
    await page.locator('.meeting-shortcut').click();
    await page.getByLabel('会议主题',{exact:true}).fill('会议分类隔离验证');
    await page.getByLabel('会议开始日期',{exact:true}).fill('2030-10-22');
    await page.getByLabel('会议开始时刻',{exact:true}).selectOption('15:00');
    await page.getByRole('button',{name:'确认开始时间',exact:true}).click();
    await page.getByRole('button',{name:'确认发布会议',exact:true}).click();
    await page.locator('.bubble').filter({hasText:'会议已发布：会议分类隔离验证'}).waitFor();
    assert.equal((await readTodos()).length,2);
    const meetings = await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-meetings.v1')).items);
    assert.equal(meetings.length,1); assert.equal(meetings[0].participants.length,3);
    await page.getByRole('button',{name:'关闭 AI 会议助手',exact:true}).click();
    await page.getByRole('button',{name:'测试切换到待办'}).click();
    await page.getByRole('button',{name:/^会议提醒/}).click();
    await page.locator('.meeting-card').filter({hasText:'会议分类隔离验证'}).waitFor();
    await page.getByRole('button',{name:'日程',exact:true}).click();
    await page.locator('.schedule-item').filter({hasText:'会议分类隔离验证'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: explicit meeting form creates one meeting in meeting reminders and schedule, not a todo. Tests use isolated local data, no real invitations or model requests.');
  } catch(e) {
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/published-progress-failure.png',fullPage:true});
    throw e;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
