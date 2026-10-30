export const REVIVAL_MODEL = 'onnx-community/embeddinggemma-2-ONNX';
export const REVIVAL_REVISION = 'daa72c51243991dfcaf9f9137d2c573d8f7790c0';
export const REVIVAL_DIMENSIONS = 768;
export const REVIVAL_MAX_INTENT = 600;
export const REVIVAL_DOWNLOAD_BYTES = 206696682;
// The quantized embedding lookup requires WebGPU; WASM is not a fallback.
export const REVIVAL_DEVICE = 'webgpu';
export const REVIVAL_DTYPE = 'q4';
export const TOOL_CATALOG = Object.freeze([
  Object.freeze({id:'recover_title',title:'Recover the title',description:'Restore a missing page title by recovering the heading from its original markdown document.'}),
  Object.freeze({id:'upgrade_ledger',title:'Upgrade the visitor ledger',description:'Convert an old visitor guest list ledger with obsolete field names into the current structured records schema.'}),
  Object.freeze({id:'reconnect_asset',title:'Reconnect the portrait',description:'Repair a broken portrait picture asset reference after a folder move using the package asset inventory.'}),
  Object.freeze({id:'audit_contact_data',title:'Check for contact data',description:'Inspect a package for personal email addresses and produce a privacy findings report without deleting or publishing anything.'}),
]);

export function validateRevivalIntent(value) {
  if(typeof value !== 'string') throw new TypeError('Describe the repair in text.');
  const intent = value.trim();
  if(!intent || intent.length > REVIVAL_MAX_INTENT) throw new RangeError(`Use 1–${REVIVAL_MAX_INTENT} characters for the repair request.`);
  return intent;
}

export function rankToolVectors(vectors, query) {
  const check = vector => {
    if(!Array.isArray(vector) || vector.length !== REVIVAL_DIMENSIONS || !vector.every(Number.isFinite)) throw new Error('The model returned invalid embeddings.');
    const norm = Math.hypot(...vector);
    if(Math.abs(norm-1) > 0.03) throw new Error('The model returned embeddings that are not normalized.');
  };
  if(!Array.isArray(vectors) || vectors.length !== TOOL_CATALOG.length) throw new Error('The model returned an incomplete tool index.');
  check(query);
  return TOOL_CATALOG.map((tool,index)=>{
    check(vectors[index]);
    const score = query.reduce((sum,value,i)=>sum+value*vectors[index][i],0);
    return {...tool,score};
  }).sort((a,b)=>b.score-a.score);
}

// The game ending requires the exact verified exhibit, not a phase label alone.
export function isVerifiedRoomResult(result,runId) {
  const ids=['recover_title','upgrade_ledger','reconnect_asset'];
  return result?.verified===true&&typeof result.page?.title==='string'&&Array.isArray(result.visitors?.records)&&result.visitors.records.every(r=>typeof r.display_name==='string'&&Number.isFinite(r.visit_count))&&Array.isArray(result.outputs)&&result.outputs.length===3&&ids.every(id=>result.outputs.some(o=>o.toolId===id))&&result.exhibitUrl===`/exhibits/${runId}`;
}
