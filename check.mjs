import assert from 'node:assert/strict';
import {archive} from './archive.mjs';
import {parseArchive,validateQuery,semanticRank,keywordRank,exportTrail} from './core.mjs';
assert.equal(new Set(archive.map(r=>r.id)).size,archive.length);
assert.equal(parseArchive('One\n\nTwo').length,2);
assert.equal(parseArchive(Array(32).fill('x').join('\n\n')).length,32);
assert.throws(()=>parseArchive(Array(33).fill('x').join('\n\n')));
assert.throws(()=>parseArchive('x'.repeat(501)));
assert.throws(()=>parseArchive('   '));
assert.equal(validateQuery(' a '),'a');
assert.equal(validateQuery('x'.repeat(240)).length,240);
assert.throws(()=>validateQuery('x'.repeat(241)));
assert.throws(()=>validateQuery(''));
assert.throws(()=>semanticRank(archive,[],[1]));
assert.throws(()=>semanticRank([archive[0]],[[NaN]],[1]));
assert.equal(semanticRank(archive.slice(0,2),[[1,0],[0,1]],[0,1])[0].id,'H1');
assert.equal(keywordRank(archive,'zzzzzz').length,0);
assert.ok(keywordRank(archive,'radio')[0].id==='L1');
assert.ok(exportTrail([{...archive[5],query:'radio'}]).includes(archive[5].text));
console.log('16 functional checks passed; no model accuracy claim.');

const {mysteries,newGame,offerClue}=await import('./game.mjs');
let game=newGame();
assert.equal(offerClue(game,'M1').outcome,'inactive');
game={...game,active:true};
const wrong=offerClue(game,'A1');assert.equal(wrong.outcome,'wrong');assert.deepEqual(wrong.state.solved,[]);assert.equal(wrong.state.attempts,1);assert.equal(game.attempts,0);
for(const [i,mystery] of mysteries.entries()){
  assert.ok(archive.some(r=>r.id===mystery.id&&r.room===mystery.room));
  const result=offerClue(game,mystery.id);assert.equal(result.outcome,i===4?'complete':'solved');game=result.state;
  assert.equal(game.solved.length,i+1);
  if(i<4)assert.equal(offerClue(game,mystery.id).outcome,'duplicate');
}
assert.equal(offerClue(game,'M1').outcome,'inactive');assert.equal(game.attempts,5);
assert.deepEqual(newGame().solved,[]);
console.log('Game checks passed: ordered recovery, wrong evidence, duplicate prevention, ending, clean replay and archive IDs.');

const {currentMystery}=await import('./game.mjs');
for(const random of [()=>0,()=>0.999,()=>0.5]){
  let replay={...newGame('shuffle',random),active:true};
  assert.equal(new Set(replay.order).size,5);
  assert.deepEqual([...replay.order].sort(),mysteries.map(m=>m.id).sort());
  assert.notDeepEqual(replay.order,mysteries.map(m=>m.id));
  for(let i=0;i<5;i++){
    const id=currentMystery(replay).id;
    const wrongId=replay.order.find(x=>x!==id&&!replay.solved.includes(x));
    if(wrongId)assert.equal(offerClue(replay,wrongId).outcome,'wrong');
    const result=offerClue(replay,id);replay=result.state;
    assert.equal(result.outcome,i===4?'complete':'solved');
    if(i<4)assert.equal(offerClue(replay,id).outcome,'duplicate');
  }
  assert.equal(currentMystery(replay),undefined);
  assert.equal(newGame(replay.mode,random).mode,'shuffle');
}
console.log('Shuffled replay checks passed: unique permutation, changed order, matching hints/clues, ending and mode.');
