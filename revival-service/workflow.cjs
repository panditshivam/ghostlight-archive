const {proxyActivities}=require('@temporalio/workflow');
const {restore}=proxyActivities({startToCloseTimeout:'30 seconds',heartbeatTimeout:'4 seconds',retry:{initialInterval:'1 second',backoffCoefficient:1,maximumAttempts:3}});
exports.revival=async function revival(plan){
 const outputs=[];
 for(const toolId of plan.toolIds)outputs.push(await restore({...plan,toolId}));
 return {status:'restored',outputs};
};
