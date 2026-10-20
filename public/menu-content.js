(function(){
  'use strict';
  const G=window.GameCore,$=id=>document.getElementById(id);
  let stored={};try{stored=JSON.parse(localStorage.getItem('ss_appearance')||'{}')}catch{}
  window.PlayerAppearance=G.sanitizeAppearance(stored);
  function look(){const a=window.PlayerAppearance;return {a,color:G.APPEARANCE.colors.find(v=>v.id===a.colors).value,skin:G.APPEARANCE.skins.find(v=>v.id===a.skins).value};}
  function avatar(){const {a,color,skin}=look();return '<svg viewBox="0 0 240 240" aria-label="Karakter önizlemesi" role="img"><ellipse cx="120" cy="217" rx="58" ry="12" fill="#0006"/><path d="M88 150l-9 59h28l13-48 13 48h28l-9-59" fill="#202e34"/><path d="M75 79L54 144l20 8 22-46h48l22 46 20-8-21-65z" fill="'+color+'"/><path d="M88 77h64v85H88z" fill="'+color+'"/>'+(a.outfits==='heavy'?'<path d="M91 88h58v60H91z" fill="#48565f" stroke="#a7b4b2" stroke-width="3"/><path d="M100 94h40v40h-40z" fill="#28353a"/>':a.outfits==='hazmat'?'<path d="M105 81h30v80h-30z" fill="#dfca60"/><circle cx="120" cy="118" r="12" fill="#273e3d"/><text x="120" y="123" text-anchor="middle" fill="#dfca60" font-size="18">☢</text>':'<path d="M96 91h48v47H96z" fill="#2e423a"/><path d="M102 96h13v34h-13zm23 0h13v34h-13z" fill="#536a54"/>')+'<circle cx="120" cy="52" r="30" fill="'+skin+'"/>'+(a.heads==='hood'?'<path d="M84 58q-4-56 36-56t36 56l-13-22h-46z" fill="'+color+'"/>':a.heads==='beret'?'<path d="M87 35q-11-27 34-29t35 30z" fill="#773f50"/><circle cx="136" cy="22" r="4" fill="#f1d280"/>':'<path d="M86 40q-4-43 34-43t34 43z" fill="'+color+'"/><rect x="84" y="32" width="72" height="9" rx="3" fill="#2d4241"/>')+'<path d="M105 52h7m16 0h7" stroke="#213034" stroke-width="4"/>'+(a.outfits==='hazmat'?'<rect x="97" y="47" width="46" height="17" rx="5" fill="#79c9b9bb"/><rect x="110" y="63" width="20" height="13" rx="3" fill="#22363a"/>':'')+'<path d="M75 114l91 15 22 18-8 12-29-11-80-14z" fill="#15252d" stroke="#789391" stroke-width="2"/><path d="M149 125l48 7v9l-48-5z" fill="#b7c2b5"/><circle cx="69" cy="126" r="9" fill="'+skin+'"/><circle cx="163" cy="144" r="9" fill="'+skin+'"/></svg>';}
  function render(){
    $('characterPreview').innerHTML=avatar();
    $('appearanceOptions').innerHTML=Object.entries(G.APPEARANCE).map(([field,options])=>'<fieldset><legend>'+({colors:'KIYAFET RENGİ',outfits:'KIYAFET',heads:'BAŞLIK',skins:'TEN RENGİ'}[field])+'</legend><div class="appearanceChoices">'+options.map(v=>'<button type="button" data-field="'+field+'" data-value="'+v.id+'" aria-pressed="'+(window.PlayerAppearance[field]===v.id)+'" class="'+(window.PlayerAppearance[field]===v.id?'picked':'')+'" '+(v.value?'style="--swatch:'+v.value+'"':'')+'>'+(v.value?'<i></i>':'')+v.name+'</button>').join('')+'</div></fieldset>').join('');
  }
  $('appearanceOptions').addEventListener('click',e=>{const b=e.target.closest('[data-field]');if(!b)return;window.PlayerAppearance=G.sanitizeAppearance({...window.PlayerAppearance,[b.dataset.field]:b.dataset.value});try{localStorage.setItem('ss_appearance',JSON.stringify(window.PlayerAppearance))}catch{}render();});
  function zombieIcon(id,z){return '<svg viewBox="0 0 100 80" aria-hidden="true"><ellipse cx="50" cy="68" rx="29" ry="7" fill="#0005"/><path d="M30 43L12 58m58-15 18 15" stroke="'+z.color+'" stroke-width="13" stroke-linecap="round"/><ellipse cx="50" cy="42" rx="'+(id==='swarm'?14:25)+'" ry="25" fill="'+z.color+'"/><circle cx="50" cy="28" r="17" fill="#35473b"/><circle cx="43" cy="27" r="3" fill="#ef8a73"/><circle cx="57" cy="27" r="3" fill="#ef8a73"/>'+(z.armor?'<path d="M31 37h38v19H31z" fill="#a7bac6"/>':z.healAura?'<path d="M47 37h6v21h-6zm-7 7h20v6H40z" fill="#d6fff1"/>':z.siege?'<rect x="40" y="40" width="20" height="16" fill="#ffcc7c"/>':z.boss?'<path d="M32 10l5-9 13 8 13-8 5 9" fill="#f6ca6f"/>':'')+'</svg>';}
  function openCatalog(){
    $('catalogList').innerHTML=Object.entries(G.ZOMBIE_GUIDE).sort((a,b)=>a[1].night-b[1].night).map(([id,info])=>{const z=G.ZOMBIES[id];return '<article class="zombieCard"><div class="zombiePortrait">'+zombieIcon(id,z)+'<span>GECE '+info.night+(z.boss?' / HER 5 GECEDE':'')+'</span></div><div><small>'+info.role+'</small><h3>'+z.name+'</h3><div class="zombieStats">'+z.hp+' CAN · '+z.dmg+' HASAR · '+z.speed+' HIZ'+(z.range?' · '+z.range+' MENZİL':'')+'</div><p>'+info.behavior+'</p><p class="counter"><b>Karşı taktik:</b> '+info.counter+'</p></div></article>'}).join('');
    $('menu').inert=true;
    $('zombieCatalog').classList.remove('hidden');$('closeCatalog').focus();
  }
  function closeCatalog(){$('menu').inert=false;$('zombieCatalog').classList.add('hidden');$('catalogBtn').focus();}
  $('catalogBtn').onclick=openCatalog;$('closeCatalog').onclick=closeCatalog;
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('zombieCatalog').classList.contains('hidden'))closeCatalog()});
  $('soundTestBtn').onclick=()=>window.GameAudio.test();
  $('volumeInput').value=Math.round(window.GameAudio.volume*100);
  $('volumeInput').addEventListener('input',e=>{window.GameAudio.setVolume(+e.target.value/100);$('volumeValue').textContent=e.target.value+'%';});
  $('volumeValue').textContent=Math.round(window.GameAudio.volume*100)+'%';render();
})();
