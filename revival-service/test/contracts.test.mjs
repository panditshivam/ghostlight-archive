import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTools,TOOL_IDS} from '../contract.mjs';
import {sanitizeAttributes,sanitizeEvent} from '../telemetry.mjs';
test('only the complete finite restoration plan is accepted',()=>{
 assert(validateTools(TOOL_IDS));assert(!validateTools([...TOOL_IDS,'audit_contact_data']));assert(!validateTools(['recover_title','recover_title','reconnect_asset']));assert(!validateTools(['https://example.com']));
});
test('telemetry drops source payload, paths and user data',()=>{
 const raw={tool_id:'recover_title',attempt:2,output_match:true,query:'PRIVATE_SENTINEL',path:'/private/PRIVATE_SENTINEL',user:'PRIVATE_SENTINEL',effect:'bad PRIVATE_SENTINEL'};
 assert.deepEqual(sanitizeAttributes(raw),{tool_id:'recover_title',attempt:2,output_match:true});
 const event=sanitizeEvent({event_id:'abc',timestamp:1,message:'PRIVATE_SENTINEL',exception:{values:[{value:'PRIVATE_SENTINEL'}]},user:{email:'PRIVATE_SENTINEL'},request:{url:'PRIVATE_SENTINEL'}});assert(!JSON.stringify(event).includes('PRIVATE_SENTINEL'));
});
test('actual SDK transport receives sanitized error and trace envelopes',async()=>{
 const Sentry=await import('@sentry/node');const {initTelemetry,trace,flush}=await import('../telemetry.mjs');
 const envelopes=[];process.env.SENTRY_DSN='https://public@example.invalid/1';
 initTelemetry({transport:()=>({send:async envelope=>{envelopes.push(envelope);return{statusCode:200}},flush:async()=>true})});
 await trace('revival.repair',{tool_id:'recover_title',attempt:2,query:'PRIVATE_SENTINEL',path:'/PRIVATE_SENTINEL'},async()=>{});
 Sentry.captureException(new Error('/PRIVATE_SENTINEL file body PRIVATE_SENTINEL'));
 await flush();assert(envelopes.length>=2);const encoded=JSON.stringify(envelopes);assert(!encoded.includes('PRIVATE_SENTINEL'));assert(encoded.includes('revival.repair'));assert(encoded.includes('recover_title'));
 await Sentry.close();delete process.env.SENTRY_DSN;
});
