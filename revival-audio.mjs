// Original synthesized sound. No microphone, samples or network requests.
export function createHauntedAudio() {
  let context,master,started=false,muted=false,closed=false,voices=0;
  const ambient=[],liveVoices=new Set();
  const hidden=()=>typeof document!=='undefined'&&document.hidden;
  const fade=value=>{if(master&&context)master.gain.setTargetAtTime(value,context.currentTime,.08);};
  const visibility=()=>{
    if(!context||closed)return;
    if(hidden()){fade(0);void context.suspend().catch(()=>{});}
    // Returning to the tab never starts audio without another explicit start().
  };
  document.addEventListener('visibilitychange',visibility);
  function note(frequency,when,length=.65,level=.3,type='sine',slide=1) {
    if(!context||voices>=32)return;
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,when);
    if(slide!==1)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,frequency*slide),when+length);
    gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,when+length);
    oscillator.connect(gain);gain.connect(master);voices++;liveVoices.add(oscillator);
    oscillator.onended=()=>{voices--;liveVoices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
    oscillator.start(when);oscillator.stop(when+length+.04);
  }
  function cue(kind) {
    if(!started||muted||closed||hidden()||context?.state!=='running')return;
    const motifs={inspect:[392,523.25],ghost:[659.25,783.99,587.33],start:[196,246.94,293.66,392],blackout:[130.81,98,65.41],recover:[261.63,329.63,392],complete:[261.63,329.63,392,523.25,659.25,783.99],wrong:[174.61,164.81]};
    const notes=motifs[kind];if(!notes)return;
    notes.forEach((frequency,index)=>note(frequency,context.currentTime+index*(kind==='complete'?.12:.15),kind==='ghost'?.8:.65,kind==='blackout'?.21:.28,kind==='wrong'?'triangle':'sine',kind==='ghost'?.78:1));
    if(kind==='complete')note(130.81,context.currentTime,1.7,.2);
  }
  return {
    async start() {
      if(closed)throw new Error('The sound session is closed.');
      if(hidden())return false;
      if(!context){
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(!Audio)throw new Error('Sound is unavailable in this browser.');
        context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
        for(const [index,frequency]of[65.41,98.1,130.81].entries()){
          const oscillator=context.createOscillator(),gain=context.createGain(),breath=context.createOscillator(),depth=context.createGain();
          oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.value=.09;
          breath.frequency.value=.08+index*.027;depth.gain.value=.025;
          breath.connect(depth);depth.connect(gain.gain);oscillator.connect(gain);gain.connect(master);
          oscillator.start();breath.start();ambient.push(oscillator,breath,gain,depth);
        }
      }
      await context.resume();started=true;muted=false;fade(.13);return context.state==='running';
    },
    setMuted(value) {
      muted=Boolean(value);fade(muted?0:.13);
      // Unmuting is silent after a hidden-tab suspension until start() is called.
    },
    cue,
    stop() {
      if(closed)return;closed=true;started=false;document.removeEventListener('visibilitychange',visibility);
      for(const node of [...ambient,...liveVoices]){try{node.stop?.();node.disconnect?.();}catch{}}
      ambient.length=0;liveVoices.clear();if(context)void context.close().catch(()=>{});
    },
  };
}
