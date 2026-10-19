import {requestRag} from '../src/services/ragChat.ts';
import fs from 'node:fs';
const storage={getItem:()=>null};
const options={storage,fetcher:fetch};
const report={};
try {
  report.initial=await requestRag('加值班制度',new AbortController().signal,options);
  fs.writeFileSync(new URL('./recovered-rag-result.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify({stage:'initial',text:report.initial.text,options:report.initial.options,hasCache:!!report.initial.cacheId}));
  if(report.initial.options.length) {
    const choice=report.initial.options[0];
    report.followup=await requestRag(choice.question,new AbortController().signal,{...options,previous:report.initial,
      selection:{cache_id:report.initial.cacheId,option_id:choice.id}});
    fs.writeFileSync(new URL('./recovered-rag-result.json',import.meta.url),JSON.stringify(report,null,2));
    console.log(JSON.stringify({stage:'followup',question:choice.question,text:report.followup.text,references:report.followup.references.length}));
  }
}catch(error){console.error(error.message);process.exitCode=1;}
