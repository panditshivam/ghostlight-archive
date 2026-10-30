import express from 'express';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,appendFile,rm,copyFile} from 'node:fs/promises';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Connection,Client} from '@temporalio/client';
import {materializeRepair,toolVersion} from './repair-tools.mjs';
import {SOURCE_FILES,TOOL_IDS,DESCRIPTIONS,hash,json,validateTools,DATA_NOTICE} from './contract.mjs';
import {initTelemetry,trace,traceCarrier,failure,flush} from './telemetry.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const dataRoot=resolve(process.env.DATA_DIR||join(here,'.data'));
const port=Number(process.env.PORT||8080),host=process.env.HOST||'0.0.0.0';
const allowedOrigins=new Set((process.env.ALLOWED_ORIGINS||'https://shivampandit-ghostlight-archive.static.hf.space').split(',').filter(Boolean));
const jobs=new Map(),creationTimes=[];let pendingCreations=0;let active=null,worker=null,connection,client,ready=false,closing=false;
const childProcesses=new Set();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
initTelemetry();await mkdir(dataRoot,{recursive:true});
function startChild(command,args,env={}){const child=spawn(command,args,{cwd:here,env:{...process.env,...env,DATA_DIR:dataRoot},stdio:['ignore','ignore','inherit']});childProcesses.add(child);child.on('exit',()=>childProcesses.delete(child));child.on('error',()=>{child.spawnFailed=true;childProcesses.delete(child);});return child;}
async function stopChild(child,signal='SIGTERM'){
 if(!child||child.spawnFailed||child.exitCode!==null||child.signalCode!==null)return;
 const ended=new Promise(r=>child.once('exit',(code,signal)=>r({code,signal})));
 child.kill(signal);const result=await Promise.race([ended,delay(4000).then(()=>null)]);
 if(result)return result;child.kill('SIGKILL');return ended;
}
const temporal=startChild(process.env.TEMPORAL_BIN||'temporal',['server','start-dev','--headless','--ip','127.0.0.1','--port','17433','--http-port','18234','--metrics-port','19234','--db-filename',join(dataRoot,'temporal.sqlite')]);
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
app.use((req,res,next)=>{
 res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','no-store');
 const origin=req.get('Origin');if(origin){if(!allowedOrigins.has(origin)&&!/^http:\/\/localhost:\d+$/.test(origin)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'});res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type,X-Run-Token');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
 if(req.method==='OPTIONS')return res.sendStatus(204);next();
});
app.use(express.json({limit:'2kb',strict:true}));
const requestBuckets=new Map();
app.use('/api',(req,res,next)=>{const key=hash(req.ip||'unknown').slice(0,16),now=Date.now();if(!requestBuckets.has(key)&&requestBuckets.size>=1000){for(const[k,v]of requestBuckets)if(now-v.since>60000)requestBuckets.delete(k);if(requestBuckets.size>=1000)return res.status(429).json({error:'RATE_LIMITED'});}const b=requestBuckets.get(key)||{since:now,count:0};if(now-b.since>60000){b.since=now;b.count=0;}b.count++;requestBuckets.set(key,b);if(requestBuckets.size>1000){for(const [k,v]of requestBuckets)if(now-v.since>60000)requestBuckets.delete(k);}if(b.count>240||requestBuckets.size>1100)return res.status(429).json({error:'RATE_LIMITED'});next();});
app.get('/health.json',(req,res)=>res.status(ready?200:503).json({ok:ready,temporalReady:ready,ephemeral:true,active:active!==null,service:'ghostlight-revival'}));
async function event(job,type,data={}){await appendFile(join(job.dir,'events.jsonl'),JSON.stringify({type,...data})+'\n');}
async function events(job){try{return(await readFile(join(job.dir,'events.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(e){if(e.code==='ENOENT')return[];throw e;}}
async function snapshot(job){const list=await events(job);const canInterrupt=job.phase==='running'&&!job.interrupted&&!job.interruptPending&&!job.interruptUnavailable&&list.some(e=>e.type==='ready_to_interrupt')&&!list.some(e=>e.type==='interrupt_window_closed');return {id:job.id,phase:canInterrupt?'ready_to_interrupt':job.phase,canInterrupt,events:list,ephemeral:true,traceId:job.traceId||null,result:job.result||null,error:job.error||null,expiresAt:job.expiresAt,dataNotice:DATA_NOTICE};}
function guard(req,res,next){const job=jobs.get(req.params.id),token=req.get('X-Run-Token')||'';if(!job||! /^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(job.token)))return res.status(404).json({error:'RUN_NOT_FOUND'});req.job=job;next();}
app.post('/api/runs',async(req,res)=>{
 if(!ready)return res.status(503).json({error:'WARMING_UP'});
 if(!req.body||Object.keys(req.body).some(k=>k!=='toolIds')||!validateTools(req.body.toolIds))return res.status(400).json({error:'EXACT_REPAIR_PLAN_REQUIRED'});
 const now=Date.now();while(creationTimes.length&&creationTimes[0]<now-3600000)creationTimes.shift();
 for(const[id,j]of jobs)if(j.expiresAt<now&&id!==active){jobs.delete(id);await rm(j.dir,{recursive:true,force:true});}
 if(jobs.size+pendingCreations>=24||creationTimes.length>=60)return res.status(429).json({error:'DEMO_CAPACITY_REACHED'});
 creationTimes.push(now);pendingCreations++;try{
 const id=randomUUID(),dir=join(dataRoot,id),token=randomBytes(32).toString('hex');await mkdir(dir);
 const inputHashes={};for(const file of SOURCE_FILES){await copyFile(join(here,'fixtures',file),join(dir,file));inputHashes[file]=hash(await readFile(join(dir,file)));}
 const job={id,dir,token,phase:'preview',interrupted:false,toolIds:req.body.toolIds,inputHashes,expiresAt:now+15*60000};jobs.set(id,job);
 res.status(201).json({...await snapshot(job),token,preview:job.toolIds.map(toolId=>({toolId,description:DESCRIPTIONS[toolId]})),sourceMarkdown:await readFile(join(dir,'source.md'),'utf8'),legacyFixture:JSON.parse(await readFile(join(dir,'fixture.json'),'utf8'))});
 }finally{pendingCreations--;}
});
function launchWorker(job,hold){worker=startChild(process.execPath,['worker.mjs'],{RUN_ID:job.id,HOLD_FOR_INTERRUPT:hold?'1':'0'});worker.on('exit',()=>{if(!closing&&job.phase==='running')void job.handle?.terminate('WORKER_STOPPED').catch(()=>{});});return worker;}
async function finish(job,result){
 const fixture=JSON.parse(await readFile(join(job.dir,'fixture.json'),'utf8')),markdown=await readFile(join(job.dir,'source.md'),'utf8'),portraitBytes=await readFile(join(job.dir,'marigold-portrait.svg'));
 const verified={};for(const toolId of TOOL_IDS){const expected=materializeRepair(toolId,{fixture,markdown,portraitBytes}),body=await readFile(join(job.dir,expected.file),'utf8');if(body!==expected.body)throw Error('OUTPUT_VERIFICATION_FAILED');verified[toolId]=JSON.parse(body);}
 job.result={page:verified.recover_title,visitors:verified.upgrade_ledger,asset:verified.reconnect_asset,verified:true,workflowId:job.id,outputs:result.outputs,exhibitUrl:'/exhibits/'+job.id};job.phase='completed';await event(job,'completed',{completedTools:3});
}
async function execute(job){
 let deadline;
 try{
  await trace('revival.workflow',{'gen_ai.agent.name':'ghostlight-revival'},async()=>{
   launchWorker(job,true);job.phase='running';await event(job,'workflow_started');
   const carrier=traceCarrier();job.traceCarrier=carrier;const traceId=carrier.sentryTrace?.split('-')[0];if(process.env.SENTRY_DSN&&/^[a-f0-9]{32}$/.test(traceId||''))job.traceId=traceId;
   job.handle=await client.workflow.start('revival',{taskQueue:'ghostlight-revival',workflowId:job.id,args:[{runId:job.id,toolIds:job.toolIds,toolVersion,inputHashes:job.inputHashes,trace:carrier}],workflowExecutionTimeout:'180 seconds'});
   deadline=setTimeout(()=>job.handle.terminate('BOUND_REACHED').catch(()=>{}),185000);
   const result=await job.handle.result();await finish(job,result);
  });
 }catch{job.phase='failed';job.error='RESTORATION_FAILED';await event(job,'failed',{code:'RESTORATION_FAILED'});failure();}
 finally{clearTimeout(deadline);await stopChild(worker);worker=null;if(active===job.id)active=null;await flush();}
}
app.post('/api/runs/:id/approve',guard,async(req,res)=>{
 const job=req.job;if(!req.body||req.body.approved!==true||Object.keys(req.body).some(k=>k!=='approved'))return res.status(400).json({error:'EXPLICIT_APPROVAL_REQUIRED'});
 if(job.phase!=='preview')return res.json(await snapshot(job));if(active)return res.status(409).json({error:'ANOTHER_RESTORATION_ACTIVE'});if(job.expiresAt<Date.now())return res.status(410).json({error:'RUN_EXPIRED'});
 active=job.id;job.phase='starting';await trace('revival.approval',{phase:'approved'},()=>event(job,'approved'));void execute(job);res.status(202).json(await snapshot(job));
});
app.get('/api/runs/:id',guard,async(req,res)=>res.json(await snapshot(req.job)));
app.post('/api/runs/:id/interrupt',guard,async(req,res)=>{
 const job=req.job;if(req.body&&Object.keys(req.body).length)return res.status(400).json({error:'EMPTY_BODY_REQUIRED'});
 if(!(await snapshot(job)).canInterrupt)return res.status(409).json({error:'NO_INTERRUPTIBLE_WORKER'});
 job.interruptPending=true;const dying=worker;await writeFile(join(job.dir,'interrupt-request'),'request');let acknowledged=false;const requested=Date.now();while(Date.now()-requested<8000){try{await readFile(join(job.dir,'interrupt-ack'));acknowledged=true;break;}catch{}await delay(100);}if(!acknowledged||worker!==dying||dying.exitCode!==null||dying.signalCode!==null){job.interruptPending=false;job.interruptUnavailable=true;await rm(join(job.dir,'interrupt-request'),{force:true});return res.status(409).json({error:'INTERRUPT_WINDOW_CLOSED'});}job.interrupted=true;job.interruptPending=false;job.phase='recovering';const observed=await stopChild(dying,'SIGKILL');if(observed?.signal!=='SIGKILL'){job.phase='failed';job.error='WORKER_NOT_INTERRUPTED';return res.status(409).json({error:'WORKER_NOT_INTERRUPTED'});}
 await trace('revival.worker_exit',{controlled_fault:true,phase:'killed'},()=>event(job,'worker_killed',{signal:'SIGKILL'}),job.traceCarrier);
 launchWorker(job,false);await event(job,'replacement_started');res.status(202).json(await snapshot(job));
});
app.get('/api/runs/:id/capsule',guard,async(req,res)=>{if(req.job.phase!=='completed')return res.status(409).json({error:'NOT_COMPLETED'});res.set('Content-Disposition','attachment; filename="ghostlight-restoration.json"');res.json({kind:'ghostlight-original-fiction-restoration',...req.job.result});});
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.get('/exhibits/:id/portrait.svg',(req,res)=>{const job=jobs.get(req.params.id);if(!job||job.phase!=='completed')return res.sendStatus(404);res.type('image/svg+xml').sendFile(join(here,'fixtures','marigold-portrait.svg'));});
app.get('/exhibits/:id',(req,res)=>{
 const job=jobs.get(req.params.id);if(!job||job.phase!=='completed')return res.sendStatus(404);const r=job.result;
 res.set('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
 res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escape(r.page.title)+'</title><style>body{background:#102c28;color:#faf2dc;font:20px/1.5 system-ui;max-width:740px;margin:50px auto;padding:24px}h1{color:#edbd63}img{width:160px}li{margin:1em 0}</style><p>Ghostlight Revival Relay · original fictional exhibit</p><h1>'+escape(r.page.title)+'</h1><img src="/exhibits/'+job.id+'/portrait.svg" alt="Original marigold portrait restored from the fixture"><p>The title, portrait reference and visitor ledger were restored and verified by bounded tools.</p><ul>'+r.visitors.records.map(row=>'<li>'+escape(row.display_name)+': '+row.visit_count+' visits</li>').join('')+'</ul><p>Verified restoration · '+(job.interrupted?'A real worker was killed after its first output. Temporal retried; the replacement verified and adopted it.':'This run completed without a worker interruption.')+'</p></html>');
});
app.use((err,req,res,next)=>res.status(err?.type==='entity.too.large'?413:400).json({error:'INVALID_REQUEST'}));
const server=app.listen(port,host,()=>console.log('Ghostlight restoration API listening'));
try{for(let i=0;i<60&&!ready;i++){try{connection=await Connection.connect({address:'127.0.0.1:17433',connectTimeout:'1 second'});await connection.workflowService.getSystemInfo({});client=new Client({connection,namespace:'default'});ready=true;}catch{await delay(250);}}if(!ready)throw Error('TEMPORAL_UNAVAILABLE');}catch{console.error('Temporal service unavailable');await shutdown();process.exitCode=1;}
async function shutdown(){if(closing)return;closing=true;ready=false;server.close();if(active){const job=jobs.get(active);try{await job?.handle?.terminate('SERVICE_SHUTDOWN');}catch{}}for(const child of [...childProcesses])await stopChild(child);await connection?.close();await flush();}
process.on('SIGTERM',()=>void shutdown().finally(()=>process.exit(0)));process.on('SIGINT',()=>void shutdown().finally(()=>process.exit(0)));
