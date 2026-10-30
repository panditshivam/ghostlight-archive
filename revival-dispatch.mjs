import {validateRevivalIntent,TOOL_CATALOG,REVIVAL_MODEL,REVIVAL_REVISION,REVIVAL_DIMENSIONS,REVIVAL_DEVICE,REVIVAL_DTYPE} from './revival-config.mjs';

export function createRevivalDispatcher({onStatus=()=>{},onProgress=()=>{},timeoutMs=240000}={}) {
  let worker,pending,disposed=false,sequence=0;
  const stopWorker = () => {worker?.terminate();worker=undefined;};
  const settle = (error,value) => {
    const request=pending;
    if(!request) return;
    pending=undefined;clearTimeout(request.timer);
    if(error) request.reject(error);else request.resolve(value);
  };
  const startWorker = () => {
    if(worker) return;
    worker=new Worker(new URL('./revival-model-worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(!pending || data?.requestId !== pending.requestId) return;
      if(data.type === 'status') onStatus(data);
      else if(data.type === 'progress') onProgress(data);
      else if(data.type === 'error') settle(new Error(data.text));
      else if(data.type === 'result') {
        const ids=new Set(Array.isArray(data.ranking)?data.ranking.map(row=>row?.id):[]);
        const valid=data.model===REVIVAL_MODEL && data.revision===REVIVAL_REVISION && data.dimensions===REVIVAL_DIMENSIONS && data.device===REVIVAL_DEVICE && data.dtype===REVIVAL_DTYPE && Array.isArray(data.ranking) && data.ranking.length===TOOL_CATALOG.length && ids.size===TOOL_CATALOG.length && TOOL_CATALOG.every(tool=>ids.has(tool.id)) && data.ranking.every(row=>Number.isFinite(row.score));
        if(valid) settle(null,data);
        else {stopWorker();settle(new Error('The model returned an invalid tool ranking.'));}
      }
    };
    worker.onerror=event=>{
      event.preventDefault?.();stopWorker();
      settle(new Error(`The Gemma worker stopped: ${event.message || 'worker or runtime could not load'}. No substitute model was used.`));
    };
    worker.onmessageerror=()=>{stopWorker();settle(new Error('The model worker returned an unreadable result.'));};
  };
  return {
    rank(value) {
      if(disposed) return Promise.reject(new Error('This model session is closed.'));
      if(pending) return Promise.reject(new Error('Wait for the current request or cancel it.'));
      let intent;
      try {intent=validateRevivalIntent(value);startWorker();} catch(error) {return Promise.reject(error);}
      return new Promise((resolve,reject)=>{
        const requestId=`revival-${++sequence}`;
        const timer=setTimeout(()=>{stopWorker();settle(new Error('Gemma loading or inference timed out. You can retry; no substitute result was returned.'));},timeoutMs);
        pending={requestId,resolve,reject,timer};
        worker.postMessage({type:'rank',requestId,intent});
      });
    },
    cancel() {
      stopWorker();
      settle(new DOMException('Gemma analysis was cancelled.','AbortError'));
    },
    dispose() {
      disposed=true;stopWorker();
      settle(new DOMException('The Gemma session was closed.','AbortError'));
    },
  };
}
