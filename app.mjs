import {archive,rooms,examples} from './archive.mjs';
import {mysteries,newGame,offerClue,currentMystery} from './game.mjs';
import {Soundscape} from './audio.mjs';
import {parseArchive,validateQuery,keywordRank,exportTrail} from './core.mjs';
const $=id=>document.getElementById(id);
let records=archive,pinned=[],lastQuery='',lastResults=[],requestId=0,busy=false;
let game=newGame(),selectedRoom='Hall',ghostRoom=0,motionPaused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound=new Soundscape((message,on)=>{$('sound-status').textContent=message;$('sound').textContent=on?'Mute sound':'Enable sound';$('sound').setAttribute('aria-pressed',String(on));});
const encounters={Hall:'The portrait’s eyes seem to follow you. Wisp waves at it. The portrait does not wave back.', 'Music room':'Three notes hang in the air. Dusty keys, a candle, and something brass beneath the bench.',Attic:'Tap. Tap. Tap. Something up here has excellent rhythm and terrible timing.',Kitchen:'The kettle is quiet. Two cups wait beside a single chair.',Garden:'The gate creaks. Marigolds gather around a table covered in little name cards.',Library:'A whisper slips between the shelves. One book is much heavier than it ought to be.'};
function drawQuest(){
  const complete=game.solved.length===mysteries.length,current=currentMystery(game);
  $('quest-play').hidden=!game.active;$('start').hidden=game.active;
  $('quest-title').textContent=complete?'Every ghost needs a good ending.':game.active?current.title:'The house forgot its ending.';
  $('progress-text').textContent=`${game.mode==='shuffle'?'Shuffled hunt · ':''}${game.solved.length} / 5 keepsakes`;$('progress').value=game.solved.length;
  $('inventory').replaceChildren(...mysteries.map(m=>{const found=game.solved.includes(m.id),e=text('div','','keepsake'+(found?' recovered':''));e.append(text('span',found?m.symbol:'◇'),text('small',found?m.item:'Not found'));return e;}));
  $('riddle').textContent=complete?'The lanterns are warm again. Wisp sets the cup beside the flowers and opens the unfinished letter. “Stay for a story?” You recovered all five keepsakes.':current.question;
  $('ask-riddle').hidden=$('hint').hidden=complete;
  $('quest-story').textContent=complete?'The house was keeping memories, not monsters. Your evidence trail is ready to keep.':game.active?'Find the passage that explains each mystery, then offer it to Wisp. You can search in your own words or explore the rooms.':'Meet Wisp, the least intimidating ghost on this street. Help it untangle the strange sounds and find what the house is holding on to. No timer. Read, explore, and follow a thought.';
  document.body.classList.toggle('restored',complete);document.body.classList.toggle('playing',game.active);$('current-mystery').hidden=!game.active;$('play-status').hidden=!game.active;$('current-mystery').textContent=complete?'All five keepsakes recovered. The house remembers.':`Mystery ${game.solved.length+1} of 5 · ${current.title}: ${current.question}`;
}
function offer(id){
  const mystery=currentMystery(game),result=offerClue(game,id);game=result.state;
  if(result.outcome==='wrong'){$('quest-feedback').textContent='An interesting lead, but it does not explain this mystery. Read what happened in the passage, or ask Wisp for a hint.';$('play-status').textContent=$('quest-feedback').textContent;sound.play('wrong');return;}
  if(!['solved','complete'].includes(result.outcome))return;
  const record=archive.find(r=>r.id===id);if(!pinned.some(p=>p.id===id))pinned.push({...record,query:lastQuery||mystery.question});
  $('ghost-message').textContent=mystery.reply;$('quest-feedback').textContent=`Recovered: ${mystery.item}. ${result.outcome==='complete'?'All five memories are home.':'A new mystery is ready above.'}`;
  $('play-status').textContent=$('quest-feedback').textContent;if(result.outcome!=='complete')$('query').value=currentMystery(game).question;
  sound.play(result.outcome==='complete'?'complete':'found');drawQuest();drawPins();drawResults();drawHouse(lastResults);
}
function startGame(mode='story'){
  if(busy)return;if(records!==archive)replaceArchive(archive);
  game={...newGame(mode),active:true};selectedRoom='Hall';ghostRoom=0;$('room-encounter').hidden=true;pinned=[];$('friendship').textContent='';lastResults=[];lastQuery='';$('results').replaceChildren(text('p','The first mystery is waiting. Search or explore a room.','empty'));$('keywords').hidden=true;$('keywords').replaceChildren();$('compare').setAttribute('aria-pressed','false');$('play-status').textContent='Read a source passage, then offer the clue that explains this mystery.';$('quest-feedback').textContent='The first mystery is ready. Search or tap a room to begin.';$('ghost-message').textContent=mode==='shuffle'?'“Same house. The memories have wandered. Let’s find them in a different order.”':'“Five lost keepsakes. One very forgetful ghost. Shall we?”';
  $('query').value=currentMystery(game).question;drawQuest();drawPins();drawResults();drawHouse(lastResults);sound.play('welcome');
}
function moveGhost(){
  $('ghost').hidden=records!==archive;const positions=[[3,19],[53,19],[3,47],[53,47],[3,76],[53,76]];
  const [x,y]=positions[ghostRoom];$('ghost').style.left=`${x}%`;$('ghost').style.top=`${y}%`;
  $('ghost').setAttribute('aria-label',`Greet Wisp in the ${rooms[ghostRoom]}`);
}
function greetGhost(){
  game={...game,ghostGreetings:Math.min(3,game.ghostGreetings+1)};sound.play('ghost');
  $('ghost-message').textContent=game.ghostGreetings===3?'“You keep saying hello. That means we’re friends now. Officially. I made a badge.”':game.active&&game.solved.length<5?`“${currentMystery(game).hint}”`:'“I tried being frightening once. Someone offered me a blanket.”';
  $('friendship').textContent=game.ghostGreetings===3?'✧ Friend of Wisp':'';
}
function updateMotion(){document.body.classList.toggle('still',motionPaused);$('motion').textContent=motionPaused?'Resume motion':'Pause motion';$('motion').setAttribute('aria-pressed',String(motionPaused));}

const worker=new Worker(new URL('./model-worker.mjs',import.meta.url),{type:'module'});
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function drawHouse(rows=[]){
  const names=records===archive?rooms:['Your archive']; $('house').replaceChildren(...names.map(name=>{
    const matches=rows.filter(r=>r.room===name);const e=text('button','','room'+(matches.some(r=>Number.isFinite(r.score))?' lit':'')+(selectedRoom===name?' selected':''));e.type='button';e.setAttribute('aria-label',`Explore ${name}`);e.onclick=()=>{selectedRoom=name;if(!game.visits.includes(name))game={...game,visits:[...game.visits,name]};$('room-encounter').hidden=false;$('room-story').textContent=encounters[name]||'Your own archive. Search to find a passage.';sound.play(name);drawHouse(lastResults);[...$('house').children].find(b=>b.getAttribute('aria-label')===`Explore ${name}`).focus();};
    e.append(text('strong',name),text('small',matches.length?`${matches.length} ${Number.isFinite(matches[0].score)?'matching':'source'} passage${matches.length>1?'s':''}`:'quiet'));return e;
  }));moveGhost();$('exploration').textContent=records===archive?`${game.visits.length} / 6 rooms explored${game.visits.length===6?' · House historian ✧':''}`:'';$('map-count').textContent=`${records.length} ${records===archive?'fictional ':''}passages`;
}
function drawPins(){
  $('trail-preview').hidden=true;
  $('pins').replaceChildren(...(pinned.length?pinned.map(r=>{const e=text('div','','pinned');e.append(text('span',`[${r.id}] ${r.title}`));const b=text('button','Remove');b.setAttribute('aria-label',`Remove ${r.id}`);b.onclick=()=>{pinned=pinned.filter(p=>p.id!==r.id);drawPins();drawResults();};e.append(b);return e;}):[text('p','No passages pinned yet.')]));
  $('export').disabled=$('clear').disabled=!pinned.length;
}
function drawResults(){
  $('results').replaceChildren(...lastResults.map((r,i)=>{
    const e=text('article','','clue');const top=text('div','','clue-top');top.append(text('strong',`${i+1}. ${r.title}`),text('span',Number.isFinite(r.score)?`cosine ${r.score.toFixed(3)}`:'Room exploration'));
    e.append(top,text('p',r.text),text('div',`[${r.id}] · ${r.room} · Original passage`,'source'));
    const b=text('button',pinned.some(p=>p.id===r.id)?'Pinned ✓':'Pin passage');b.disabled=pinned.some(p=>p.id===r.id);b.onclick=()=>{pinned.push({...r,query:lastQuery});drawPins();drawResults();};e.append(b);
    if(game.active&&records===archive&&game.solved.length<5){const offerButton=text('button',game.solved.includes(r.id)?'Keepsake recovered ✓':'Offer this clue to Wisp');offerButton.disabled=game.solved.includes(r.id);offerButton.className='offer';offerButton.onclick=()=>offer(r.id);e.append(offerButton);}
    return e;
  }));
}
function keywords(){const found=keywordRank(records,lastQuery);$('keywords').replaceChildren(text('h3','Literal word overlap · no model'),...found.map(r=>text('p',`[${r.id}] ${r.title} — ${r.score} shared word${r.score>1?'s':''}`)));if(!found.length)$('keywords').append(text('p','No matching words after the small stop-word filter.'));}
function setBusy(value){busy=value;$('query').readOnly=value;for(const id of ['submit','load','reset','start','restart','shuffle','ask-riddle','inspect-room'])$(id).disabled=value;for(const b of $('examples').querySelectorAll('button'))b.disabled=value;}
worker.onmessage=({data})=>{
  if(data.requestId!==requestId)return;
  if(data.type==='status'){$('status').textContent=data.text;return;}
  setBusy(false);
  if(data.type==='error'){$('status').textContent=data.text;return;}
  lastResults=data.rows;drawResults();drawHouse(lastResults);keywords();
  $('status').textContent=`Open model search complete · ${data.seconds.toFixed(2)} s excluding model load. Similarity is a lead, not confidence or factual verification.`;
};
worker.onerror=()=>{setBusy(false);$('status').textContent='The model worker could not start. Check the network and reload. No model result was produced.';};
$('search').onsubmit=e=>{e.preventDefault();if(busy)return;try{lastQuery=validateQuery($('query').value);requestId++;lastResults=[];$('keywords').replaceChildren();$('results').replaceChildren(text('p','Listening for a signal…','empty'));drawHouse();setBusy(true);worker.postMessage({records,query:lastQuery,requestId});}catch(e){$('status').textContent=e.message;}};
for(const example of examples){const b=text('button',example);b.type='button';b.onclick=()=>{$('query').value=example;$('search').requestSubmit();};$('examples').append(b);}
$('compare').onclick=()=>{const show=$('keywords').hidden;$('keywords').hidden=!show;$('compare').setAttribute('aria-pressed',String(show));};
function replaceArchive(next){records=next;selectedRoom=next===archive?'Hall':'Your archive';game=newGame();$('play-status').textContent='';$('friendship').textContent='';$('keywords').hidden=true;$('compare').setAttribute('aria-pressed','false');drawQuest();$('room-encounter').hidden=true;$('query').value='';pinned=[];lastResults=[];lastQuery='';drawHouse();drawPins();$('results').replaceChildren(text('p','Archive changed. Ask a new question.','empty'));$('keywords').replaceChildren();$('status').textContent='Ready to search the new archive.';}
$('load').onclick=()=>{try{replaceArchive(parseArchive($('archive').value));$('archive-status').textContent='Your passages are loaded in this page only.';}catch(e){$('archive-status').textContent=e.message;}};
$('reset').onclick=()=>{replaceArchive(archive);$('archive').value='';$('archive-status').textContent='Fictional haunted house restored.';};
$('clear').onclick=()=>{pinned=[];drawPins();drawResults();};
$('export').onclick=()=>{const body=exportTrail(pinned);$('trail-preview').textContent=body;$('trail-preview').hidden=false;const url=URL.createObjectURL(new Blob([body],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='ghostlight-trail.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('start').onclick=()=>startGame();$('restart').onclick=()=>startGame(game.mode);
$('shuffle').onclick=()=>startGame('shuffle');
$('ask-riddle').onclick=()=>{if(busy)return;$('query').value=currentMystery(game).question;$('search').requestSubmit();};
$('hint').onclick=()=>{$('quest-feedback').textContent=currentMystery(game).hint;};
$('inspect-room').onclick=()=>{if(busy)return;lastResults=records.filter(r=>r.room===selectedRoom);lastQuery=`Explored the ${selectedRoom}`;drawResults();drawHouse(lastResults);$('keywords').replaceChildren();$('keywords').hidden=true;$('compare').setAttribute('aria-pressed','false');$('status').textContent=`Reading ${selectedRoom} passages directly. This is exploration, not model retrieval.`;};
$('ghost').onclick=$('call-ghost').onclick=greetGhost;
$('sound').onclick=async()=>{$('sound').disabled=true;try{await sound.toggle();}finally{$('sound').disabled=false;}};$('volume').oninput=e=>sound.setVolume(e.target.value/100);
$('motion').onclick=()=>{motionPaused=!motionPaused;updateMotion();};
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');motionPreference.addEventListener('change',e=>{motionPaused=e.matches;updateMotion();});
setInterval(()=>{if(!document.hidden&&!motionPaused&&records===archive){ghostRoom=(ghostRoom+1)%rooms.length;moveGhost();}},6500);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sound.enabled)sound.toggle();});
updateMotion();drawQuest();drawHouse();drawPins();
