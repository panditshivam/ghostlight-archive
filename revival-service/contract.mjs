import {createHash} from 'node:crypto';
export const TOOL_IDS=['recover_title','upgrade_ledger','reconnect_asset'];
export const DESCRIPTIONS={recover_title:'Recover the exhibit title from its original source.',upgrade_ledger:'Migrate the fictional guest ledger to its current schema.',reconnect_asset:'Reconnect the portrait using the original asset inventory.'};
export const SOURCE_FILES=['fixture.json','source.md','marigold-portrait.svg'];
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const json=value=>JSON.stringify(value,null,2)+'\n';
export function validateTools(ids){return Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&ids.every(id=>TOOL_IDS.includes(id));}
export const DATA_NOTICE='Only the packaged fictional exhibit is processed. Runs expire and are lost if this service instance restarts.';
