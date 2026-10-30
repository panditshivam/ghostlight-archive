import {Worker,NativeConnection} from '@temporalio/worker';
import {restore} from './activities.mjs';
import {initTelemetry,flush} from './telemetry.mjs';
initTelemetry();
const connection=await NativeConnection.connect({address:'127.0.0.1:17433'});
const worker=await Worker.create({connection,namespace:'default',taskQueue:'ghostlight-revival',workflowBundle:{codePath:new URL('./.workflow-bundle.cjs',import.meta.url).pathname},activities:{restore},maxConcurrentActivityTaskExecutions:1,maxConcurrentWorkflowTaskExecutions:1,maxCachedWorkflows:0,workflowThreadPoolSize:1});
try{await worker.run();}finally{await flush();await connection.close();}
