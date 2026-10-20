(function(){
  'use strict';
  const G=window.GameCore,$=id=>document.getElementById(id);
  let stored={};try{stored=JSON.parse(localStorage.getItem('ss_appearance')||'{}')}catch{}
  window.PlayerAppearance=G.sanitizeAppearance(stored);
  let appearanceTab='upper';
  const parts={upper:{name:'Üst',fields:['outfits','colors']},head:{name:'Başlık',fields:['heads','headColors']},bottom:{name:'Alt',fields:['bottoms','bottomColors']},skin:{name:'Ten',fields:['skins']}};
  function avatar(){
    const {ap:a,upper:color,head,lower,skin}=window.CharacterArt.palette(window.PlayerAppearance),shade=window.CharacterArt.shade;
    const short=['shorts','skirt','pleated'].includes(a.bottoms);
    let bottom='<path d="M90 148l-8 60h26l12-48 12 48h26l-8-60z" fill="'+(short?skin:lower)+'"/>';
    if(a.bottoms==='cargo')bottom+='<path d="M84 165h19v18H84zm53 0h19v18h-19z" fill="'+shade(lower,25)+'"/>';
    if(a.bottoms==='jeans')bottom+='<path d="M96 158l-4 44m52-44 4 44" stroke="'+shade(lower,50)+'" stroke-width="2"/>';
    if(a.bottoms==='shorts')bottom+='<path d="M89 148h62l5 32h-27l-9-19-9 19H84z" fill="'+lower+'"/>';
    if(a.bottoms==='skirt'||a.bottoms==='pleated'){
      bottom+='<path d="M90 145h60l17 41H73z" fill="'+lower+'"/><path d="M73 185h94" stroke="'+shade(lower,-30)+'" stroke-width="4"/>';
      if(a.bottoms==='pleated')bottom+='<path d="M98 149l-10 35m23-35-4 35m22-35 4 35m9-35 10 35" stroke="'+shade(lower,35)+'" stroke-width="3"/>';
    }
    const upper={
      ranger:'<path d="M95 84h50v58H95z" fill="'+shade(color,-35)+'"/><path d="M99 111h16v25H99zm26 0h16v25h-16z" fill="'+shade(color,20)+'"/>',
      heavy:'<rect x="91" y="85" width="58" height="60" rx="8" fill="'+shade(color,-35)+'"/><rect x="98" y="91" width="44" height="38" rx="5" fill="'+shade(color,20)+'"/><path d="M103 99h34m-34 8h34" stroke="#d0d8ca" stroke-width="3"/>',
      hazmat:'<path d="M112 82h16v76h-16zM89 108h62v8H89z" fill="#dfca60"/><circle cx="120" cy="120" r="10" fill="#273e3d"/><text x="120" y="125" text-anchor="middle" fill="#dfca60" font-size="16">☢</text>',
      hoodie:'<path d="M106 81v31m28-31v31" stroke="#e6e1c9" stroke-width="3"/><rect x="99" y="129" width="42" height="18" rx="7" fill="'+shade(color,-20)+'"/>',
      coat:'<path d="M90 85h26v87H79zm34 0h26l11 87h-37z" fill="'+shade(color,-10)+'"/><path d="M90 81l26 9-9 19-15-14m58-14-26 9 9 19 15-14" fill="'+shade(color,25)+'"/><path d="M120 101v59" stroke="#d9cfac" stroke-width="3"/>',
      medic:'<rect x="94" y="86" width="52" height="63" rx="5" fill="'+shade(color,-20)+'"/><rect x="103" y="93" width="34" height="31" rx="4" fill="#e7e9d9"/><path d="M116 97h8v23h-8zm-8 8h24v8h-24z" fill="#b44853"/>'
    }[a.outfits];
    const hat={
      helmet:'<path d="M86 40q-4-43 34-43t34 43z" fill="'+head+'"/><rect x="84" y="32" width="72" height="9" rx="3" fill="'+shade(head,-40)+'"/><path d="M116 4h8v29h-8z" fill="'+shade(head,35)+'"/>',
      beret:'<path d="M87 35q-11-27 34-29t35 30z" fill="'+head+'"/><circle cx="136" cy="22" r="4" fill="#f1d280"/>',
      hood:'<path d="M84 60q-4-56 36-56t36 56l-13-22h-46z" fill="'+head+'"/>',
      cap:'<path d="M87 36q0-35 33-35t33 35z" fill="'+head+'"/><path d="M90 32h65l14 12h-79z" fill="'+shade(head,-25)+'"/><rect x="114" y="13" width="12" height="12" rx="2" fill="'+shade(head,40)+'"/>',
      beanie:'<path d="M88 35q-2-40 32-40t32 40z" fill="'+head+'"/><rect x="86" y="27" width="68" height="13" rx="4" fill="'+shade(head,-25)+'"/><circle cx="120" cy="1" r="7" fill="'+shade(head,25)+'"/><path d="M103 7v19m12-22v22m12-22v22m12-19v19" stroke="'+shade(head,25)+'" stroke-width="2"/>',
      cowboy:'<ellipse cx="120" cy="34" rx="49" ry="11" fill="'+shade(head,-20)+'"/><path d="M91 31l7-34h44l7 34z" fill="'+head+'"/><path d="M94 24h52" stroke="'+shade(head,-55)+'" stroke-width="7"/>',
      headphones:'<path d="M86 49V29q0-29 34-29t34 29v20" fill="none" stroke="'+head+'" stroke-width="9"/><rect x="82" y="37" width="13" height="27" rx="5" fill="'+head+'"/><rect x="145" y="37" width="13" height="27" rx="5" fill="'+head+'"/>',
      none:''
    }[a.heads];
    return '<svg viewBox="55 -12 150 235" aria-label="Karakter önizlemesi" role="img"><ellipse cx="120" cy="215" rx="34" ry="5" fill="#0002"/>'+bottom+'<path d="M79 201h29v14H76v-8zm53 0h29l3 7v7h-32z" fill="#142127"/><path d="M75 79L54 144l20 8 22-46h48l22 46 20-8-21-65z" fill="'+color+'"/><path d="M88 77h64v82H88z" fill="'+color+'"/>'+upper+'<ellipse cx="120" cy="52" rx="25" ry="31" fill="'+skin+'"/><path d="M96 33q-5-30 24-30t24 30l-13-13-35 18z" fill="#3f302d"/>'+hat+'<path d="M110 67q10 6 20 0M120 53l-3 8h6" fill="none" stroke="#654737" stroke-width="2"/><path d="M105 52h7m16 0h7" stroke="#213034" stroke-width="4"/>'+(a.outfits==='hazmat'?'<rect x="97" y="47" width="46" height="17" rx="5" fill="#79c9b9bb"/><rect x="110" y="63" width="20" height="13" rx="3" fill="#22363a"/>':'')+'<path d="M75 114l91 15 22 18-8 12-29-11-80-14z" fill="#15252d" stroke="#789391" stroke-width="2"/><path d="M149 125l48 7v9l-48-5z" fill="#b7c2b5"/><circle cx="69" cy="126" r="9" fill="'+skin+'"/><circle cx="163" cy="144" r="9" fill="'+skin+'"/></svg>';
  }
  function drawFieldPreview(){
    const canvas=$('characterPreview').querySelector('canvas');if(!canvas)return;
    const c=canvas.getContext('2d');c.clearRect(0,0,240,240);
    c.save();c.translate(112,131);c.scale(2.6,2.6);
    window.CharacterArt.draw(c,window.PlayerAppearance,-.4,performance.now()*.007,1);
    c.restore();
  }
  function animatePreview(){if(!$('menu').classList.contains('hidden'))drawFieldPreview();requestAnimationFrame(animatePreview);}
  requestAnimationFrame(animatePreview);
  function render(){
    $('characterPreview').innerHTML='<div class="portraitFront">'+avatar()+'</div><div class="fieldPreview"><canvas width="240" height="240" aria-label="Oyun içi karakter görünümü"></canvas><span>OYUN İÇİNDE</span></div>';
    drawFieldPreview();
    const labels={outfits:'ÜST MODELİ',colors:'ÜST / GÖĞÜSLÜK RENGİ',heads:'BAŞLIK MODELİ',headColors:'BAŞLIK RENGİ',bottoms:'ALT MODELİ',bottomColors:'ALT RENGİ',skins:'TEN RENGİ'};
    $('appearanceOptions').innerHTML='<nav class="appearanceTabs" aria-label="Özelleştirme bölümü">'+Object.entries(parts).map(([id,p])=>'<button type="button" data-part="'+id+'" aria-pressed="'+(id===appearanceTab)+'" class="'+(id===appearanceTab?'picked':'')+'">'+p.name+'</button>').join('')+'</nav>'+parts[appearanceTab].fields.map(field=>{
      const options=G.APPEARANCE[field],selected=options.find(v=>v.id===window.PlayerAppearance[field]);
      return '<fieldset><legend>'+labels[field]+(selected.value?' · '+selected.name:'')+'</legend><div class="appearanceChoices '+(selected.value?'colorChoices':'modelChoices')+'">'+options.map(v=>'<button type="button" data-field="'+field+'" data-value="'+v.id+'" aria-label="'+labels[field]+': '+v.name+'" title="'+v.name+'" aria-pressed="'+(window.PlayerAppearance[field]===v.id)+'" class="'+(window.PlayerAppearance[field]===v.id?'picked':'')+'" '+(v.value?'style="--swatch:'+v.value+'"':'')+'>'+(v.value?'<i></i><span>'+v.name+'</span>':v.name)+'</button>').join('')+'</div></fieldset>';
    }).join('');
  }
  $('appearanceOptions').addEventListener('click',e=>{
    const part=e.target.closest('[data-part]');if(part){appearanceTab=part.dataset.part;render();return;}
    const b=e.target.closest('[data-field]');if(!b)return;
    window.PlayerAppearance=G.sanitizeAppearance({...window.PlayerAppearance,[b.dataset.field]:b.dataset.value});
    try{localStorage.setItem('ss_appearance',JSON.stringify(window.PlayerAppearance))}catch{}render();
  });
  function zombieIcon(id,z){return '<canvas width="224" height="224" data-zombie="'+id+'" role="img" aria-label="'+z.name+' görünümü"></canvas>';}
  function openCatalog(){
    $('catalogList').innerHTML=Object.entries(G.ZOMBIE_GUIDE).sort((a,b)=>a[1].night-b[1].night).map(([id,info])=>{const z=G.ZOMBIES[id];return '<article class="zombieCard"><div class="zombiePortrait">'+zombieIcon(id,z)+'<span>GECE '+info.night+(z.boss?' / HER 5 GECEDE':'')+'</span></div><div><small>'+info.role+'</small><h3>'+z.name+'</h3><div class="zombieStats">'+z.hp+' CAN · '+z.dmg+' HASAR · '+z.speed+' HIZ'+(z.range?' · '+z.range+' MENZİL':'')+'</div><p>'+info.behavior+'</p><p class="counter"><b>Karşı taktik:</b> '+info.counter+'</p></div></article>'}).join('');
    for(const canvas of $('catalogList').querySelectorAll('[data-zombie]')){
      const type=canvas.dataset.zombie,c=canvas.getContext('2d'),r=G.ZOMBIES[type].r;
      c.save();c.translate(112,112);const scale=Math.min(3.1,56/r);c.scale(scale,scale);
      window.ZombieArt.draw(c,type,.65,1.1,1000);c.restore();
    }
    $('menu').inert=true;
    $('zombieCatalog').classList.remove('hidden');$('closeCatalog').focus();
  }
  function closeCatalog(){$('menu').inert=false;$('zombieCatalog').classList.add('hidden');$('catalogBtn').focus();}
  $('catalogBtn').textContent='ZOMBİ KATALOĞU · '+Object.keys(G.ZOMBIES).length+' TÜR';
  $('catalogBtn').onclick=openCatalog;$('closeCatalog').onclick=closeCatalog;
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('zombieCatalog').classList.contains('hidden'))closeCatalog()});
  $('soundTestBtn').onclick=()=>window.GameAudio.test();
  $('volumeInput').value=Math.round(window.GameAudio.volume*100);
  $('volumeInput').addEventListener('input',e=>{window.GameAudio.setVolume(+e.target.value/100);$('volumeValue').textContent=e.target.value+'%';});
  $('volumeValue').textContent=Math.round(window.GameAudio.volume*100)+'%';render();
})();
