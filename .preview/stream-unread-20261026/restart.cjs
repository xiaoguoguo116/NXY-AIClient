const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try {
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));
  if(!page)throw Error('Formal window missing');
  const data=await page.evaluate(()=>{
   if([...document.querySelectorAll('textarea')].some(n=>n.value.trim()))throw Error('Unsaved draft: restart deferred');
   const chat=JSON.parse(localStorage.getItem('em.local-chat.v1'));
   if(chat?.conversations.some(c=>c.messages.some(m=>m.status==='pending')))throw Error('Active AI request: restart deferred');
   if(document.querySelector('.workbench__composer--busy,[role=dialog],dialog[open]'))throw Error('Active task or dialog: restart deferred');
   return {route:location.href, storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))};
  });
  const backup=path.join(os.tmpdir(),'em-stream-unread-20261026-backup.json');
  fs.writeFileSync(backup,JSON.stringify(data),{mode:0o600});
  const hashes=Object.fromEntries(Object.entries(data.storage).filter(([key])=>key!=='em.local-chat.v1').map(([key,value])=>[key,crypto.createHash('sha256').update(value).digest('hex')]));
  fs.writeFileSync('.preview/stream-unread-20261026/storage-hashes.json',JSON.stringify(hashes));
  await page.evaluate(()=>setTimeout(()=>window.__TAURI_INTERNALS__.invoke('plugin:process|exit',{code:0}),200));
  console.log('Original settings backed up privately; requested normal exit.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
