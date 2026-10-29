import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pipeline,env} from '@huggingface/transformers';
import {archive} from './archive.mjs';
import {MODEL,REVISION,OPTIONS} from './model-config.mjs';
import {semanticRank,keywordRank} from './core.mjs';
env.allowLocalModels=false;
// Fixed before inference. These are authored functional examples, not a benchmark.
const fixtures=[
  {query:'What kept playing after the musician stopped?',expected:'M1'},
  {query:'Why did I hear someone walking upstairs?',expected:'A1'},
  {query:'Where did the quiet voice behind the books come from?',expected:'L1'},
  {query:'What extinguished the flames beside the instrument?',expected:'M2'},
  {query:'Who left a light outside to help someone get home?',expected:'G1'},
  {query:'How can I repair a rocket engine?',expected:null},
];
const encoder=await pipeline('feature-extraction',MODEL,{revision:REVISION,dtype:'q8',device:'cpu'});
const vectors=(await encoder(archive.map(r=>r.text),OPTIONS)).tolist();
assert.equal(vectors.length,12);assert.equal(vectors[0].length,384);
const results=[];
for(const f of fixtures){const started=performance.now();const v=(await encoder(f.query,OPTIONS)).tolist()[0];results.push({...f,semantic:semanticRank(archive,vectors,v),keyword:keywordRank(archive,f.query),seconds:(performance.now()-started)/1000});}
const receipt={model:MODEL,revision:REVISION,runtime:'Transformers.js 4.3.2 CPU',scope:'Six fixed synthetic functional queries, including an out-of-domain query. Not held-out accuracy or browser timing.',results};
await writeFile('model-check.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({query:r.query,expected:r.expected,top:r.semantic[0].id,score:r.semantic[0].score,keyword:r.keyword.map(k=>k.id)})),null,2));
