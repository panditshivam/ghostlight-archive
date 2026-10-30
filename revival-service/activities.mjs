import assert from 'node:assert/strict';
import {readFile,writeFile,rename,appendFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {Context,heartbeat} from '@temporalio/activity';
import {createTool} from '@mastra/core/tools';
import {z} from 'zod';
import {materializeRepair,toolVersion} from './repair-tools.mjs';
import {SOURCE_FILES,TOOL_IDS,hash,json} from './contract.mjs';
import {trace,recordAttributes} from './telemetry.mjs';
const dataRoot=process.env.DATA_DIR;
const tools=Object.fromEntries(TOOL_IDS.map(toolId=>[toolId,createTool({id:toolId,description:'Bounded original exhibit restoration: '+toolId,inputSchema:z.object({fixture:z.any(),markdown:z.string(),portraitBase64:z.string()}),outputSchema:z.object({file:z.string(),body:z.string()}),execute:async input=>materializeRepair(toolId,{fixture:input.fixture,markdown:input.markdown,portraitBytes:Buffer.from(input.portraitBase64,'base64')})})]));
async function event(dir,type,data={}){await appendFile(join(dir,'events.jsonl'),JSON.stringify({type,...data})+'\n');}
export async function restore(plan){
 const info=Context.current().info;
 return trace(info.attempt>1?'revival.retry':'revival.repair',{tool_id:plan.toolId,attempt:info.attempt,'gen_ai.tool.name':plan.toolId,'gen_ai.agent.name':'ghostlight-revival','gen_ai.operation.name':'execute_tool'},async()=>{
  assert.equal(plan.runId,process.env.RUN_ID);assert.equal(plan.toolVersion,toolVersion);assert(TOOL_IDS.includes(plan.toolId));
  const dir=join(dataRoot,plan.runId),raw={};
  for(const file of SOURCE_FILES){raw[file]=await readFile(join(dir,file));assert.equal(hash(raw[file]),plan.inputHashes[file],'INPUT_CHANGED');}
  await event(dir,info.attempt>1?'activity_retry':'activity_started',{toolId:plan.toolId,attempt:info.attempt});
  const output=await tools[plan.toolId].execute({fixture:JSON.parse(raw['fixture.json']),markdown:raw['source.md'].toString(),portraitBase64:raw['marigold-portrait.svg'].toString('base64')});
  const target=join(dir,output.file),sha256=hash(output.body);let current;
  try{current=await readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const adopted=current!==undefined;recordAttributes({effect:adopted?'adopt_verified':'write_new',input_match:true,output_match:adopted?current===output.body:true,rewritten:!adopted});
  if(adopted)assert.equal(current,output.body,'OUTPUT_CONFLICT');
  else{await writeFile(target+'.tmp',output.body,{flag:'wx'});await rename(target+'.tmp',target);}
  await event(dir,adopted?'output_adopted':'output_written',{toolId:plan.toolId,attempt:info.attempt,sha256});
  if(plan.toolId==='recover_title'&&info.attempt===1&&process.env.HOLD_FOR_INTERRUPT==='1'){
   await event(dir,'ready_to_interrupt',{toolId:plan.toolId,attempt:1});await writeFile(join(dir,'interrupt-ready'),'ready');
   const started=Date.now();
   while(Date.now()-started<20000){
    heartbeat({phase:'effect-written'});
    try{await access(join(dir,'interrupt-request'));await event(dir,'interrupt_acknowledged',{toolId:plan.toolId,attempt:info.attempt});await writeFile(join(dir,'interrupt-ack'),'held-before-completion');while(true){heartbeat({phase:'interrupt-acknowledged'});await new Promise(r=>setTimeout(r,300));}}catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(r=>setTimeout(r,300));
   }
   await event(dir,'interrupt_window_closed');
  }
  heartbeat({phase:'verified'});return {toolId:plan.toolId,file:output.file,sha256,attempt:info.attempt,adopted};
 },plan.trace);
}
