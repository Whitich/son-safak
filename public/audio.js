(function(){
  'use strict';
  let context=null,master=null,compressor=null,muted=false,volume=.7,scheduled=0;
  try{volume=Math.max(0,Math.min(1,Number(localStorage.getItem('ss_volume')??.7)));muted=localStorage.getItem('ss_muted')==='1';}catch{}
  function status(error){
    const el=document.getElementById('audioStatus');
    if(el){el.textContent=error?'Ses açılamadı: sesi dene düğmesine bas':(muted||volume===0)?'SES KAPALI':context?.state==='running'?'SES HAZIR':'SES İLK TIKLAMADA AÇILIR';el.dataset.state=error?'error':context?.state||'idle';el.dataset.scheduled=String(scheduled);}
    const input=document.getElementById('volumeInput');if(input&&document.activeElement!==input)input.value=Math.round(volume*100);
    const value=document.getElementById('volumeValue');if(value)value.textContent=Math.round(volume*100)+'%';
    const button=document.getElementById('muteBtn');if(button)button.textContent=muted?'SES KAPALI':'SES AÇIK';
  }
  function ensure(){
    if(!context||context.state==='closed'){
      const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)throw Error('Web Audio desteklenmiyor');
      context=new AudioCtor({latencyHint:'interactive'});master=context.createGain();master.gain.value=muted?0:volume;
      compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=5;
      compressor.connect(master);master.connect(context.destination);context.onstatechange=()=>status();
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
  window.GameAudio={unlock,tone,noise,test,setVolume,toggle(){muted=!muted;apply();if(!muted)void test();return muted},get muted(){return muted},get volume(){return volume},get state(){return context?.state||'idle'}};
  document.addEventListener('pointerdown',()=>{void unlock()},{capture:true});
  document.addEventListener('keydown',()=>{void unlock()},{capture:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&context)void unlock()});
  status();
})();
