(function(){
  'use strict';
  let context=null,master=null,compressor=null,muted=false,volume=.7,scheduled=0;
  try{volume=Math.max(0,Math.min(1,Number(localStorage.getItem('ss_volume')??.7)));muted=localStorage.getItem('ss_muted')==='1';}catch{}
  let musicMaster=null,musicFilter=null,musicMuted=false,musicVolume=.35,musicNext=0,musicBeat=0,lastMusicUpdate=-Infinity;
  let scene={active:false,phase:'prep',wave:0,baseRatio:1};
  let musicScheduled=0;
  const musicVoices=new Set();
  try{musicMuted=localStorage.getItem('ss_music_muted')===null?(muted||volume===0):localStorage.getItem('ss_music_muted')==='1';musicVolume=Math.max(0,Math.min(1,Number(localStorage.getItem('ss_music_volume')??.35)));}catch{}
  function musicStatus(){
    const b=document.getElementById('musicBtn');if(b){b.textContent=musicMuted||musicVolume===0?'♫ MÜZİK KAPALI':'♫ MÜZİK AÇIK';b.setAttribute?.('aria-pressed',String(!musicMuted&&musicVolume>0));if(b.dataset){b.dataset.notes=String(musicScheduled);b.dataset.state=context?.state||'idle';}}
    const slider=document.getElementById('musicVolume');if(slider&&document.activeElement!==slider)slider.value=Math.round(musicVolume*100);
  }
  function status(error){
    const el=document.getElementById('audioStatus');
    if(el){el.textContent=error?'Ses açılamadı: sesi dene düğmesine bas':(muted||volume===0)?'SES KAPALI':context?.state==='running'?'SES HAZIR':'SES İLK TIKLAMADA AÇILIR';el.dataset.state=error?'error':context?.state||'idle';el.dataset.scheduled=String(scheduled);}
    const input=document.getElementById('volumeInput');if(input&&document.activeElement!==input)input.value=Math.round(volume*100);
    const value=document.getElementById('volumeValue');if(value)value.textContent=Math.round(volume*100)+'%';
    const button=document.getElementById('muteBtn');if(button)button.textContent=(muted||volume===0)?'EFEKT KAPALI':'EFEKT AÇIK';
    musicStatus();
  }
  function ensure(){
    if(!context||context.state==='closed'){
      const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)throw Error('Web Audio desteklenmiyor');
      context=new AudioCtor({latencyHint:'interactive'});master=context.createGain();master.gain.value=muted?0:volume;
      compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=5;
      compressor.connect(master);master.connect(context.destination);context.onstatechange=()=>status();
      musicMaster=context.createGain();musicMaster.gain.value=0;
      musicFilter=context.createBiquadFilter();musicFilter.type='lowpass';musicFilter.frequency.value=900;
      musicFilter.connect(musicMaster);musicMaster.connect(context.destination);
      // A quiet feedback echo makes the procedural score spacious without assets.
      if(context.createDelay){const delay=context.createDelay(2),feedback=context.createGain(),wet=context.createGain();delay.delayTime.value=.43;feedback.gain.value=.22;wet.gain.value=.16;musicFilter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(musicMaster);}
    }return context;
  }
  async function unlock(){try{const a=ensure();if(a.state!=='running')await a.resume();status();return a.state==='running';}catch(e){status(e);return false;}}
  function tone(freq,dur,type='sine',vol=.15,slide){
    if(muted||volume===0)return;
    try{const a=ensure();if(a.state!=='running'){void unlock();return;}
      const o=a.createOscillator(),g=a.createGain(),now=a.currentTime;o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),now);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),now+dur);
      g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.001,vol),now+.003);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
      o.connect(g);g.connect(compressor);o.start(now);o.stop(now+dur+.02);o.onended=()=>{o.disconnect();g.disconnect()};scheduled++;status();
    }catch(e){status(e)}
  }
  function noise(dur,vol=.2,freq=1800){
    if(muted||volume===0)return;
    try{const a=ensure();if(a.state!=='running'){void unlock();return;}
      const n=Math.ceil(a.sampleRate*dur),buf=a.createBuffer(1,n,a.sampleRate),data=buf.getChannelData(0);
      for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);
      const src=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();src.buffer=buf;filter.type='lowpass';filter.frequency.value=freq;
      g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);
      src.connect(filter);filter.connect(g);g.connect(compressor);src.start();src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect()};scheduled++;status();
    }catch(e){status(e)}
  }
  function setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(volume>0)muted=false;apply();}
  function apply(){if(master&&context)master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.02);try{localStorage.setItem('ss_volume',String(volume));localStorage.setItem('ss_muted',muted?'1':'0');}catch{}status();}
  async function test(){muted=false;if(volume===0)volume=.7;apply();if(await unlock()){tone(440,.18,'sine',.25,660);setTimeout(()=>tone(880,.25,'sine',.2,1100),180);}}
  function musicNote(freq,start,duration,level,type='sine',slide){
    const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,start);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,start+duration);
    const attack=Math.min(.5,duration*.25);g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(Math.max(.001,level),start+attack);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
    o.connect(g);g.connect(musicFilter);o.start(start);o.stop(start+duration+.04);
    musicScheduled++;const voice={o,g};musicVoices.add(voice);o.onended=()=>{musicVoices.delete(voice);o.disconnect();g.disconnect();};
  }
  function fadeVoices(){if(!context)return;for(const v of musicVoices){try{v.g.gain.cancelScheduledValues?.(context.currentTime);v.g.gain.setTargetAtTime(.0001,context.currentTime,.12);v.o.stop(context.currentTime+.5);}catch{}}musicVoices.clear();}
  function setScene(next){
    const changed=scene.active!==next.active||scene.phase!==next.phase;
    scene={...scene,...next};
    if(changed){fadeVoices();musicNext=0;musicBeat=0;}
  }
  function musicTick(){
    if(!context||context.state!=='running')return;
    if(context.currentTime-lastMusicUpdate<.08)return;lastMusicUpdate=context.currentTime;
    const audible=scene.active&&!document.hidden&&!musicMuted&&musicVolume>0;
    musicMaster.gain.setTargetAtTime(audible?musicVolume*.6:0,context.currentTime,.18);
    if(!audible){musicNext=0;return;}
    const night=scene.phase==='wave',tension=night?Math.min(1,(scene.wave-1)/20):0;
    const danger=night?Math.max(0,1-scene.baseRatio/.55):0;
    musicFilter.frequency.setTargetAtTime(750+tension*900+danger*350,context.currentTime,.8);
    const beat=60/(night?58+tension*30+danger*10:48);
    if(!musicNext)musicNext=context.currentTime+.04;
    // Bound scheduling after a suspended tab instead of replaying missed bars.
    if(musicNext<context.currentTime-.1)musicNext=context.currentTime+.04;
    while(musicNext<context.currentTime+.3){
      const bar=Math.floor(musicBeat/8),root=(night?[55,43.654,49,41.203]:[65.406,87.307,73.416,65.406])[bar%4];
      if(musicBeat%8===0){
        musicNote(root,musicNext,beat*7.8,.11,'sine');
        musicNote(root*(night?1.1892:1.2599),musicNext+.05,beat*7.6,.065,'triangle');
        musicNote(root*1.4983,musicNext+.1,beat*7.4,.045,'sine');
      }
      if(musicBeat%4===0)musicNote(root*.5,musicNext,beat*2,.08,'sine');
      if(night&&scene.wave>=4&&musicBeat%2===0){const motif=[2,2.3784,2.9966,2.2449];musicNote(root*motif[(musicBeat/2)%4],musicNext,beat*1.6,.025+tension*.025,'triangle');}
      if(night&&(scene.wave>=7||danger>.2)&&musicBeat%2===0){musicNote(72,musicNext,.21,.12+tension*.05,'sine',31);if(danger>.35)musicNote(64,musicNext+.22,.16,.08,'sine',30);}
      if(night&&scene.wave%5===0&&musicBeat%4===1)musicNote(root*3,musicNext,beat*2,.035,'sine');
      musicBeat++;musicNext+=beat;
    }
    musicStatus();
  }
  function setMusicVolume(value){musicVolume=Math.max(0,Math.min(1,Number(value)||0));if(musicVolume>0)musicMuted=false;saveMusic();}
  function saveMusic(){lastMusicUpdate=-Infinity;if(musicMuted||musicVolume===0)fadeVoices();try{localStorage.setItem('ss_music_volume',String(musicVolume));localStorage.setItem('ss_music_muted',musicMuted?'1':'0');}catch{}musicStatus();musicTick();}
  function toggleMusic(){musicMuted=!musicMuted;if(!musicMuted&&musicVolume===0)musicVolume=.35;saveMusic();if(!musicMuted)void unlock();return musicMuted;}
  function dawn(record=false){
    if(!context||musicMuted||musicVolume===0||context.state!=='running')return;
    const t=context.currentTime+.04;for(const [i,f] of (record?[261.626,329.628,391.995,523.251]:[130.813,164.814,195.998]).entries())musicNote(f,t+i*.12,2.2,.09,'sine');
  }
  window.GameAudio={unlock,tone,noise,test,setVolume,setScene,musicTick,setMusicVolume,toggleMusic,dawn,get musicMuted(){return musicMuted},get musicVolume(){return musicVolume},toggle(){muted=!(muted||volume===0);apply();if(!muted)void test();return muted},get muted(){return muted},get volume(){return volume},get state(){return context?.state||'idle'}};
  document.addEventListener('pointerdown',()=>{void unlock()},{capture:true});
  document.addEventListener('keydown',()=>{void unlock()},{capture:true});
  document.addEventListener('visibilitychange',()=>{lastMusicUpdate=-Infinity;if(document.hidden)fadeVoices();musicTick();if(!document.hidden&&context)void unlock()});
  status();
})();
