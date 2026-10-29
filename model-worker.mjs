import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
import {MODEL,REVISION,OPTIONS} from './model-config.mjs';
import {semanticRank} from './core.mjs';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
let encoder, cachedText='', cachedVectors;
self.onmessage=async ({data:{records,query,requestId}})=>{
  try {
    self.postMessage({type:'status',requestId,text:encoder?'Following the signal…':'Loading the open model. First visit downloads about 23 MB of weights…'});
    encoder ||= await pipeline('feature-extraction',MODEL,{revision:REVISION,dtype:'q8',device:'wasm',progress_callback:e=>{
      if(e.status==='progress'&&e.file?.endsWith('.onnx')) self.postMessage({type:'status',requestId,text:`Loading model… ${Math.round(e.progress)}%`});
    }});
    const started=performance.now(), key=JSON.stringify(records.map(r=>r.text));
    if(key!==cachedText){ cachedVectors=(await encoder(records.map(r=>r.text),OPTIONS)).tolist(); cachedText=key; }
    const v=(await encoder(query,OPTIONS)).tolist()[0];
    self.postMessage({type:'result',requestId,rows:semanticRank(records,cachedVectors,v),seconds:(performance.now()-started)/1000,model:MODEL,revision:REVISION});
  } catch(e){ self.postMessage({type:'error',requestId,text:`Model search failed: ${e.message}. No keyword result has been substituted.`}); }
};
