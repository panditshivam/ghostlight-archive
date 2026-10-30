export const mysteries = [
  {id:'M1',room:'Music room',item:'Brass roll',symbol:'♫',title:'The unfinished recital',question:'What kept playing after the musician stopped?',hint:'A melody can outlive the hands that started it. Look for a mechanism.',reply:'A brass roll, not invisible fingers. Wisp hums the missing three bars.'},
  {id:'A1',room:'Attic',item:'Copper pipe',symbol:'⌁',title:'A visitor overhead',question:'Why did I hear someone walking upstairs?',hint:'The rhythm returns when something fills with water.',reply:'The pipe knocks against a beam. Wisp looks slightly embarrassed about the footsteps.'},
  {id:'L1',room:'Library',item:'Hidden radio',symbol:'✧',title:'The whisper in the wall',question:'Where did the quiet voice behind the books come from?',hint:'One dictionary has more inside it than definitions.',reply:'A radio in a hollow dictionary. Even the house has a secret listening habit.'},
  {id:'K1',room:'Kitchen',item:'Blue teacup',symbol:'☕',title:'A place kept warm',question:'Why was there an extra cup at the table?',hint:'Not every trace is a trick. Read about the caretaker and the empty chair.',reply:'The blue cup belongs to a memory. Wisp carries it very carefully.'},
  {id:'G2',room:'Garden',item:'Marigold',symbol:'❋',title:'What the house remembers',question:'Why are there names beside the flowers?',hint:'Find the cards on the remembrance table. The stories belong to a family.',reply:'Names, flowers, stories. The last light was waiting for someone to read them.'}
];
export function newGame(mode='story',random=Math.random){
  const order=mysteries.map(m=>m.id);
  if(mode==='shuffle'){
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    // A shuffled replay must differ from the original story order.
    if(order.every((id,i)=>id===mysteries[i].id))[order[0],order[1]]=[order[1],order[0]];
  }
  return {active:false,mode,order,solved:[],attempts:0,visits:[],ghostGreetings:0};
}
export function currentMystery(state){return mysteries.find(m=>m.id===state.order[state.solved.length]);}
export function offerClue(state,id){
  if(!state.active||state.solved.length===mysteries.length)return {state,outcome:'inactive'};
  if(state.solved.includes(id))return {state,outcome:'duplicate'};
  const next={...state,attempts:state.attempts+1};
  if(id!==currentMystery(state).id)return {state:next,outcome:'wrong'};
  next.solved=[...state.solved,id];
  return {state:next,outcome:next.solved.length===mysteries.length?'complete':'solved'};
}
