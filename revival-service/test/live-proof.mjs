import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import net from 'node:net';
const exec=promisify(execFile),root=new URL('../',import.meta.url),port=18796,base='http://127.0.0.1:'+port;
const temp=await mkdtemp(join(tmpdir(),'ghostlight-live-proof-'));
const receipt={status:'started',scope:'Actual local HTTP API, Mastra tools, Temporal process-kill lifecycle; not Docker/Render or Sentry delivery validation',assertions:{},peak_aggregate_rss_kib:0,peak_processes:[]};
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:temp,TEMPORAL_BIN:process.env.TEMPORAL_BIN||'/tmp/ghostlight-temporal-cli/temporal',SENTRY_DSN:'',NODE_OPTIONS:'--max-old-space-size=128'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,bound=45000){const start=Date.now();while(Date.now()-start<bound){const x=await fn();if(x)return x;await pause(300);}throw Error('HTTP proof deadline');}
async function request(path,options={}){const response=await fetch(base+path,options);const body=await response.json();return {status:response.status,body};}
function post(body,token){return {method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Run-Token':token}:{})},body:JSON.stringify(body)};}
async function sampleMemory(){try{const {stdout}=await exec('ps',['-axo','pid=,ppid=,rss=']);const rows=stdout.trim().split('\n').map(x=>x.trim().split(/\s+/).map(Number));const included=new Set([child.pid]);for(let i=0;i<5;i++)for(const[p,pp]of rows)if(included.has(pp))included.add(p);const own=rows.filter(([p])=>included.has(p)),total=own.reduce((s,x)=>s+x[2],0);if(total>receipt.peak_aggregate_rss_kib){receipt.peak_aggregate_rss_kib=total;receipt.peak_processes=own.map(([pid,ppid,rss_kib])=>({pid,ppid,rss_kib}));}}catch{}}
const memTimer=setInterval(()=>void sampleMemory(),500);
try{
 await until(async()=>{try{return(await request('/health.json')).body.temporalReady;}catch{return false;}});
 const invalid=await request('/api/runs',post({toolIds:['recover_title']}));assert.equal(invalid.status,400);
 const created=await request('/api/runs',post({toolIds:['recover_title','upgrade_ledger','reconnect_asset']}));assert.equal(created.status,201);const {id,token}=created.body;receipt.id=id;
 assert.equal(created.body.phase,'preview');assert.equal(created.body.events.length,0);assert(created.body.sourceMarkdown.includes('The Marigold Room'));
 const denied=await request('/api/runs/'+id);assert.equal(denied.status,404);
 const noApproval=await request('/api/runs/'+id+'/approve',post({approved:false},token));assert.equal(noApproval.status,400);
 const approved=await request('/api/runs/'+id+'/approve',post({approved:true},token));assert.equal(approved.status,202);
 const path='/api/runs/'+id,auth={headers:{'X-Run-Token':token}};
 const waiting=await until(async()=>{const x=(await request(path,auth)).body;if(x.phase==='failed')throw Error('Service failed before interrupt');return x.canInterrupt&&x;});
 receipt.before_interrupt=waiting;
 const interrupted=await request(path+'/interrupt',post({},token));assert.equal(interrupted.status,202);assert(interrupted.body.events.some(x=>x.type==='worker_killed'&&x.signal==='SIGKILL'));assert(interrupted.body.events.some(x=>x.type==='interrupt_acknowledged'&&x.toolId==='recover_title'));const ackIndex=interrupted.body.events.findIndex(x=>x.type==='interrupt_acknowledged');const killIndex=interrupted.body.events.findIndex(x=>x.type==='worker_killed');assert(ackIndex>=0&&ackIndex<killIndex);
 const done=await until(async()=>{const x=(await request(path,auth)).body;if(x.phase==='failed')throw Error('Service restoration failed');return x.phase==='completed'&&x;},50000);receipt.completed=done;
 assert.equal(done.result.page.title,'The Marigold Room');assert.equal(done.result.visitors.records[0].display_name,'Asha');assert.equal(done.result.verified,true);
 assert(done.events.some(x=>x.type==='activity_retry'&&x.attempt===2));assert(done.events.some(x=>x.type==='output_adopted'&&x.toolId==='recover_title'));
 for(const toolId of ['recover_title','upgrade_ledger','reconnect_asset'])assert.equal(done.events.filter(x=>x.type==='output_written'&&x.toolId===toolId).length,1);
 const replay=await request(path+'/approve',post({approved:true},token));assert.equal(replay.status,200);assert.equal(replay.body.events.filter(x=>x.type==='output_written').length,3);
 const capsule=await request(path+'/capsule',auth);assert.equal(capsule.status,200);assert.equal(capsule.body.verified,true);
 const html=await fetch(base+done.result.exhibitUrl);assert.equal(html.status,200);assert((await html.text()).includes('Temporal retried'));
 await until(async()=>!(await request('/health.json')).body.active,12000);
 const automatic=await request('/api/runs',post({toolIds:['recover_title','upgrade_ledger','reconnect_asset']}));assert.equal(automatic.status,201);const secondPath='/api/runs/'+automatic.body.id;const secondAuth={headers:{'X-Run-Token':automatic.body.token}};await request(secondPath+'/approve',post({approved:true},automatic.body.token));const noInterrupt=await until(async()=>{const x=(await request(secondPath,secondAuth)).body;if(x.phase==='failed')throw Error('Automatic continuation failed');return x.phase==='completed'&&x;});assert(!noInterrupt.events.some(e=>e.type==='worker_killed'));assert(noInterrupt.events.some(e=>e.type==='interrupt_window_closed'));const late=await request(secondPath+'/interrupt',post({},automatic.body.token));assert.equal(late.status,409);receipt.automatic_completion=true;
 receipt.assertions={late_interrupt_rejected_without_kill:true,acknowledged_before_worker_kill:true,automatic_continue_without_kill:true,preview_before_work:true,full_plan_validated:true,token_required:true,explicit_approval_required:true,actual_interrupt_endpoint_observed_SIGKILL:true,temporal_retry_attempt_2:true,verified_output_adopted:true,one_write_per_tool:true,three_repairs_completed:true,repeat_approval_no_more_effects:true,downloadable_verified_capsule:true,public_safe_exhibit:true};receipt.status='completed';
}catch(e){receipt.status='failed';receipt.error=String(e.stack);process.exitCode=1;}
finally{
 clearInterval(memTimer);await sampleMemory();
 const ended=new Promise(r=>child.once('exit',(code,signal)=>r({code,signal})));child.kill('SIGTERM');receipt.shutdown=await Promise.race([ended,pause(14000).then(()=>null)]);if(!receipt.shutdown){child.kill('SIGKILL');receipt.shutdown=await ended;}
 receipt.teardown={};for(const check of [port,17433,18234,19234])receipt.teardown[check]=await new Promise(r=>{const socket=net.connect({port:check,host:'127.0.0.1'});socket.on('connect',()=>{socket.destroy();r(false)});socket.on('error',()=>r(true));});
 if(!Object.values(receipt.teardown).every(Boolean)){receipt.status='failed';receipt.teardown_error='A service port survived';process.exitCode=1;}
 await writeFile(new URL('../proof-result.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');await writeFile(join(temp,'service.log'),logs);
 console.log(JSON.stringify({status:receipt.status,assertions:receipt.assertions,peak_aggregate_rss_kib:receipt.peak_aggregate_rss_kib,teardown:receipt.teardown,error:receipt.error,private_log:join(temp,'service.log')},null,2));
}
