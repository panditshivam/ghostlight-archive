import {AutoConfig,AutoModel,AutoTokenizer,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
import {REVIVAL_MODEL,REVIVAL_REVISION,REVIVAL_DIMENSIONS,REVIVAL_DEVICE,REVIVAL_DTYPE,TOOL_CATALOG,validateRevivalIntent,rankToolVectors} from './revival-config.mjs';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
const pinnedPrefix = `https://huggingface.co/${REVIVAL_MODEL}/resolve/${REVIVAL_REVISION}/`;
const allowed = new Set(['config.json','tokenizer_config.json','tokenizer.json','onnx/model_q4.onnx','onnx/model_q4.onnx_data']);
const originalFetch = env.fetch;
env.fetch = (input,init) => {
  let url = String(input);
  // The tokenizer's metadata probe in 4.3.2 omits its revision.
  if(url === `https://huggingface.co/${REVIVAL_MODEL}/resolve/main/tokenizer_config.json`) url = pinnedPrefix+'tokenizer_config.json';
  if(!url.startsWith(pinnedPrefix)) throw new Error('Model loading requested an unexpected host or revision.');
  const file = decodeURIComponent(url.slice(pinnedPrefix.length).split('?')[0]);
  if(!allowed.has(file)) throw new Error('Model loading requested a file outside the text-only model.');
  return originalFetch(url,init);
};

let model,tokenizer,vectors,loading,busy=false;
const send = (type,requestId,extra={}) => self.postMessage({type,requestId,...extra});
async function prepare(requestId) {
  if(vectors) return;
  if(loading) return loading;
  loading = (async()=>{
    // This quantized model uses GatherBlockQuantized, unavailable in WASM.
    if(!self.navigator.gpu || !await self.navigator.gpu.requestAdapter()) throw new Error('This Gemma model needs a WebGPU-capable browser and GPU. No model files were requested.');
    send('status',requestId,{text:'Loading Gemma for local WebGPU inference. First use needs about 207 MB of model and tokenizer files, plus the runtime.'});
    const config = await AutoConfig.from_pretrained(REVIVAL_MODEL,{revision:REVIVAL_REVISION});
    config.vision_config = null;
    config.audio_config = null;
    model = await AutoModel.from_pretrained(REVIVAL_MODEL,{
      config,revision:REVIVAL_REVISION,dtype:REVIVAL_DTYPE,device:REVIVAL_DEVICE,
      progress_callback:event=>{
        if(event.status === 'progress') send('progress',requestId,{
          file:event.file,loaded:event.loaded,total:event.total,
          progress:Number.isFinite(event.progress)?event.progress:null,
        });
      },
    });
    tokenizer = await AutoTokenizer.from_pretrained(REVIVAL_MODEL,{revision:REVIVAL_REVISION});
    send('status',requestId,{text:'Gemma is indexing the four available repair tools.'});
    vectors=[];
    for(const tool of TOOL_CATALOG) vectors.push(await encode(`title: ${tool.id} | text: ${tool.description}`));
  })();
  try {await loading;} finally {loading=null;}
}
async function encode(text) {
  const output = await model(await tokenizer(text,{padding:true,truncation:true,max_length:256}));
  const tensor = output.sentence_embedding;
  if(!tensor || tensor.dims.length !== 2 || tensor.dims[0] !== 1 || tensor.dims[1] !== REVIVAL_DIMENSIONS) throw new Error('Gemma returned an unexpected embedding shape.');
  return tensor.tolist()[0];
}
self.onmessage = async ({data}) => {
  const {type,requestId}=data??{};
  if(type !== 'rank' || typeof requestId !== 'string') return;
  if(busy) {send('error',requestId,{text:'A repair request is already being analyzed.'});return;}
  busy=true;
  try {
    const intent = validateRevivalIntent(data.intent);
    await prepare(requestId);
    send('status',requestId,{text:'Gemma is comparing the request with the four tool descriptions.'});
    const started=performance.now();
    const ranking=rankToolVectors(vectors,await encode(`task: search result | query: ${intent}`));
    send('result',requestId,{
      intent,ranking,model:REVIVAL_MODEL,revision:REVIVAL_REVISION,dimensions:REVIVAL_DIMENSIONS,
      seconds:(performance.now()-started)/1000,selection:'embedding_similarity',device:REVIVAL_DEVICE,dtype:REVIVAL_DTYPE,
      explanation:'Gemma compared your request with four tool descriptions. These cosine similarities are suggestions, not confidence probabilities. Review a tool before approving any change.',
    });
  } catch(error) {
    vectors=undefined;
    if(model) {try {await model.dispose();} catch{}}
    model=undefined;tokenizer=undefined;
    send('error',requestId,{text:`Gemma analysis failed: ${error.message || String(error)}. No other model or keyword result was substituted.`});
  } finally {busy=false;}
};
