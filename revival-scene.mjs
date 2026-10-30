const W=1600,H=900;
const OBJECTS=[
  {id:'recover_title',name:'The torn page',x:950,y:681,rx:105,ry:104},
  {id:'upgrade_ledger',name:'The forgotten guestbook',x:615,y:685,rx:143,ry:93},
  {id:'reconnect_asset',name:'The empty portrait',x:1242,y:355,rx:140,ry:175},
];
const PHASES={exploring:'Three keepsakes are waiting. Look closer.',ready:'Three clues found. Shall we bring this room back?',starting:'Wisp is gathering your clues.',running:'The room is beginning to remember.',ready_to_interrupt:'The first page is saved. Blow out the candle?',recovering:'The candle is out. Will Wisp find the way back?',completed:'What was lost has found its way home.',failed:'Something went wrong. Your clues are still here.'};

export function createHauntedScene(canvas,{onInspect=()=>{},onGhost=()=>{},onCandle=()=>{}}={}) {
  const c=canvas.getContext('2d');if(!c)throw new Error('The room cannot be drawn in this browser.');
  let state={collected:[],recoveredTools:[],phase:'exploring'},disposed=false,raf=0,motion=true,last=0,time=0,hover=null,mouse={x:800,y:450},portrait,portraitSource='',ghost={x:800,y:430},pulse=0,candleOut=false;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const stars=Array.from({length:33},(_,i)=>({x:693+(i*71%220),y:198+(i*97%230),r:.8+i%3*.6}));
  const dust=Array.from({length:48},(_,i)=>({x:160+i*127%1290,y:160+i*83%620,size:1+i%3,offset:i*.71}));
  const collected=id=>state.collected.includes(id);
  const repaired=id=>state.phase==='completed'||state.recoveredTools.some(tool=>(typeof tool==='string'?tool:tool?.toolId)===id);
  const moving=()=>motion&&!reduced?.matches&&!document.hidden;
  canvas.style.aspectRatio='16 / 9';canvas.style.width='100%';canvas.style.height='auto';canvas.style.display='block';canvas.style.touchAction='manipulation';
  function rounded(x,y,w,h,r=12){c.beginPath();c.roundRect(x,y,w,h,r);}
  function fill(color){c.fillStyle=color;c.fill();}
  function line(points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function ellipse(x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);fill(color);}
  function glow(x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  function text(value,x,y,size=20,color='#d8d9c7',align='center',font='Georgia'){c.font=`${size}px ${font}`;c.textAlign=align;c.fillStyle=color;c.fillText(value,x,y);}
  function tag(object){
    const active=hover===object.id,done=collected(object.id);
    if(active||done){const width=done?175:260;rounded(object.x-width/2,object.y+object.ry+18,width,43,20);fill(active?'#d7b66f':'#233b36');text(done?'Clue collected':object.name,object.x,object.y+object.ry+46,19,active?'#182826':'#d5e4d5','center','system-ui');}
    if(done){ellipse(object.x+object.rx-10,object.y-object.ry+20,18,18,'#a6d4b2');line([[object.x+object.rx-18,object.y-object.ry+20],[object.x+object.rx-12,object.y-object.ry+26],[object.x+object.rx-1,object.y-object.ry+13]],'#173c30',3);}
  }
  function drawRoom(t){
    const completed=state.phase==='completed',blackout=state.phase==='recovering';
    const base=c.createLinearGradient(0,0,0,H);base.addColorStop(0,completed?'#243f39':'#102624');base.addColorStop(1,'#07120f');c.fillStyle=base;c.fillRect(0,0,W,H);
    c.beginPath();c.moveTo(0,0);c.lineTo(340,150);c.lineTo(340,580);c.lineTo(0,840);c.closePath();fill('#152b27');
    c.beginPath();c.moveTo(1600,0);c.lineTo(1360,150);c.lineTo(1360,580);c.lineTo(1600,840);c.closePath();fill('#10211e');
    c.fillStyle=completed?'#27463b':'#18352e';c.fillRect(340,150,1020,430);
    for(let x=375;x<1360;x+=72){c.fillStyle='rgba(171,188,144,.045)';c.fillRect(x,150,2,430);for(let y=185;y<570;y+=70){c.save();c.translate(x+35,y);c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();}}
    line([[0,840],[340,580],[1360,580],[1600,840]],'#55705c',5);line([[0,851],[340,592],[1360,592],[1600,851]],'#091813',9);
    const floor=c.createLinearGradient(0,590,0,900);floor.addColorStop(0,'#29372a');floor.addColorStop(1,'#1a211a');c.fillStyle=floor;c.fillRect(0,600,W,300);
    for(let i=-5;i<15;i++)line([[800+(i-5)*70,590],[800+(i-5)*260,900]],'#0d1914',3);
    for(let y=610;y<920;y+=(y-570)*.45)line([[0,y],[1600,y]],'#0b1813',3);
    ellipse(820,778,455,84,'#2e3130');ellipse(820,778,435,73,'#424139');ellipse(820,778,415,64,'#263a33');
    c.save();rounded(674,184,250,340,125);c.clip();const sky=c.createLinearGradient(0,180,0,520);sky.addColorStop(0,'#0e1c3a');sky.addColorStop(1,'#405a70');c.fillStyle=sky;c.fillRect(670,180,260,350);
    stars.forEach(star=>ellipse(star.x,star.y,star.r,star.r,'#d3e4dd'));ellipse(840,250,45,45,'#d7ded0');ellipse(858,237,42,42,'#172c47');
    c.beginPath();c.moveTo(670,500);for(let x=670;x<950;x+=15)c.lineTo(x,465+Math.sin(x*.037)*19);c.lineTo(950,530);c.lineTo(670,530);fill('#102822');
    line([[721,530],[739,377],[725,336],[745,391],[767,361]],'#091b19',7);line([[900,530],[884,382],[899,351],[879,397],[863,367]],'#091b19',7);
    if(moving()&&t%18>17.82){c.fillStyle='rgba(222,238,229,.2)';c.fillRect(670,180,260,350);line([[805,200],[785,245],[811,239],[785,290]],'#f1f6dc',3);}
    c.restore();rounded(667,177,264,355,128);c.strokeStyle='#928369';c.lineWidth=10;c.stroke();line([[800,191],[800,520]],'#8c8065',8);line([[681,369],[919,369]],'#8c8065',7);
    c.beginPath();c.moveTo(640,168);c.bezierCurveTo(683,260,655,420,615,550);c.lineTo(664,550);c.bezierCurveTo(711,350,706,220,699,168);c.closePath();fill('#353143');
    c.beginPath();c.moveTo(956,168);c.bezierCurveTo(924,300,950,435,991,550);c.lineTo(943,550);c.bezierCurveTo(902,350,898,220,902,168);c.closePath();fill('#353143');
    // A shallow table gives the three keepsakes a shared physical plane.
    c.beginPath();c.moveTo(390,615);c.lineTo(1100,615);c.lineTo(1170,780);c.lineTo(325,780);c.closePath();fill('#5a4431');line([[325,780],[1170,780]],'#ad8454',9);
    c.fillStyle='#241f16';c.fillRect(385,785,28,112);c.fillRect(1080,785,28,112);
    if(!candleOut)glow(420,655,420,completed?'rgba(236,188,88,.15)':'rgba(198,151,63,.10)');
    if(blackout){c.fillStyle='rgba(0,4,12,.63)';c.fillRect(0,0,W,H);}
  }
  function drawPortrait(t){
    const o=OBJECTS[2],restored=repaired(o.id),active=hover===o.id;
    if(active||!collected(o.id))glow(o.x,o.y,210,active?'rgba(230,181,82,.25)':'rgba(139,192,176,.07)');
    rounded(1107,172,270,355,9);fill('#281f1a');rounded(1118,182,248,334,7);fill('#b38c50');rounded(1132,196,220,307,4);fill('#3f3524');rounded(1144,208,196,282,3);fill(restored?'#274b3a':'#182420');
    c.save();rounded(1144,208,196,282,3);c.clip();
    if(restored){glow(1242,352,140,'rgba(239,168,47,.15)');if(portrait?.complete&&portrait.naturalWidth)c.drawImage(portrait,1164,250,156,184);else{for(let i=0;i<12;i++){c.save();c.translate(1242,345);c.rotate(i*Math.PI/6);ellipse(0,-49,20,43,'#dca44c');c.restore();}ellipse(1242,345,31,31,'#5b3b25');}text('REMEMBERED',1242,463,13,'#d1ba85','center','system-ui');}
    else{ellipse(1242,315,40,45,'#2a3931');c.beginPath();c.moveTo(1177,455);c.quadraticCurveTo(1177,365,1242,365);c.quadraticCurveTo(1307,365,1307,455);fill('#253a30');line([[1160,230],[1220,296],[1204,354],[1275,390],[1310,479]],'#080f0e',4);line([[1204,354],[1161,385]],'#080f0e',3);text('a face, misplaced',1242,468,17,'#698279');if(moving()){c.fillStyle=`rgba(111,168,150,${.04+.025*Math.sin(t*3)})`;c.fillRect(1144,208,196,282);}}
    c.restore();tag(o);
  }
  function drawBook(){
    const o=OBJECTS[1],restored=repaired(o.id);if(hover===o.id||!collected(o.id))glow(o.x,o.y,160,hover===o.id?'rgba(218,184,101,.26)':'rgba(157,189,131,.08)');
    c.save();c.translate(o.x,o.y);c.rotate(-.09);ellipse(0,44,147,28,'rgba(0,0,0,.28)');rounded(-130,-65,260,135,9);fill('#1e2722');rounded(-127,-70,254,128,8);fill(restored?'#345f48':'#394438');c.fillStyle='#b89454';c.fillRect(-114,-65,8,120);line([[-96,-55],[111,-55],[111,44],[-96,44],[-96,-55]],'#9e8853',2);text(restored?'THE GUESTBOOK':'GUESTS / VISITS',7,-14,19,'#d4c095');text(restored?'Asha  3   ·   Mira  1':'names out of place',7,15,16,'#aba98b');c.restore();tag(o);
  }
  function drawPage(t){
    const o=OBJECTS[0],restored=repaired(o.id);if(hover===o.id||!collected(o.id))glow(o.x,o.y,155,hover===o.id?'rgba(228,190,105,.28)':'rgba(178,190,150,.08)');
    c.save();c.translate(o.x,o.y);c.rotate(.12);ellipse(0,76,98,22,'rgba(0,0,0,.24)');c.beginPath();c.moveTo(-78,-95);c.lineTo(57,-95);c.lineTo(82,-69);c.lineTo(79,91);for(let x=79;x>-77;x-=13)c.lineTo(x,91+(x%3)*4);c.lineTo(-78,-95);fill(restored?'#ddd0a7':'#b5ad8d');c.beginPath();c.moveTo(57,-95);c.lineTo(57,-69);c.lineTo(82,-69);fill('#8b896e');
    text(restored?'THE MARIGOLD':'[ MISSING ]',0,-42,18,'#34433a');text(restored?'ROOM':'a name forgotten',0,-15,16,'#34433a');for(let i=0;i<5;i++)line([[-49,10+i*12],[45-(i%2)*18,10+i*12]],'#858b6d',2);if(!restored)line([[-70,-4],[12,2],[-8,32],[71,39]],'#686b57',3);c.restore();tag(o);
  }
  function drawCandle(t){
    const x=405,y=658;ellipse(x,y+25,57,14,'#6d6741');ellipse(x,y+20,42,9,'#a58b4c');rounded(x-18,y-83,36,102,5);fill('#b9ad80');line([[x-9,y-74],[x-9,y-30]],'#d5c495',4);
    if(candleOut){
      line([[x,y-82],[x,y-94]],'#352c22',3);ellipse(x,y-93,2,2,'#9b5940');
      const drift=moving()?Math.sin(t*.8)*8:0;
      c.beginPath();c.moveTo(x,y-97);c.bezierCurveTo(x-9+drift,y-119,x+12+drift,y-135,x+drift,y-157);c.strokeStyle='rgba(169,186,184,.24)';c.lineWidth=3;c.stroke();
      if(moving())for(let i=0;i<3;i++){const age=(t*.2+i/3)%1;ellipse(x+Math.sin(t+i)*7,y-100-age*70,3+age*4,4+age*6,`rgba(158,179,174,${(1-age)*.10})`);}
    }else{
      const flicker=moving()?Math.sin(t*11)*3+Math.sin(t*17)*2:0;glow(x,y-100,145,'rgba(242,177,69,.22)');ellipse(x+flicker*.3,y-101,10+flicker*.2,26+flicker,'#edb255');ellipse(x,y-96,5,14,'#fff1bb');
    }
    if(hover==='candle')text(candleOut?'The flame is out':state.phase==='ready_to_interrupt'?'Blow out the candle':'Keep the light',x,y+68,20,'#dfc68b');
  }
  function drawGhost(t){
    const recovering=state.phase==='recovering',happy=state.phase==='completed';
    ghost={x:790+(moving()?Math.sin(t*.29)*220:0),y:420+(moving()?Math.sin(t*1.4)*14:0)};
    if(recovering)ghost.x=800;
    c.save();c.translate(ghost.x,ghost.y);const bob=moving()?Math.sin(t*2)*3:0;
    ellipse(0,200,66,14,'rgba(0,0,0,.18)');glow(0,6,145,recovering?'rgba(141,178,223,.18)':'rgba(170,224,207,.15)');
    c.beginPath();c.moveTo(-55,70);c.bezierCurveTo(-62,22,-57,-62,0,-68);c.bezierCurveTo(59,-68,62,23,56,70);c.quadraticCurveTo(39,57,23,75+bob);c.quadraticCurveTo(10,59,-5,76);c.quadraticCurveTo(-24,60,-40,78);c.closePath();
    const body=c.createLinearGradient(0,-68,0,80);body.addColorStop(0,recovering?'#b2c9dd':'#d0e7d5');body.addColorStop(1,'rgba(141,190,174,.77)');fill(body);
    const blink=moving()&&t%5.7>5.53;
    if(blink){line([[-25,-18],[-11,-18]],'#213e37',4);line([[14,-18],[28,-18]],'#213e37',4);}else{ellipse(-18,-20,6,9,'#213e37');ellipse(21,-20,6,9,'#213e37');ellipse(-16,-23,2,2,'#eaf9df');ellipse(23,-23,2,2,'#eaf9df');}
    if(happy){c.beginPath();c.arc(2,0,15,.18,Math.PI-.18);c.strokeStyle='#35594c';c.lineWidth=3;c.stroke();}else ellipse(2,7,recovering?6:4,recovering?9:5,'#527767');
    ellipse(-34,2,11,5,'rgba(180,148,137,.29)');ellipse(36,2,11,5,'rgba(180,148,137,.29)');
    c.save();c.translate(63,65);line([[-16,-25],[4,-37],[25,-18]],'#9d9864',4);rounded(-15,-22,42,55,7);fill('#857343');rounded(-8,-15,28,39,3);fill('#e9c270');glow(5,4,78,'rgba(255,196,79,.27)');c.restore();
    if(hover==='ghost'){rounded(-93,-116,186,35,17);fill('#d9c997');text('Wisp is listening',0,-92,18,'#20392f','center','system-ui');}
    c.restore();
  }
  function frame(now){
    raf=0;if(disposed)return;
    if(moving()){time+=Math.min(.05,(now-(last||now))/1000);last=now;}else last=0;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,globalThis.devicePixelRatio||1),width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    c.setTransform(width/W,0,0,height/H,0,0);c.clearRect(0,0,W,H);
    c.save();const px=moving()?(mouse.x-800)*.006:0,py=moving()?(mouse.y-450)*.003:0;c.translate(px,py);drawRoom(time);drawPortrait(time);drawBook();drawPage(time);drawCandle(time);drawGhost(time);
    if(moving())dust.forEach(p=>{const y=(p.y-time*9+p.offset*15+H)%H;ellipse(p.x+Math.sin(time*.4+p.offset)*12,y,p.size,p.size,state.phase==='completed'?'rgba(230,196,111,.4)':'rgba(177,206,185,.17)');});
    if(state.phase==='completed'){for(let i=0;i<20;i++){const t=moving()?time:0;ellipse(280+i*59+Math.sin(i+t)*17,190+(i*73+t*32)%450,2,4,'rgba(231,198,113,.64)');}}
    if(pulse>0){glow(mouse.x,mouse.y,90,'rgba(245,218,146,.17)');pulse=Math.max(0,pulse-.035);}
    c.restore();const shade=c.createLinearGradient(0,0,0,160);shade.addColorStop(0,'rgba(3,11,10,.85)');shade.addColorStop(1,'transparent');c.fillStyle=shade;c.fillRect(0,0,W,160);
    text(state.title?String(state.title).slice(0,70):'THE MARIGOLD ROOM',800,67,34,'#e4d1a3');text(PHASES[state.phase]||PHASES.exploring,800,103,20,'#aebdad','center','system-ui');
    const dots=OBJECTS.map(o=>collected(o.id));dots.forEach((done,index)=>{ellipse(770+index*30,850,6,6,done?'#e2c48a':'#53665a');});
    if(moving())raf=requestAnimationFrame(frame);
  }
  const schedule=()=>{if(!disposed&&!raf)raf=requestAnimationFrame(frame);};
  function point(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*W/r.width,y:(event.clientY-r.top)*H/r.height};}
  function hit(p){if(Math.hypot((p.x-ghost.x)/75,(p.y-ghost.y)/100)<1)return'ghost';if(Math.hypot((p.x-405)/65,(p.y-620)/105)<1)return'candle';return OBJECTS.find(o=>Math.hypot((p.x-o.x)/o.rx,(p.y-o.y)/o.ry)<1)?.id||null;}
  const move=event=>{mouse=point(event);hover=hit(mouse);canvas.style.cursor=hover?'pointer':'default';schedule();};
  const leave=()=>{hover=null;canvas.style.cursor='default';schedule();};
  const activate=event=>{mouse=point(event);const id=hit(mouse);if(!id)return;pulse=1;if(id==='ghost')onGhost();else if(id==='candle')onCandle();else onInspect(id);schedule();};
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('click',activate);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(canvas);
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else schedule();};
  const reduceChange=()=>{last=0;schedule();};document.addEventListener('visibilitychange',visibility);reduced?.addEventListener('change',reduceChange);schedule();
  return {
    setState(value={}) {
      const next={...state,...value};next.collected=Array.isArray(next.collected)?next.collected:[];next.recoveredTools=Array.isArray(next.recoveredTools)?next.recoveredTools:[];state=next;
      if(next.phase==='recovering')candleOut=true;else if(next.phase==='completed'||next.phase==='exploring')candleOut=false;
      if(next.portraitUrl&&next.portraitUrl!==portraitSource&&(repaired('reconnect_asset'))){portraitSource=next.portraitUrl;portrait=new Image();portrait.onload=schedule;portrait.onerror=schedule;portrait.src=portraitSource;}
      schedule();
    },
    setMotion(value){motion=Boolean(value);last=0;if(!motion){cancelAnimationFrame(raf);raf=0;}schedule();},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('click',activate);document.removeEventListener('visibilitychange',visibility);reduced?.removeEventListener('change',reduceChange);if(portrait){portrait.onload=null;portrait.onerror=null;}},
  };
}
