const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
;(async () => {
 const b = await chromium.connectOverCDP('http://127.0.0.1:19224')
 try {
  const p = b.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'))
  await p.evaluate(async()=>{
   window.__knowledgeTrace = []
   const capture = e => window.__knowledgeTrace.push({event:e.type,tag:e.target.tagName,cls:e.target.className,text:e.target.textContent.slice(0,40),x:e.clientX,y:e.clientY})
   document.addEventListener('click',capture,true)
   window.__knowledgeTraceCleanup=()=>document.removeEventListener('click',capture,true)
   for(const c of ['unminimize','show','set_focus']) await window.__TAURI_INTERNALS__.invoke('plugin:window|'+c,{label:'home'})
   await window.__TAURI_INTERNALS__.invoke('plugin:window|set_size',{label:'home',value:{Logical:{width:1280,height:860}}})
  })
  await p.waitForFunction(()=>innerWidth>=900&&innerHeight>=600)
  await p.getByRole('button',{name:'问问本群',exact:true}).click()
  await p.locator('.knowledge-panel').waitFor()
  await p.getByLabel('想回顾什么事情？').fill('PAY-217 支付联调事项现在什么进展？修复、回归安排和上线条件最后怎么定的？请说明时间变更和是否已有完成确认。')
  await p.screenshot({path:'.preview/chat-knowledge/before-query-bright.png'})
  console.log(JSON.stringify(await p.evaluate(()=>({trace:window.__knowledgeTrace,viewport:[innerWidth,innerHeight],button:document.querySelector('.knowledge-panel button[type=submit]').getBoundingClientRect().toJSON(),colors:{drawer:getComputedStyle(document.querySelector('.n-drawer')).backgroundColor,panel:getComputedStyle(document.querySelector('.knowledge-panel')).color}})),null,2))
 } finally {await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
