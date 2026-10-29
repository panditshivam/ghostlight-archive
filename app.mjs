import {archive,rooms,examples} from './archive.mjs';
import {parseArchive,validateQuery,keywordRank,exportTrail} from './core.mjs';
const $=id=>document.getElementById(id);
let records=archive,pinned=[],lastQuery='',lastResults=[],requestId=0,busy=false;
const worker=new Worker(new URL('./model-worker.mjs',import.meta.url),{type:'module'});
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function drawHouse(rows=[]){
  const names=records===archive?rooms:['Your archive']; $('house').replaceChildren(...names.map(name=>{
    const matches=rows.filter(r=>r.room===name);const e=text('div','','room'+(matches.length?' lit':''));
    e.append(text('strong',name),text('small',matches.length?`${matches.length} matching passage${matches.length>1?'s':''}`:'quiet'));return e;
  }));$('map-count').textContent=`${records.length} ${records===archive?'fictional ':''}passages`;
}
function drawPins(){
  $('trail-preview').hidden=true;
  $('pins').replaceChildren(...(pinned.length?pinned.map(r=>{const e=text('div','','pinned');e.append(text('span',`[${r.id}] ${r.title}`));const b=text('button','Remove');b.setAttribute('aria-label',`Remove ${r.id}`);b.onclick=()=>{pinned=pinned.filter(p=>p.id!==r.id);drawPins();drawResults();};e.append(b);return e;}):[text('p','No passages pinned yet.')]));
  $('export').disabled=$('clear').disabled=!pinned.length;
}
function drawResults(){
  $('results').replaceChildren(...lastResults.map((r,i)=>{
    const e=text('article','','clue');const top=text('div','','clue-top');top.append(text('strong',`${i+1}. ${r.title}`),text('span',`cosine ${r.score.toFixed(3)}`));
    e.append(top,text('p',r.text),text('div',`[${r.id}] · ${r.room} · Original passage`,'source'));
    const b=text('button',pinned.some(p=>p.id===r.id)?'Pinned ✓':'Pin passage');b.disabled=pinned.some(p=>p.id===r.id);b.onclick=()=>{pinned.push({...r,query:lastQuery});drawPins();drawResults();};e.append(b);return e;
  }));
}
function keywords(){const found=keywordRank(records,lastQuery);$('keywords').replaceChildren(text('h3','Literal word overlap · no model'),...found.map(r=>text('p',`[${r.id}] ${r.title} — ${r.score} shared word${r.score>1?'s':''}`)));if(!found.length)$('keywords').append(text('p','No matching words after the small stop-word filter.'));}
function setBusy(value){busy=value;$('query').readOnly=value;for(const id of ['submit','load','reset'])$(id).disabled=value;for(const b of $('examples').querySelectorAll('button'))b.disabled=value;}
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
function replaceArchive(next){records=next;pinned=[];lastResults=[];lastQuery='';drawHouse();drawPins();$('results').replaceChildren(text('p','Archive changed. Ask a new question.','empty'));$('keywords').replaceChildren();$('status').textContent='Ready to search the new archive.';}
$('load').onclick=()=>{try{replaceArchive(parseArchive($('archive').value));$('archive-status').textContent='Your passages are loaded in this page only.';}catch(e){$('archive-status').textContent=e.message;}};
$('reset').onclick=()=>{replaceArchive(archive);$('archive').value='';$('archive-status').textContent='Fictional haunted house restored.';};
$('clear').onclick=()=>{pinned=[];drawPins();drawResults();};
$('export').onclick=()=>{const body=exportTrail(pinned);$('trail-preview').textContent=body;$('trail-preview').hidden=false;const url=URL.createObjectURL(new Blob([body],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='ghostlight-trail.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
drawHouse();drawPins();
