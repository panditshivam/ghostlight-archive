import {createRevivalDispatcher} from './revival-dispatch.mjs';
import {TOOL_CATALOG} from './revival-config.mjs';
import {SERVICE_URL} from './revival-service-config.mjs';
const $=id=>document.getElementById(id), required=['recover_title','upgrade_ledger','reconnect_asset'];
let choices=[...required],run,previewReady=false,modelBusy=false,polling=false,lastSnapshot;
const el=(tag,content)=>{const n=document.createElement(tag);n.textContent=content;return n;};
const dispatcher=createRevivalDispatcher({onStatus:e=>{$('model-status').textContent=e.text;},onProgress:e=>{if(Number.isFinite(e.progress)){$('model-progress').hidden=false;$('model-progress').value=e.progress;}}});
async function request(path,{method='GET',body,token=run?.token}={}){
  const response=await fetch(SERVICE_URL+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{'X-Run-Token':token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
  const data=await response.json().catch(()=>({error:'The service is waking or unavailable. Try again shortly.'}));
  if(!response.ok){const messages={WARMING_UP:'The restoration service is waking. Try again shortly.',EXACT_REPAIR_PLAN_REQUIRED:'This exhibit accepts only the three displayed repairs.',ANOTHER_RESTORATION_ACTIVE:'Another visitor is restoring an exhibit. Wait a little, then approve again.',DEMO_CAPACITY_REACHED:'The demo has reached its current run limit. Please return later.',RUN_NOT_FOUND:'This run is no longer available. Reload to start a new rehearsal.',RUN_EXPIRED:'This preview expired. Reload to start a new rehearsal.',NO_INTERRUPTIBLE_WORKER:'The interruption window has closed. The existing run will continue.',INTERRUPT_NOT_ACKNOWLEDGED:'The worker could not acknowledge the interruption in time. The run will continue without a kill.',RATE_LIMITED:'Too many status requests. Wait a moment and resume status.'};throw new Error(messages[data.error]||data.message||'The restoration service could not complete that request.');}
  return data;
}
function fixedPlan(){choices=[...required];$('plan').replaceChildren(...required.map(id=>el('li',TOOL_CATALOG.find(t=>t.id===id).description)));}
function modelState(busy){modelBusy=busy;$('model-plan').disabled=busy||!!run;$('cancel-model').hidden=!busy;$('preview').disabled=busy||!!run;for(const id of ['intent-title','intent-ledger','intent-asset'])$(id).readOnly=busy||!!run;}
$('model-plan').onclick=async()=>{
  modelState(true);$('model-results').replaceChildren();choices=[];previewReady=false;$('approve').disabled=true;
  try{
    for(const id of ['intent-title','intent-ledger','intent-asset']){
      const result=await dispatcher.rank($(id).value),top=result.ranking[0];choices.push(top.id);
      const box=el('div','');box.className='model-decision';box.append(el('p',`${top.title} · cosine ${top.score.toFixed(3)}`),el('small',`${result.intent} · ${result.seconds.toFixed(2)} s comparison after loading/indexing`));$('model-results').append(box);
    }
    $('plan').replaceChildren(...choices.map(id=>el('li',TOOL_CATALOG.find(t=>t.id===id).description)));
    const valid=required.every(id=>choices.includes(id))&&new Set(choices).size===3;
    $('plan-mode').textContent=valid?'Gemma selected these three suggestions. Inspect them before approval.':'The suggestions do not cover all three allowed repairs. Change the request or use the fixed plan.';
    $('model-status').textContent='Gemma analysis complete. Similarity is a suggestion, not confidence or verified correctness.';
    if(!valid){choices=[...required];$('plan').replaceChildren(...required.map(id=>el('li',TOOL_CATALOG.find(t=>t.id===id).description)));$('plan-mode').textContent+=' Fixed plan restored below; this is not a model-selected plan.';}
  }catch(e){$('model-status').textContent=e.message;fixedPlan();$('plan-mode').textContent='Fixed inspectable plan; no completed model plan. Nothing executed.';}
  finally{modelState(false);$('model-progress').hidden=true;}
};
$('cancel-model').onclick=()=>dispatcher.cancel();
$('preview').onclick=async()=>{
  $('preview').disabled=true;$('service-status').textContent='Preparing a source-bound preview. A sleeping host can take about a minute.';
  try{const p=await request('/api/runs',{method:'POST',body:{toolIds:choices},token:null});run={id:p.id,token:p.token};previewReady=true;$('approve').disabled=false;modelState(false);$('service-status').textContent='Preview ready. The three source-bound repairs are awaiting your approval. No repair has run.';$('plan').replaceChildren(...p.preview.map(t=>el('li',t.description)));$('phase').textContent='PREVIEW';}
  catch(e){$('service-status').textContent=e.message;$('preview').disabled=false;}
};
$('approve').onclick=async()=>{
  if(!previewReady||!run)return;$('approve').disabled=true;previewReady=false;$('service-status').textContent='Starting the restoration workflow…';
  try{await request(`/api/runs/${run.id}/approve`,{method:'POST',body:{approved:true}});poll();}
  catch(e){$('service-status').textContent=`${e.message} Checking the run before attempting anything again.`;poll();}
};
const labels={approved:'Repair plan approved',workflow_started:'Temporal workflow started',worker_started:'Restoration worker started',output_written:'Artifact written',ready_to_interrupt:'First write complete; worker awaiting interruption',interrupt_acknowledged:'Worker acknowledged interruption at the write boundary',interrupt_window_closed:'Interruption window closed; continuing normally',worker_killed:'Worker killed with SIGKILL',replacement_started:'Replacement worker started',output_adopted:'Existing artifact verified and adopted',completed:'Exhibit restored',activity_started:'Typed repair started',activity_retry:'Temporal retried the interrupted repair',failed:'Restoration failed'};
function render(snapshot){
  lastSnapshot=snapshot;$('phase').textContent=snapshot.phase.replaceAll('_',' ').toUpperCase();$('interrupt').disabled=!snapshot.canInterrupt;
  if(snapshot.phase==='preview'&&!snapshot.events.some(e=>e.type==='approved')){previewReady=true;$('approve').disabled=false;$('service-status').textContent='The run is still awaiting explicit approval. No repair has run.';}
  const phaseText={starting:['The promise is recorded.','The real workflow and isolated worker are starting.'],running:['The restorer is working.','Typed repairs are running against the fixed exhibit sources.'],ready_to_interrupt:['The first file exists.','Interrupt now: the worker has written its first file but has not reported Activity completion.'],recovering:['The thread broke.','A replacement worker is returning. It must verify the existing artifact before adopting it.'],completed:['The exhibit remembers.','The result below comes from completed, verified file operations.'],failed:['The thread needs attention.','The run failed. Inspect the events; no successful recovery is claimed.']};
  if(phaseText[snapshot.phase]){[$('relay-title').textContent,$('relay-description').textContent]=phaseText[snapshot.phase];}
  document.body.classList.toggle('blackout',snapshot.phase==='recovering');
  $('events').replaceChildren(...snapshot.events.map(event=>{const li=el('li',labels[event.type]||event.type.replaceAll('_',' '));if(event.toolId||event.attempt)li.append(el('small',`${event.toolId||'workflow'}${event.attempt?` · attempt ${event.attempt}`:''}`));return li;}));
  if(snapshot.phase==='completed'&&snapshot.result){const result=snapshot.result;$('restored').hidden=false;$('restored-title').textContent=result.page.title;$('restored-visitors').replaceChildren(...result.visitors.records.map(row=>el('li',`${row.display_name}: ${row.visit_count} visits`)));const url=SERVICE_URL+result.exhibitUrl;$('open-exhibit').href=url;$('restored-portrait').src=url+'/portrait.svg';$('output-evidence').textContent=JSON.stringify(result.outputs,null,2);$('service-status').textContent='Restoration completed. The capsule contains source references and output hashes.';}
  if(snapshot.traceId){const a=el('a','Inspect the bounded run trace in Sentry ↗');a.href=`https://pulastya-ai.sentry.io/explore/traces/trace/${encodeURIComponent(snapshot.traceId)}/`;a.target='_blank';a.rel='noopener';$('trace-link').replaceChildren(a);}
  if(snapshot.phase==='failed'){$('service-status').textContent='The restoration failed. No successful recovery is claimed. ';const b=el('button','Start another rehearsal');b.onclick=()=>location.reload();$('service-status').append(b);}
}
async function poll(){
  if(polling)return;polling=true;const started=Date.now();let terminal=false;
  try{while(run&&Date.now()-started<240000){const snapshot=await request(`/api/runs/${run.id}`);render(snapshot);if(['completed','failed','preview'].includes(snapshot.phase)){terminal=true;break;}await new Promise(resolve=>setTimeout(resolve,800));}if(!terminal)resumeStatus('Status polling reached its time limit. The server may still be working.');}
  catch(e){resumeStatus(e.message);}
  finally{polling=false;}
}
function resumeStatus(message){$('service-status').textContent=`${message} Use Resume status to inspect the existing run.`;const b=el('button','Resume status');b.onclick=()=>{b.remove();poll();};$('service-status').append(' ',b);}
$('interrupt').onclick=async()=>{if(!run||!lastSnapshot?.canInterrupt)return;$('interrupt').disabled=true;try{await request(`/api/runs/${run.id}/interrupt`,{method:'POST',body:{}});$('service-status').textContent='Interruption requested. Waiting for the server’s recovery events.';}catch(e){$('service-status').textContent=e.message;}};
$('download').onclick=async()=>{if(!run||lastSnapshot?.phase!=='completed')return;try{const data=await request(`/api/runs/${run.id}/capsule`),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a','');a.href=url;a.download='ghostlight-recovery-capsule.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('service-status').textContent=e.message;}};
$('new-run').onclick=()=>location.reload();
window.addEventListener('pagehide',()=>dispatcher.dispose());
for(const id of ['intent-title','intent-ledger','intent-asset'])$(id).addEventListener('input',()=>{if(!run&&!modelBusy){fixedPlan();$('plan-mode').textContent='Request edited. Run Gemma again for fresh suggestions, or inspect the fixed plan.';}});
async function loadFixedReview(){
  try{const response=await fetch('./revival-review.json');if(!response.ok)return;const review=await response.json();
    if(review.format!=='ghostlight-fixed-review-v1')return;
    $('critic').hidden=false;$('critic-text').textContent=review.review.summary;
    const list=el('ul','');for(const check of review.review.checks){const item=el('li',check.claim);item.append(el('p',check.reason));list.append(item);}$('critic-text').after(list);
    $('critic-meta').textContent=`${review.label} One ${review.model} request · ${review.usage.prompt_tokens} input tokens · ${review.usage.completion_tokens} output tokens including reasoning. ${review.authority}`;
    const link=el('a','Inspect the exact review, source hashes and usage ↗');link.href='./revival-review.json';link.target='_blank';link.rel='noopener';$('critic-meta').append(' ',link);
  }catch{/* The optional static review never blocks a restoration. */}
}
loadFixedReview();
