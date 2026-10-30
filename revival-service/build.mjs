import {bundleWorkflowCode} from '@temporalio/worker';
import {writeFile} from 'node:fs/promises';
const {code}=await bundleWorkflowCode({workflowsPath:new URL('./workflow.cjs',import.meta.url).pathname});
await writeFile(new URL('./.workflow-bundle.cjs',import.meta.url),code);
