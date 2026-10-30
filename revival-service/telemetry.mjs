import * as Sentry from '@sentry/node';
const allowed=new Set(['tool_id','attempt','effect','input_match','output_match','rewritten','controlled_fault','phase','completed_tools','release','gen_ai.agent.name','gen_ai.tool.name','gen_ai.operation.name','gen_ai.request.model']);
const fixedNames=new Set(['revival.approval','revival.workflow','revival.repair','revival.worker_exit','revival.retry','revival.completed','revival.failure']);
export function sanitizeAttributes(data={}){return Object.fromEntries(Object.entries(data).filter(([key,value])=>allowed.has(key)&&(['boolean','number'].includes(typeof value)||typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(value))));}
function cleanSpan(span){return {trace_id:span.trace_id,span_id:span.span_id,parent_span_id:span.parent_span_id,start_timestamp:span.start_timestamp,timestamp:span.timestamp,op:span.op,status:span.status,description:fixedNames.has(span.description)?span.description:'revival.repair',data:sanitizeAttributes(span.data)};}
export function sanitizeEvent(event){
 return {event_id:event.event_id,timestamp:event.timestamp,level:event.level,platform:'node',logger:'ghostlight',message:'revival.failure',tags:{service:'ghostlight-revival'},contexts:event.contexts?.trace?{trace:{trace_id:event.contexts.trace.trace_id,span_id:event.contexts.trace.span_id,op:'revival.failure'}}:{}};
}
export function initTelemetry(options={}){
 if(!process.env.SENTRY_DSN)return;
 Sentry.init({dsn:process.env.SENTRY_DSN,defaultIntegrations:false,sendDefaultPii:false,tracesSampleRate:1,traceLifecycle:'static',...(options.transport?{transport:options.transport}:{}),beforeSend:sanitizeEvent,beforeSendTransaction:event=>({type:'transaction',event_id:event.event_id,timestamp:event.timestamp,start_timestamp:event.start_timestamp,transaction:fixedNames.has(event.transaction)?event.transaction:'revival.workflow',contexts:{trace:{trace_id:event.contexts?.trace?.trace_id,span_id:event.contexts?.trace?.span_id,op:event.contexts?.trace?.op||'revival.workflow',status:event.contexts?.trace?.status,data:sanitizeAttributes(event.contexts?.trace?.data)}},spans:(event.spans||[]).map(cleanSpan)}),beforeSendSpan:Sentry.withStaticSpan(cleanSpan)});
}
export async function trace(name,attributes,fn,carrier){const run=()=>Sentry.startSpan({name,op:['revival.repair','revival.retry'].includes(name)?'gen_ai.execute_tool':'gen_ai.invoke_agent',attributes:sanitizeAttributes(attributes)},fn);return carrier?Sentry.continueTrace(carrier,run):run();}
export const newJobTrace=fn=>Sentry.startNewTrace(fn);
export const traceCarrier=()=>{const data=Sentry.getTraceData();return {sentryTrace:data['sentry-trace'],baggage:undefined};};
export function recordAttributes(data){Sentry.getActiveSpan()?.setAttributes(sanitizeAttributes(data));}
export const failure=()=>Sentry.captureMessage('revival.failure','error');
export const flush=()=>Sentry.flush(1500);
