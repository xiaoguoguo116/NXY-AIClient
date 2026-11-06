// Read-only acceptance for the user's reported task. Never change recipients or completion state.
const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert=require('node:assert/strict')
;(async()=>{
  const browser=await chromium.connectOverCDP('http://127.0.0.1:19224')
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'))
  assert(page)
  try{
    await page.goto('http://tauri.localhost/home/message')
    await page.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor()
    const target=await page.evaluate(()=>{
      const data=JSON.parse(localStorage.getItem('em.local-chat.v1'))
      for(const chat of data.conversations)for(const msg of chat.messages)for(const a of msg.actionDrafts||[])
        if(a.status==='confirmed'&&a.title.includes('整理三处差异'))return {chatId:chat.id,chatName:chat.name,messageId:msg.id,actionId:a.id,title:a.title,before:localStorage.getItem('em.local-todos.v1')}
    })
    assert(target,'reported confirmed task missing')
    await page.getByRole('button',{name:new RegExp(target.chatName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click()
    const card=page.locator(`[data-message-id="${target.messageId}"] .chat-action-card`).filter({hasText:target.title})
    await card.waitFor()
    assert.match(await card.innerText(),/接收人：周铭、李妍/)
    assert.match(await card.innerText(),/默认“我的待办”中不会显示/)
    await card.getByRole('button',{name:'查看这项待办',exact:true}).click()
    await page.waitForURL(url=>url.pathname==='/home/todos'&&url.searchParams.get('assignment')===target.actionId)
    const rows=page.locator('.todos-page > article').filter({hasText:target.title})
    await rows.first().waitFor();assert.equal(await rows.count(),2)
    assert.match(await rows.allTextContents().then(t=>t.join('\n')),/周铭/)
    assert.match(await rows.allTextContents().then(t=>t.join('\n')),/李妍/)
    const group=page.locator('.assignment-progress').filter({hasText:target.title})
    assert.match(await group.innerText(),/已完成 0\/2 人/)
    assert.equal(await page.evaluate(()=>localStorage.getItem('em.local-todos.v1')),target.before)
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/reported-todo-located.png',fullPage:true})
    // A later ordinary menu visit must not reuse the old assignment query.
    await page.locator('.home__sider-nav [aria-label]').nth(1).click()
    await page.waitForURL(url=>url.pathname==='/home/message')
    await page.locator('.home__sider-nav [aria-label="待办事项"]').click()
    await page.waitForURL(url=>url.pathname==='/home/todos'&&!url.searchParams.has('assignment'))
    // The task shortcut must work again after returning through the normal menu.
    await page.locator('.home__sider-nav [aria-label]').nth(1).click()
    await card.getByRole('button',{name:'查看这项待办',exact:true}).click()
    await page.waitForURL(url=>url.searchParams.get('assignment')===target.actionId)
    assert.equal(await page.evaluate(()=>localStorage.getItem('em.local-todos.v1')),target.before)
    console.log('PASS: original confirmed task lists 周铭/李妍; actual chat button navigates to both stored rows and 0/2 progress; original todo data unchanged.')
  }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
