import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const toolVersion = 'fixture-repairs-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value,null,2)+'\n';

// Pure, finite repair contract. No filesystem, shell, network or model calls.
export function materializeRepair(toolId,{fixture,markdown,portraitBytes}) {
  if (toolId === 'recover_title') {
    const title = /^# ([^\n]+)$/m.exec(markdown)?.[1];
    assert(title,'Source has no recoverable heading');
    return {file:'page.json',body:json({title,source:'source.md',recovery:'first-level-heading'})};
  }
  if (toolId === 'upgrade_ledger') {
    const records = fixture.legacy_visitors.map(row=>{
      assert.equal(typeof row.guest,'string'); assert(Number.isInteger(row.visits));
      return {display_name:row.guest,visit_count:row.visits};
    });
    return {file:'visitors.json',body:json({schema_version:2,records})};
  }
  if (toolId === 'reconnect_asset') {
    const filename = fixture.asset_inventory.portrait;
    assert(/^[a-z0-9-]+\.svg$/.test(filename),'Invalid local asset basename');
    return {file:'asset.json',body:json({portrait:filename,sha256:hash(portraitBytes),previous_reference:fixture.broken_portrait})};
  }
  throw new Error(`Tool not allowed: ${toolId}`);
}
