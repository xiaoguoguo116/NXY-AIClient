import ast,asyncio,re,difflib
from pathlib import Path
base=Path('.preview/rag-latency');s=(base/'dialog_service.patched.py').read_text(encoding='utf-8')
nodes=[n for n in ast.parse(s).body if getattr(n,'name','') in ['_ThinkStreamState','_stream_with_think_delta']]
ns={'re':re,'num_tokens_from_string':len};exec(compile(ast.Module(body=nodes,type_ignores=[]),'stream','exec'),ns)
async def verify():
 gate=asyncio.Event()
 async def chunks():
  yield '\u4f60'
  await gate.wait()
  yield '\u597d'
 stream=ns['_stream_with_think_delta'](chunks(),min_tokens=0)
 first=await asyncio.wait_for(anext(stream),.2);assert first[:2]==('text','\u4f60')
 gate.set();assert [x[1] async for x in stream]==['\u597d']
 async def ordinary():
  yield 'a';yield 'b'
 assert [x[1] async for x in ns['_stream_with_think_delta'](ordinary())]==['ab']
asyncio.run(verify())
(base/'stream-preview.patch').write_text(''.join(difflib.unified_diff((base/'dialog_service.original.py').read_text(encoding='utf-8').splitlines(True),s.splitlines(True),fromfile='a/api/db/services/dialog_service.py',tofile='b/api/db/services/dialog_service.py')),encoding='utf-8')
print('Syntax and first-character tests passed. Default batching unchanged.')
