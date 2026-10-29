// All sound is synthesized here. No microphone, samples or audio downloads.
export class Soundscape {
  constructor(onState){this.onState=onState;this.context=null;this.master=null;this.enabled=false;this.volume=.3;this.voices=0;}
  async toggle(){
    if(this.enabled){this.enabled=false;await this.context.suspend();this.report();return;}
    try{
      if(!this.context){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)throw new Error('Web Audio is unavailable');
        this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=this.volume*.22;this.master.connect(this.context.destination);
        // Quiet, slowly breathing drone. It stops with the context on mute.
        for(const frequency of [65.41,98.1]){
          const oscillator=this.context.createOscillator(),gain=this.context.createGain();
          oscillator.frequency.value=frequency;gain.gain.value=.12;oscillator.connect(gain);gain.connect(this.master);oscillator.start();
          const breath=this.context.createOscillator(),depth=this.context.createGain();
          breath.frequency.value=.13;depth.gain.value=.055;breath.connect(depth);depth.connect(gain.gain);breath.start();
        }
        this.context.onstatechange=()=>this.report();
      }
      await this.context.resume();this.enabled=true;this.report();this.play('welcome');
    }catch{this.enabled=false;this.onState('Sound unavailable · continue silently',false);}
  }
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.master)this.master.gain.setTargetAtTime(this.volume*.22,this.context.currentTime,.05);}
  report(){this.onState(this.enabled&&this.context?.state==='running'?'Sound on · ambient + room effects':'Sound off',this.enabled&&this.context?.state==='running');}
  play(kind){
    if(!this.enabled||this.context.state!=='running'||this.voices>24)return;
    const notes={welcome:[261.63,311.13,392],ghost:[523.25,622.25,523.25],found:[392,493.88,587.33,783.99],wrong:[146.83,138.59],complete:[261.63,329.63,392,523.25,659.25,783.99],Hall:[130.81,196], 'Music room':[261.63,311.13,392],Attic:[82.41,82.41,82.41],Kitchen:[523.25,659.25],Garden:[783.99,987.77],Library:[196,207.65]}[kind]||[220];
    notes.forEach((frequency,i)=>{
      const oscillator=this.context.createOscillator(),gain=this.context.createGain(),start=this.context.currentTime+i*.18;
      oscillator.type=kind==='Attic'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,start);
      if(kind==='ghost')oscillator.frequency.exponentialRampToValueAtTime(frequency*.75,start+.65);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.45,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+.8);
      oscillator.connect(gain);gain.connect(this.master);this.voices++;
      oscillator.onended=()=>{this.voices--;oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+.85);
    });
  }
}
