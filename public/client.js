'use strict';
const G = window.GameCore;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');

const menuEl = $('menu'), lobbyEl = $('lobby'), hudEl = $('hud'), overEl = $('over');
const feedEl = $('feed'), centerMsgEl = $('centerMsg'), shopEl = $('shop');
const buildHintEl = $('buildHint'), scoreEl = $('scoreboard'), downEl = $('downOverlay');

let ws = null, myId = 0, roomCode = '', hostId = 0, inGame = false, intentionalClose = false;
let snapPrev = null, snapNext = null, snapNextAt = 0;
let latest = null, latestAt = 0;
let wallsLive = [], zombiesLive = [], playersLive = [];
let particles = [], decals = [], shake = 0;
let nightBlend=0,dawnUntil=0,reportUntil=0,lastBaseAlarm=-Infinity,warnedWave=0;
const hitFlashes=new Map(),shotFlashes=new Map();
let arcs=[],myLaserTime=0;
let pingMs=null,pingSent=0,nextPing=0,fpsFrames=0,fpsStart=0,fpsValue=0,lastDraw=0,lastImpactSound=-Infinity;
let placement = null;
let shopOpen = false, showScore = false;
let shopSignature = '';
let shopTab='weapons', myUpgrades={}, hotbarSignature='';
let cam = { x: G.BASE.x, y: G.BASE.y };
let mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
let keys = new Set();
let pred = { x: G.BASE.x, y: G.BASE.y };
let zFace = new Map();
let myWeapon = 'pistol', myAmmo = 14, myReload = 0, myState = 'alive', ownedWeaps = ['pistol'];
let myBleed = 0, myRevive = 0;
let baseLevel=1,completedNights=0;
let gold = 0, waveN = 0, phase = 'prep', phaseT = 0, baseHp = 0, baseMax = 1;
let lastSend = 0, fireSent = false, relSent = false;
let lastShootSfx = 0, centerTimer = 0;
let wsUrl = '';
let quickStart = false;
let muted = false;

let vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
function resize() {
  vw = innerWidth; vh = innerHeight;
  cv.width = vw * dpr; cv.height = vh * dpr;
  cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
}
addEventListener('resize', resize); resize();

function getScale() { return G.clamp(Math.min(vw / 1500, vh / 950), 0.5, 1.5); }
function mouseWorld() {
  const s = getScale();
  return { x: (mouse.x - vw / 2) / s + cam.x, y: (mouse.y - vh / 2) / s + cam.y };
}
function circleRect(cx, cy, r, x, y, w, h) {
  const px = G.clamp(cx, x, x + w), py = G.clamp(cy, y, y + h);
  const dx = cx - px, dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

/* ---------- AUDIO ---------- */
function ac(){return window.GameAudio?.unlock();}
function tone(...args){window.GameAudio?.tone(...args);}
function noiseBurst(...args){window.GameAudio?.noise(...args);}
const SFX = {
  shoot(kind) {
    const now = performance.now();
    if (now - lastShootSfx < 45) return;
    lastShootSfx = now;
    if(kind==='laser'){tone(180+myLaserTime*90,.16,'sawtooth',.09,240+myLaserTime*90);return;}
    if(kind==='arc'){tone(700,.12,'square',.1,150);noiseBurst(.08,.12,5000);return;}
    if(kind==='flame'){noiseBurst(.14,.15,700);return;}
    const v = kind === 'shotgun' ? 0.30 : kind === 'lmg' ? 0.16 : 0.2;
    noiseBurst(kind === 'shotgun' ? 0.14 : 0.07, v, kind === 'rifle' ? 3000 : 2000);
    tone(kind === 'rifle' ? 190 : kind === 'shotgun' ? 110 : 260, 0.06, 'square', v * 0.5, 70);
  },
  hit() { tone(900, 0.03, 'square', 0.06, 500); },
  kill() { noiseBurst(0.16, 0.22, 700); tone(150, 0.1, 'triangle', 0.1, 60); },
  hurt() { tone(300, 0.14, 'sawtooth', 0.2, 90); },
  down() { tone(500, 0.45, 'sawtooth', 0.2, 110); },
  revive() { tone(320, 0.16, 'sine', 0.2, 640); setTimeout(() => tone(640, 0.2, 'sine', 0.16, 900), 130); },
  buy() { tone(620, 0.07, 'sine', 0.15, 900); setTimeout(() => tone(940, 0.1, 'sine', 0.14), 70); },
  place() { noiseBurst(0.1, 0.2, 900); tone(140, 0.09, 'triangle', 0.14, 80); },
  reload() { tone(420, 0.05, 'square', 0.1, 300); setTimeout(() => tone(560, 0.05, 'square', 0.1), 90); },
  baseHit() { tone(95, 0.18, 'square', 0.16, 55); },
  wallBreak() { noiseBurst(0.3, 0.3, 1100); tone(120, 0.25, 'sawtooth', 0.16, 50); },
  wave() { tone(240, 0.5, 'sawtooth', 0.2, 480); setTimeout(() => tone(480, 0.35, 'sawtooth', 0.18, 300), 340); },
  clear() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.15), i * 95)); },
  acid() { tone(700, 0.08, 'sawtooth', 0.05, 350); },
  over() { tone(220, 1.3, 'sawtooth', 0.25, 40); noiseBurst(0.9, 0.3, 500); }
};

/* ---------- UI helpers ---------- */
function showScreen(el) {
  [menuEl, lobbyEl, overEl].forEach(s => s.classList.add('hidden'));
  if (el) el.classList.remove('hidden');
}
function err(m) { $('err').textContent = m || ''; }
function feed(text, color) {
  const d = document.createElement('div');
  d.className = 'feedItem';
  if (color) d.style.borderLeftColor = color;
  d.innerHTML = text;
  feedEl.appendChild(d);
  while (feedEl.children.length > 6) feedEl.firstChild.remove();
  setTimeout(() => d.remove(), 5500);
}
function centerMsg(main, sub, dur) {
  centerMsgEl.innerHTML = main + (sub ? '<div id="centerSub">' + sub + '</div>' : '');
  centerMsgEl.classList.remove('hidden');
  centerTimer = dur || 2.4;
}

/* ---------- networking ---------- */
function connect(name, create, code) {
  if (!wsUrl) {
    const base = window.ZBD_SERVER_URL;
    wsUrl = base ? base.replace(/\/$/, '') : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  intentionalClose = false;
  err('');
  ws = new WebSocket(wsUrl);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, create, code, appearance:window.PlayerAppearance }));
  ws.onmessage = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    handleMsg(m);
  };
  ws.onerror = () => err('Sunucuya bağlanılamadı');
  ws.onclose = () => {
    if (intentionalClose) return;
    inGame = false;window.GameAudio?.setScene({active:false});
    hudEl.classList.add('hidden');
    showScreen(menuEl);
    err('Bağlantı koptu');
  };
}
function sendMsg(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function handleMsg(m) {
  switch (m.t) {
    case 'err': err(m.m); intentionalClose = true; try { ws.close(); } catch (e) {} break;
    case 'joined':
      myId = m.id; roomCode = m.code; hostId = 0;
      if (m.state === 'playing') enterGame();
      else if (quickStart) { quickStart = false; sendMsg({ t: 'start' }); }
      else { showScreen(lobbyEl); $('roomCodeBig').textContent = roomCode; }
      break;
    case 'lobby':
      hostId = m.host || 0;
      if (!inGame) renderLobby(m);
      updateStartBtn();
      break;
    case 'gs':
      enterGame();
      break;
    case 's': onSnapshot(m); break;
    case 'pong':if(m.id===pingSent)pingMs=Math.round(performance.now()-pingSent);break;
    case 'over': onGameOver(m); break;
    case 'notice': feed(esc(m.m), '#ffd166'); break;
    case 'buildResult':
      if(m.ok){placement=null;updateBuildHint();}
      feed(m.ok ? 'İnşa tamamlandı. İnşa modu kapandı; ateş etmeye hazırsın.' : 'İnşa edilemedi. Daha boş bir alan seç veya ortak paranı kontrol et.', m.ok ? '#69d990' : '#ff7070');
      break;
    case 'left':
      feed('Bir oyuncu ayrıldı', '#7f8fa3');
      break;
  }
}

function renderLobby(m) {
  const list = $('lobbyList');
  list.innerHTML = '';
  for (const p of m.players) {
    const d = document.createElement('div');
    d.className = 'pl';
    d.innerHTML = '<span class="dot" style="background:' + p.color + ';color:' + p.color + '"></span>' +
      '<span>' + esc(p.name) + (p.id === myId ? ' <span style="color:#66788e">(sen)</span>' : '') + '</span>' +
      (p.id === m.host ? '<span class="tag">HOST</span>' : '');
    list.appendChild(d);
  }
  updateStartBtn(m);
}
function updateStartBtn(m) {
  const isHost = hostId === myId;
  $('startBtn').classList.toggle('hidden', !isHost);
  $('lobbyWait').classList.toggle('hidden', isHost);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function enterGame() {
  playerPoses.clear();zFace.clear();hitFlashes.clear();shotFlashes.clear();nightBlend=0;dawnUntil=0;reportUntil=0;warnedWave=0;$('nightReport').classList.add('hidden');pingMs=null;nextPing=0;fpsFrames=0;fpsStart=performance.now();
  inGame = true;
  snapPrev = snapNext = latest = null;
  keys.clear(); mouse.down = false;
  pred = { x: G.BASE.x, y: G.BASE.y };
  showScreen(null);
  hudEl.classList.remove('hidden');
  shopEl.classList.add('hidden');
  scoreEl.classList.add('hidden');
  downEl.classList.add('hidden');
  placement = null; shopOpen = false;
  particles = []; decals = [];
  $('roomChip').innerHTML = 'ODA <b>' + roomCode + '</b>';
  $('feed').innerHTML = '';
  cam.x = pred.x; cam.y = pred.y;
}

/* ---------- snapshots / interpolation ---------- */
function onSnapshot(m) {
  if (snapNext) snapInterval = G.clamp(performance.now() - snapNextAt, 16, 150);
  snapPrev = snapNext;
  snapNext = m;
  snapNextAt = performance.now();
  latest = m;
  latestAt = snapNextAt;

  gold = m.g; waveN = m.w; phase = m.p; phaseT = m.ti;
  baseHp = m.bh; baseMax = m.bmh; baseLevel=m.bl||1;completedNights=m.cn||0;
  wallsLive = m.L; zombiesLive = m.Z; playersLive = m.P;

  const me = m.P.find(p => p.i === myId);
  if (me) {
    const dx = me.x - pred.x, dy = me.y - pred.y;
    const d = Math.hypot(dx, dy);
    if (!snapPrev || d > 200) { pred.x = me.x; pred.y = me.y; }
    else { pred.x += dx * 0.22; pred.y += dy * 0.22; }
    myLaserTime=me.beam?.t||0;
    myWeapon = me.w; myAmmo = me.mz; myReload = me.rl;
    myState = me.s; myBleed = me.b; myRevive = me.rv;
    ownedWeaps = me.o || ['pistol']; myUpgrades=me.u||{};
  }
  for(const p of m.P){const before=snapPrev?.P.find(old=>old.i===p.i);if(before&&before.w===p.w&&p.mz<before.mz&&p.s==='alive'){
    shotFlashes.set(p.i,snapNextAt+75);
    if(p.i===myId&&!['laser','flame'].includes(p.w))shake=Math.max(shake,p.w==='shotgun'?2:1);
  }}
  window.GameAudio?.setScene({active:inGame,phase,wave:waveN,baseRatio:baseHp/baseMax});
  if(phase==='prep'&&phaseT<=5&&phaseT>0&&warnedWave!==waveN+1){warnedWave=waveN+1;noiseBurst(.55,.045,400);tone(92,.65,'triangle',.04,48);}
  processEvents(m.ev || []);
  updateHud();
  if (shopOpen) renderShop();
}

function processEvents(evs) {
  for (const e of evs) {
    switch (e.e) {
      case 'k':
        SFX.kill();
        bloodBurst(e.x, e.y, 10);
        addDecal(e.x, e.y, 12 + Math.random() * 10);
        break;
      case 'h': {
        const now=performance.now();if(e.id)hitFlashes.set(e.id,{until:now+110,armor:e.armor});
        if(now-lastImpactSound>65){if(e.armor)tone(1350,.045,'triangle',.07,750);else if(e.t==='spitter'||e.t==='mortar')noiseBurst(.055,.06,1100);else SFX.hit();lastImpactSound=now;}
        spark(e.x,e.y,e.armor?'#bdd2dc':e.t==='spitter'||e.t==='mortar'?'#c0d385':'#c4a895');break;
      }
      case 'ph': SFX.hurt(); if (e.id === myId) shake = Math.max(shake, 7); bloodBurst(e.x, e.y, 4); break;
      case 'bh':
        SFX.baseHit(); shake = Math.max(shake, 3);
        spark(e.x, e.y, '#ffcf6b');
        break;
      case 'whp': spark(e.x, e.y, '#c9d4e0'); break;
      case 'wbd':
        SFX.wallBreak(); shake = Math.max(shake, 5);
        for (let i = 0; i < 14; i++) spark(e.x, e.y, '#9fb2c8');
        addDecal(e.x, e.y, 9);
        break;
      case 'structureUpgrade':SFX.buy();feed(esc(e.item)+' #'+e.id+' → Seviye '+e.level,'#b8dca2');break;
      case 'teamUpgrade':SFX.buy();feed('Ekip geliştirmesi: '+esc(e.item)+' · Seviye '+e.level+' · Herkese uygulandı','#b8dca2');break;
      case 'arc':arcs.push({...e,t:.18});break;
      case 'blast':
        shake=Math.max(shake,5);for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;particles.push({x:e.x,y:e.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,c:'#ffd189',r:4,life:.45,t:0});}SFX.wallBreak();break;
      case 'ws':
        SFX.wave();tone(82,.65,'sawtooth',.035,43);noiseBurst(.4,.035,450);
        $('nightReport').classList.add('hidden');
        centerMsg('GECE ' + e.n, G.nightInfo(e.n).desc, 3.5);
        break;
      case 'wc':
        if(G.BASE_LEVELS.some(d=>d.night===e.n))feed('Yeni üs kademesi açılabilir! Market → Üs Seviyesi.','#d8d19b');
        let record=false;
        try{const key='ss_record_'+(playersLive.length===1?'solo':'team'),best=Number(localStorage.getItem(key))||0;record=e.n>best;localStorage.setItem(key,String(Math.max(e.n,best)));}catch{}
        SFX.clear();window.GameAudio?.dawn(record);dawnUntil=performance.now()+8500;
        showNightReport(e,record);
        centerMsg('GÜN DOĞDU', 'Herkes canlandı · Tam can · +' + e.b + '$', 3.5);
        break;
      case 'dd':
        if (e.id === myId) { SFX.down(); downEl.classList.remove('hidden'); }
        else feed('<b style="color:#ff728b">' + nameOf(e.id) + '</b> yere düştü!', '#ff728b');
        break;
      case 'dr':
        if (e.id === myId) { SFX.revive(); downEl.classList.add('hidden'); }
        feed('<b style="color:#69d990">' + nameOf(e.id) + '</b> ayağa kalktı', '#69d990');
        break;
      case 'dk':
        if (e.id === myId) { downEl.classList.add('hidden'); centerMsg('ÖLDÜN', 'Ekip geceyi atlatırsa dirileceksin', 3); }
        break;
      case 'buy':
        if (e.id === myId) { SFX.buy(); feed('Satın alındı: ' + esc(e.item), '#ffd166'); }
        break;
      case 'bld':
        SFX.place();
        for (let i = 0; i < 8; i++) spark(e.x, e.y, '#7be495');
        break;
      case 'rl':
        if (e.id === myId) SFX.reload();
        break;
    }
  }
}
function showNightReport(event,record){
  const r=event.report||{duration:0,kills:0,baseDamage:0,downs:0};
  const badges=[];
  if(r.baseDamage===0)badges.push('ÜS HASARSIZ');
  if(r.clutch)badges.push('SON ANDA KURTULDUNUZ');
  if(r.downs===0)badges.push('EKİP AYAKTA KALDI');
  if(record)badges.push('YENİ REKOR · '+event.n+' GECE');
  const rows=[];if(r.hunter)rows.push('Gece avcısı: '+esc(r.hunter.name)+' · '+r.hunter.count+' öldürme');
  if(r.rescuer)rows.push('Ekip kurtarıcısı: '+esc(r.rescuer.name)+' · '+r.rescuer.count+' kurtarma');
  $('nightReportContent').innerHTML='<small>ŞAFAK RAPORU</small><h3>Gece '+event.n+' atlatıldı</h3><div class="reportBadges">'+badges.map(b=>'<span>'+b+'</span>').join('')+'</div><p>'+r.kills+' zombi · '+Math.floor(r.duration/60)+' dk '+r.duration%60+' sn · +$'+event.b+'</p><p>Üs hasarı: '+r.baseDamage+' · Yere düşme: '+r.downs+'</p>'+rows.map(row=>'<p>'+row+'</p>').join('');
  $('nightReport').classList.remove('hidden');reportUntil=performance.now()+11000;
}
$('closeNightReport').onclick=()=>$('nightReport').classList.add('hidden');
$('musicBtn').onclick=()=>window.GameAudio?.toggleMusic();
$('musicVolume').addEventListener('input',e=>window.GameAudio?.setMusicVolume(+e.target.value/100));
function nameOf(id) {
  const p = latest && latest.P.find(x => x.i === id);
  return p ? esc(p.n) : '?';
}

/* ---------- particles ---------- */
function bloodBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3, t: 0, r: 2 + Math.random() * 3, c: '#c92c3c' });
  }
  if (particles.length > 400) particles.splice(0, particles.length - 400);
}
function spark(x, y, c) {
  if(particles.length>=240)return;
  for (let i = 0; i < Math.min(4,240-particles.length); i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2 + Math.random() * 0.2, t: 0, r: 1.5 + Math.random() * 2, c: c || '#ffd166' });
  }
}
function addDecal(x, y, r) {
  decals.push({ x, y, r, a: 0.32 + Math.random() * 0.2 });
  if (decals.length > 260) decals.shift();
}

/* ---------- input ---------- */
addEventListener('keydown', e => {
  if(e.target?.matches?.('input,textarea,select')||(e.code==='Space'&&e.target?.tagName==='BUTTON'))return;
  if (e.code === 'Tab') { e.preventDefault(); if (inGame) { showScore = true; renderScore(); } return; }
  if (inGame && e.code==='KeyB' && !e.repeat){e.preventDefault();toggleShop();return;}
  if (inGame && !shopOpen && ['KeyQ','KeyE'].includes(e.code) && !e.repeat){cycleWeapon(e.code==='KeyQ'?-1:1);return;}
  if (inGame && e.code==='KeyX' && !e.repeat){const p=mouseWorld();sendMsg({t:'salvage',x:p.x,y:p.y});return;}
  if (e.code === 'Escape') { placement = null; closeShop(); updateBuildHint(); }
  if (e.code === 'Space' && inGame && hostId === myId && phase === 'prep') { e.preventDefault(); sendMsg({ t: 'skip' }); }
  keys.add(e.code);
  if (inGame && !shopOpen) {
    const wi = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5','Digit6','Digit7','Digit8','Digit9','Digit0'].indexOf(e.code);
    if (wi >= 0) {
      const w = G.WEAPON_ORDER[wi];
      if (w && ownedWeaps.includes(w)) sendMsg({ t: 'equip', w });
      else if (w) openShop();
    }
  }
});
addEventListener('blur', () => { keys.clear(); mouse.down = false; sendMsg({t:'in',mx:0,my:0,a:0,f:false,r:false}); });
addEventListener('keydown', e => { if (inGame && !e.target?.matches?.('input,textarea,select') && !(e.code==='Space'&&e.target?.tagName==='BUTTON') && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'Tab') { showScore = false; scoreEl.classList.add('hidden'); }
});
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  ac();
  if (e.button !== 0) return;
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (inGame && placement) { tryPlace(); return; }
  mouse.down = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', e => { e.preventDefault(); placement = null; updateBuildHint(); });

function tryPlace() {
  if (!placement) return;
  const def = G.BUILD[placement];
  const w = mouseWorld();
  const x = Math.round(w.x), y = Math.round(w.y);
  if (!placeValid(placement, x, y)) { feed(gold < def.cost ? 'Ortak para yetersiz. Duvar: $50 · Taret: $350' : 'Kırmızı alan uygun değil. Üssün, duvarların ve zombilerin uzağında boş bir yer seç.', '#ff9d68'); return; }
  sendMsg({ t: 'build', k: placement, x, y });
}
function placeValid(kind, x, y) {
  const def = G.BUILD[kind];
  if(myState!=='alive')return false;
  if (gold < def.cost) return false;
  if (x < def.w / 2 + 10 || y < def.h / 2 + 10 || x > G.WORLD.w - def.w / 2 - 10 || y > G.WORLD.h - def.h / 2 - 10) return false;
  if (Math.hypot(x - G.BASE.x, y - G.BASE.y) < G.BASE.r + Math.max(def.w, def.h) * 0.6) return false;
  for (const wl of wallsLive) {
    if (circleRect(x, y, Math.max(def.w, def.h) * 0.55, wl.x - wl.w / 2, wl.y - wl.h / 2, wl.w, wl.h)) return false;
    if (Math.abs(wl.x - x) < (wl.w + def.w) / 2 && Math.abs(wl.y - y) < (wl.h + def.h) / 2) return false;
  }
  for(const p of playersLive){if(p.s!=='dead'&&circleRect(p.x,p.y,G.PLAYER.r+3,x-def.w/2,y-def.h/2,def.w,def.h))return false;}
  for (const z of zombiesLive) {
    if (Math.hypot(z.x - x, z.y - y) < z_mh_r(z) + Math.max(def.w, def.h) * 0.5) return false;
  }
  return true;
}
function z_mh_r(z) { return (G.ZOMBIES[z.t] || G.ZOMBIES.walker).r; }

/* ---------- shop ---------- */
function cancelBuild(){placement=null;mouse.down=false;updateBuildHint();}
function toggleShop(){
  if(placement){cancelBuild();closeShop();return;}
  shopOpen?closeShop():openShop();
}
function openShop(){cancelBuild();shopOpen=true;shopSignature='';shopEl.classList.remove('hidden');renderShop();}
function closeShop(cancel=true){shopOpen=false;shopEl.classList.add('hidden');if(cancel)cancelBuild();}
function cycleWeapon(direction){
  cancelBuild();const owned=G.WEAPON_ORDER.filter(w=>ownedWeaps.includes(w));
  if(owned.length>1)sendMsg({t:'equip',w:owned[(owned.indexOf(myWeapon)+direction+owned.length)%owned.length]});
}
cv.addEventListener('wheel',e=>{if(inGame&&!shopOpen){e.preventDefault();cycleWeapon(e.deltaY>0?1:-1);}},{passive:false});
function renderShop(){
  const signature=JSON.stringify([shopTab,gold,myWeapon,ownedWeaps,myUpgrades,myState,baseLevel,completedNights,phase,wallsLive.map(w=>[w.id,w.lv,Math.hypot(w.x-pred.x,w.y-pred.y)<=420])]);
  if(signature===shopSignature)return;shopSignature=signature;
  const tabs=[['weapons','CEPHANELİK'],['build','SAVUNMA'],['support','DESTEK'],['upgrades','EKİP'],['base','ÜS SEVİYESİ'],['structures','YAPI SEVİYELERİ']];
  let h='<div class="shopHeader"><div><small>SAHA İKMAL NOKTASI</small><h2>Hazırlan. Güçlen. Dayan.</h2></div><div class="shopBank">ORTAK KASA<strong>$'+gold+'</strong></div><button data-close="1" class="shopClose" aria-label="Marketi kapat">✕</button></div>';
  h+='<nav class="shopTabs" aria-label="Market kategorileri">'+tabs.map(([id,n])=>'<button data-tab="'+id+'" class="'+(id===shopTab?'active':'')+'">'+n+'</button>').join('')+'</nav>';
  const hints={weapons:'Satın aldığın silahlar sende kalır. 1–9 / 0, Q / E, fare tekerleği veya alttaki cephanelikle değiştir. Yedek mermi sınırsız; şarjörünü R ile doldur.',build:'Duvar, çelik barikat ve kapı taret ateşini keser. Demir çit arkasından taretler ateş edebilir; çit asidi de geçirir. Oyuncu mermileri dost yapılardan geçer. Yapıyı seçip zemine bir kez tıkla; B / Esc iptal eder.',support:'Tamir, yeni yapıdan daha ucuzdur. Hasarlı en yakın yapıyı onarır (420 menzil). Her gece sonunda bir kişi ayaktaysa herkes tam canla döner.',base:'Üs seviyeleri tüm ekibe ortaktır. Yalnızca hazırlıkta yükseltilir. Gerekli geceleri tamamla; yeni silahları, yapı seviyelerini ve taret kapasitesini aç.',structures:'Yakınındaki yapıya tek tek seviye bas. 420 menzil gerekir; üst sınır üs seviyendir (en çok 4). Geliştirme hasar oranını korur; tamir ayrı yapılır. Mayın tek kullanımlıdır.',upgrades:'Ekip geliştirmeleri ortak kasadan bir kez alınır, odadaki HERKESE uygulanır. Sonradan katılanlar da aynı seviyeyi alır. Her yeni seviyenin bedeli artar.'};
  h+='<p class="shopIntro">'+hints[shopTab]+'</p><div class="shopGrid '+(shopTab==='base'?'baseGrid':'')+'">';
  if(shopTab==='base'||shopTab==='structures'){
    if(shopTab==='base'){
      h+=G.BASE_LEVELS.map((d,i)=>{
        const level=i+1,done=baseLevel>=level,next=level===baseLevel+1;
        const reason=done?'AÇILDI':!next?'ÖNCE ÖNCEKİ KADEME':completedNights<d.night?d.night+' GECE TAMAMLA':phase!=='prep'?'HAZIRLIĞI BEKLE':gold<d.cost?'$'+d.cost+' · PARA YETERSİZ':'ÜSSÜ YÜKSELT · $'+d.cost;
        return '<article class="marketCard '+(done?'equipped':'')+'"><div class="itemTop">'+window.MarketArt.svg('base','base',level)+'</div><div class="itemBadge">ÜS SEVİYE '+level+'</div><h3>'+d.name+'</h3><button data-buy="baselevel" '+(!next||completedNights<d.night||phase!=='prep'||gold<d.cost||myState!=='alive'?'disabled':'')+'>'+reason+'</button><p>'+d.desc+'</p><ul class="equipmentFacts"><li>'+d.hp+' maksimum üs canı</li><li>'+d.turrets+' taret kapasitesi</li><li>Yapı seviye sınırı: '+level+'</li><li>Şart: '+d.night+' gece tamamla · $'+d.cost+'</li><li>Yükseltme yalnızca eklenen kapasite kadar can verir.</li></ul></article>';
      }).join('');
    }else{
      const structures=wallsLive.filter(w=>w.kind!=='mine').sort((a,b)=>Math.hypot(a.x-pred.x,a.y-pred.y)-Math.hypot(b.x-pred.x,b.y-pred.y));
      h+=structures.length?structures.map(w=>{
        const d=G.BUILD[w.kind],level=w.lv||1,near=Math.hypot(w.x-pred.x,w.y-pred.y)<=420,cost=G.structureUpgradeCost(w.kind,level),stats=G.structureStats(w.kind,Math.min(4,level+1),myUpgrades.fortification||0);
        const reason=level>=4?'TAM SEVİYE':level>=baseLevel?'ÜS SEVİYESİ YETERSİZ · '+(level+1):!near?'YAPIYA YAKLAŞ · 420':gold<cost?'$'+cost+' · PARA YETERSİZ':'SEVİYE '+(level+1)+' · $'+cost;
        return '<article class="marketCard"><div class="itemTop">'+window.MarketArt.svg('build',w.kind,level)+'</div><div class="itemBadge">YAPI #'+w.id+' · SEVİYE '+level+'</div><h3>'+d.name+'</h3><button data-structure="'+w.id+'" '+(level>=4||level>=baseLevel||!near||gold<cost||myState!=='alive'?'disabled':'')+'>'+reason+'</button><p>Üssün '+(w.y<G.BASE.y-60?'kuzey':w.y>G.BASE.y+60?'güney':'')+(w.x<G.BASE.x-60?'batı':w.x>G.BASE.x+60?'doğu':'')+' tarafında · Sana '+Math.round(Math.hypot(w.x-pred.x,w.y-pred.y))+' birim uzakta</p><ul class="equipmentFacts"><li>Sonraki maksimum can: '+stats.hp+'</li>'+(d.turret?'<li>Sonraki vuruş: '+(stats.damage*(1+.15*(myUpgrades.sentry||0))).toFixed(1)+'</li><li>Sonraki menzil: '+Math.round(stats.range)+'</li>':w.kind==='spikes'?'<li>Sonraki hasar: '+stats.damage.toFixed(1)+'/sn</li>':'')+'<li>Can oranı korunur; hasar bedavaya onarılmaz.</li></ul></article>';
      }).join(''):'<p class="shopEmpty">Henüz geliştirilecek yapı yok. Savunma sekmesinden bir yapı kur.</p>';
    }
    h+='</div><footer class="shopFooter">ÜS SV. '+baseLevel+' · '+completedNights+' GECE TAMAMLANDI · TARET '+wallsLive.filter(w=>G.BUILD[w.kind]?.turret).length+' / '+G.BASE_LEVELS[baseLevel-1].turrets+'</footer>';
    shopEl.innerHTML=h;return;
  }
  const ids=shopTab==='weapons'?G.WEAPON_ORDER:shopTab==='build'?Object.keys(G.BUILD):shopTab==='support'?['medkit','ammo','wallrepair','baserepair','teammed','teamammo']:Object.keys(G.UPGRADES);
  for(const id of ids){
    const d=shopTab==='weapons'?G.WEAPONS[id]:shopTab==='build'?G.BUILD[id]:shopTab==='support'?G.SHOP[id]:G.UPGRADES[id];
    const owned=shopTab==='weapons'&&ownedWeaps.includes(id),active=owned&&myWeapon===id,level=myUpgrades[id]||0;
    const capped=shopTab==='upgrades'&&level>=d.max;
    const locked=!owned&&baseLevel<(d.baseLevel||1),capacity=shopTab==='build'&&d.turret&&wallsLive.filter(w=>G.BUILD[w.kind]?.turret).length>=G.BASE_LEVELS[baseLevel-1].turrets;
    const price=owned?0:d.cost*(shopTab==='upgrades'?level+1:1),can=gold>=price&&myState==='alive'&&!capped&&!locked&&!capacity;
    let detail=d.desc|| (id==='medkit'?'Anında +'+d.heal+' can':id==='ammo'?'Aktif silahın şarjörünü hemen doldur':id==='wallrepair'?'En yakın hasarlı yapıya +'+d.heal+' can · 420 menzil':'Sığınağa +'+d.heal+' can');
    let stats='';
    if(shopTab==='weapons'){const dps=Math.round(d.damage*d.pellets/d.rate);stats='<div class="itemStats"><span>'+d.damage+(d.pellets>1?' × '+d.pellets:'')+'<small>HASAR</small></span><span>'+d.mag+'<small>ŞARJÖR</small></span><span>'+d.range+'<small>MENZİL</small></span></div>';detail+=d.beam?' · 0.2 sn başına 3–150 hasar':' · '+dps+' teorik hasar/sn';}
    if(shopTab==='build')stats='<div class="itemStats"><span>'+d.hp+'<small>DAYANIKLILIK</small></span><span>'+(d.turret?d.range:d.trap?'TUZAK':'SAVUNMA')+'<small>'+(d.turret?'MENZİL':'TÜR')+'</small></span></div>';
    if(shopTab==='upgrades')stats='<div class="levelTrack">'+Array.from({length:d.max},(_,i)=>'<i class="'+(i<level?'on':'')+'"></i>').join('')+'<span>'+level+' / '+d.max+'</span></div>';
    const facts=['Gerekli üs seviyesi: '+(d.baseLevel||1)];
    if(shopTab==='weapons'){
      facts.push('Doldurma: '+(d.reload*(1-.1*(myUpgrades.handling||0))).toFixed(2)+' sn','Ateş aralığı: '+d.rate+' sn','İsabet başına: '+(d.beam?'3 → 150':+(d.damage*(1+.1*(myUpgrades.power||0))).toFixed(1))+' × '+d.pellets,'Delme: '+(d.pierce+1)+' hedef',d.armorPierce?'Zırhı yok sayar':'Zırh hasarı azaltabilir','Menzil: '+d.range+' · '+(d.beam?'Anlık ışın':'Mermi hızı: '+d.speed));
    }else if(shopTab==='build'){
      facts.push('Can: '+Math.round(d.hp*(id==='mine'?1:1+.2*(myUpgrades.fortification||0))),'Söküm iadesi: en fazla $'+Math.floor(d.cost*.4));
      if(d.turret)facts.push('6 sn sürekli ateş → 3 sn soğuma','Kapasite: '+G.BASE_LEVELS[baseLevel-1].turrets+' taret','Vuruş: '+(d.damage*(1+.15*(myUpgrades.sentry||0))).toFixed(1),'Atış aralığı: '+d.rate+' sn','Menzil: '+d.range,'Delme: '+((d.pierce||0)+1)+' hedef');
      else if(id==='mine')facts.push('Patlama: '+d.damage+' hasar','Yarıçap: '+d.splash+' · tetik: 65');
      else if(id==='spikes')facts.push('Hasar: '+d.dps+'/sn','Yavaşlatma: %50','Aşınma: temas sırasında 8 can/sn');
      else facts.push(d.solid?'Oyuncu ve zombiyi durdurur':'Oyuncular geçer, zombiler durur',d.mesh?'Taret ateşi ve asit geçer':'Taret ateşini ve asidi durdurur','Oyuncu mermileri geçer');
    }else if(shopTab==='upgrades')facts.push('Etki: bütün ekip','Yeni katılanlara da uygulanır','En çok '+d.max+' seviye','Sonraki seviye: $'+(d.cost*(level+1)));
    else facts.push('Bedel: $'+d.cost,(id.startsWith('team')?'Etki: bütün ekip':id==='baserepair'?'Etki: ortak sığınak':id==='wallrepair'?'Etki: en yakın hasarlı yapı':'Etki: satın alan oyuncu'));
    if(d.slow)facts.push('Yavaşlatma: bu gece %'+Math.round((1-G.slowFactor(Math.max(1,waveN)))*100)+' · Geç gecelerde direnç artar');
    stats+='<ul class="equipmentFacts">'+facts.map(f=>'<li>'+f+'</li>').join('')+'</ul>';
    const attr=shopTab==='build'?'data-place':'data-buy';
    const label=locked?'ÜS SEVİYESİ YETERSİZ · '+d.baseLevel:capacity?'TARET KAPASİTESİ DOLU':active?'KUŞANILDI':capped?'TAM SEVİYE':owned?'KUŞAN':!can&&gold<price?'$'+price+' · PARA YETERSİZ':shopTab==='build'?'YERLEŞTİR · $'+price:shopTab==='upgrades'?'GELİŞTİR · $'+price:'SATIN AL · $'+price;
    h+='<article class="marketCard '+(active?'equipped':'')+'"><div class="itemTop">'+window.MarketArt.svg(shopTab,id)+'<span class="itemBadge">'+(owned?'ENVANTERİNDE':shopTab==='upgrades'?'TÜM EKİP':shopTab==='build'?'ORTAK SAVUNMA':shopTab==='weapons'?'KALICI SİLAH':'TEK KULLANIM')+'</span></div><h3>'+d.name+'</h3><button '+attr+'="'+id+'" '+(!can||active?'disabled':'')+'>'+label+'</button><p>'+detail+'</p>'+stats+'</article>';
  }
  h+='</div><footer class="shopFooter"><span>Gece market açıkken de devam eder.</span><span><kbd>B</kbd> kapat / inşayı iptal · <kbd>X</kbd> imleçteki yapıyı sök (%40 iade)</span></footer>';
  shopEl.innerHTML=h;
}
shopEl.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){shopTab=tab.dataset.tab;renderShop();return;}
  if(e.target.closest('[data-close]')){closeShop();return;}
  const structure=e.target.closest('[data-structure]');if(structure){sendMsg({t:'structureUpgrade',id:Number(structure.dataset.structure)});return;}
  const buy=e.target.closest('[data-buy]');if(buy){cancelBuild();sendMsg({t:'buy',item:buy.dataset.buy});return;}
  const build=e.target.closest('[data-place]');if(build){
    const id=build.dataset.place;if(gold<G.BUILD[id].cost||myState!=='alive'||baseLevel<(G.BUILD[id].baseLevel||1))return;
    closeShop();placement=id;updateBuildHint();feed('Boş zemine sol tıkla. B / Esc iptal eder; inşa tek yerleştirmeden sonra kapanır.','#69d990');
  }
});
function renderHotbar(){
  const sig=JSON.stringify([myWeapon,ownedWeaps]);if(sig===hotbarSignature)return;hotbarSignature=sig;
  $('weaponBelt').innerHTML=G.WEAPON_ORDER.map((id,i)=>'<button data-equip="'+id+'" '+(!ownedWeaps.includes(id)?'disabled':'')+' class="'+(id===myWeapon?'selected':'')+'" title="'+G.WEAPONS[id].name+'"><kbd>'+(i<9?i+1:i===9?'0':'Q/E')+'</kbd><span>'+G.WEAPONS[id].name+'</span></button>').join('');
}
$('weaponBelt').addEventListener('click',e=>{const b=e.target.closest('[data-equip]');if(b){cancelBuild();sendMsg({t:'equip',w:b.dataset.equip});}});

function updateBuildHint() {
  if (placement) {
    const d = G.BUILD[placement];
    buildHintEl.innerHTML = '<b>' + d.name + '</b> yerleştir — sol tık: koy · sağ tık / <kbd>Esc</kbd> iptal · maliyet $' + d.cost;
    buildHintEl.classList.remove('hidden');
    cv.style.cursor = 'crosshair';
  } else {
    buildHintEl.classList.add('hidden');
    cv.style.cursor = 'default';
  }
}
function renderShopGhostCursor() { cv.style.cursor = placement ? 'crosshair' : 'default'; }

/* ---------- HUD ---------- */
function updateHud() {
  renderHotbar();
  const ni=G.nightInfo(phase==='prep'?waveN+1:Math.max(1,waveN));
  $('nightForecast').title=ni.desc+' · Zırhlı: hasar azaltır · Yıkıcı: yapılara 3 kat hasar · Şifacı: yakın zombileri iyileştirir · Öfkeli: yarı canın altında hızlanır';
  $('nightForecast').textContent=(phase==='prep'?'SIRADAKİ GECE '+(waveN+1):'GECE '+waveN)+' / '+ni.name+' · '+ni.types.map(t=>G.ZOMBIES[t].name).join(' · ');
  $('waveBtn').disabled=phase!=='prep'||hostId!==myId;
  $('goldVal').textContent = gold;
  $('waveVal').textContent = waveN;
  $('killVal').textContent = latest ? latest.P.reduce((n,p) => n + p.k,0) : 0;
  $('phaseLabel').textContent = phase === 'prep' ? 'HAZIRLIK' : 'SALDIRI';
  const bw = baseMax > 0 ? (baseHp / baseMax * 100) : 0;
  $('baseBar').style.width = bw + '%';
  $('baseBar').style.background = bw > 55 ? 'linear-gradient(90deg,#3fbf6f,#7be495)' : bw > 25 ? 'linear-gradient(90deg,#e0a93e,#ffd166)' : 'linear-gradient(90deg,#c92c3c,#ff7a6b)';
  $('baseTxt').textContent = baseHp + ' / ' + baseMax+' · ÜS SV. '+baseLevel;

  if (phase === 'prep') {
    $('waveTimer').innerHTML = 'YENİ GECE <b style="color:#ffd166">' + Math.ceil(phaseT) + 's</b>' + (hostId === myId ? ' · <span style="color:#55677e">boşluk: atla</span>' : '');
  } else {
    $('waveTimer').innerHTML = 'KALAN ZOMBİ: <b style="color:#ff7a6b">' + (latest ? latest.Z.length : 0) + '</b> · GELEN: ' + (latest ? latest.q||0 : 0);
  }

  const me = latest && latest.P.find(p => p.i === myId);
  const hp = me ? me.hp : 0, mh = me ? me.mh : 100;
  const hw = mh > 0 ? hp / mh * 100 : 0;
  $('hpBar').style.width = hw + '%';
  $('hpTxt').textContent = hp + ' / ' + mh;

  const w = G.WEAPONS[myWeapon] || G.WEAPONS.pistol;
  $('weapName').textContent = w.name;
  $('laserFocus').classList.toggle('hidden',myWeapon!=='laser');
  $('laserFocus').textContent='ODAK '+myLaserTime.toFixed(1)+' / 4 sn · '+Math.round(G.laserDamage(myLaserTime)*(1+.1*(myUpgrades.power||0)))+' HASAR / 0.2 sn';
  const am = $('ammoVal');
  if (myReload > 0) { am.innerHTML = 'ŞARJÖR…'; am.className = 'am low'; }
  else { am.innerHTML = myAmmo + '<small>/' + w.mag + '</small>'; am.className = 'am' + (myAmmo <= w.mag * 0.25 ? ' low' : ''); }

  const rh = $('reviveHint');
  if (myState === 'dead') rh.textContent = 'Ölüsün — ekip geceyi atlatırsa dirileceksin';
  else if (myState === 'down') rh.textContent = '';
  else {
    const ally = latest && latest.P.find(p => p.i !== myId && p.s === 'down');
    const near = ally && Math.hypot(ally.x - pred.x, ally.y - pred.y) < 130;
    const resc = latest && latest.P.find(p => p.i !== myId && p.s === 'alive' && Math.hypot(p.x - (me ? me.x : 0), p.y - (me ? me.y : 0)) < 100);
    if (near) rh.innerHTML = 'Yaklaş ve bekle — <b style="color:#69d990">kaldırıyor…</b>';
    else if (ally) rh.innerHTML = '<span style="color:#ff7a6b">Yerde biri var — yardıma git!</span>';
    else rh.textContent = '';
  }

  if (myState === 'down') {
    downEl.querySelector('.t').textContent = 'YERE DÜŞTÜN';
    downEl.classList.remove('hidden');
    $('downTxt').textContent = 'Kanama: ' + Math.ceil(myBleed || 0) + ' sn · Ekip arkadaşın yanına gelsin (' + Math.round((myRevive || 0) / G.PLAYER.reviveTime * 100) + '%)';
  } else if (downEl.classList.contains('hidden') === false && myState === 'alive') {
    downEl.classList.add('hidden');
  }
}
function renderScore() {
  if (!latest || !showScore) return;
  scoreEl.classList.remove('hidden');
  let h = '<table><tr><th>OYUNCU</th><th>SİLAH</th><th>ÖLDÜRME</th><th>DURUM</th></tr>';
  const st = { alive: '<span style="color:#69d990">Ayakta</span>', down: '<span style="color:#ff7a6b">Yerde</span>', dead: '<span style="color:#66788e">Ölü</span>' };
  for (const p of latest.P.slice().sort((a, b) => b.k - a.k)) {
    h += '<tr><td><b style="color:' + p.c + '">' + esc(p.n) + '</b>' + (p.i === myId ? ' <span style="color:#66788e">(sen)</span>' : '') + '</td>' +
      '<td>' + (G.WEAPONS[p.w] || {}).name + '</td><td>' + p.k + '</td><td>' + (st[p.s] || '') + '</td></tr>';
  }
  h += '</table>';
  scoreEl.innerHTML = h;
}

function onGameOver(m) {
  inGame = false;window.GameAudio?.setScene({active:false});$('nightReport').classList.add('hidden');
  hudEl.classList.add('hidden');
  closeShop(); placement = null;
  SFX.over();
  showScreen(overEl);
  const completed=m.completed??Math.max(0,waveN-1),recordKey='ss_record_'+(m.stats.length===1?'solo':'team');
  let best=completed;try{best=Math.max(completed,Number(localStorage.getItem(recordKey))||0);localStorage.setItem(recordKey,String(best));}catch{}
  $('overWave').textContent = completed+' gece hayatta kaldınız · '+m.wave+'. gecede düştünüz · Bu cihazdaki '+(m.stats.length===1?'tek kişilik':'ekip')+' rekor: '+best;
  let h = '';
  for (const s of m.stats) {
    h += '<div class="sline"><span style="color:' + s.color + '">' + esc(s.name) + '</span><b>' + s.kills + ' öldürme</b></div>';
  }
  if (!m.stats.length) h = '<div class="sline">Kimse kurtulamadı…</div>';
  if (m.host === myId) {
    h += '<button id="restartBtn" class="green" style="width:100%;margin-top:14px">Tekrar Oyna</button>';
  }
  $('overStats').innerHTML = h;
  const rb = $('restartBtn');
  if (rb) rb.onclick = () => sendMsg({ t: 'start' });
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  window.GameAudio?.musicTick();
  if (!inGame) {fpsFrames=0;fpsStart=now;return;}
  if(now-fpsStart>=1000){fpsValue=Math.round(fpsFrames*1000/(now-fpsStart));fpsFrames=0;fpsStart=now;$('connectionStats').textContent=(pingMs===null?'—':pingMs)+' ms · '+fpsValue+' FPS';}
  if(now>=nextPing&&ws?.readyState===1){pingSent=performance.now();sendMsg({t:'ping',id:pingSent});nextPing=now+2000;}


  nightBlend+=( (phase==='wave'?1:0)-nightBlend)*Math.min(1,dt*.65);
  if(reportUntil&&now>reportUntil){$('nightReport').classList.add('hidden');reportUntil=0;}
  if(phase==='wave'&&baseHp/baseMax<.3&&now-lastBaseAlarm>4000){tone(740,.16,'triangle',.045,520);lastBaseAlarm=now;}
  // input → local prediction
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const ml = Math.hypot(mx, my);
  if (ml > 0 && myState !== 'dead') {
    mx /= ml; my /= ml;
    const spd = G.PLAYER.speed * (1+.08*(myUpgrades.mobility||0)) * (myState === 'down' ? 0.35 : 1) * dt;
    const R = G.PLAYER.r;
    const nx = pred.x + mx * spd, ny = pred.y + my * spd;
    if (!blocked(nx, pred.y, R)) pred.x = G.clamp(nx, R, G.WORLD.w - R);
    if (!blocked(pred.x, ny, R)) pred.y = G.clamp(ny, R, G.WORLD.h - R);
  }

  const aim = mouseWorld();
  const a = Math.atan2(aim.y - pred.y, aim.x - pred.x);
  const fire = !shopOpen && mouse.down && myState !== 'dead' && !placement;
  const rel = keys.has('KeyR');

  if (now - lastSend > 55 || fire !== fireSent || rel !== relSent) {
    sendMsg({ t: 'in', mx, my, a, f: fire, r: rel });
    lastSend = now; fireSent = fire; relSent = rel;
  }
  if (fire && myState==='alive' && myAmmo>0 && myReload<=0) {
    const w = G.WEAPONS[myWeapon];
    if (now - lastShootSfx > (w ? w.rate * 1000 - 15 : 0)) SFX.shoot(myWeapon);
  }

  // Market toggles on keydown so a single press also cancels construction.

  // camera
  cam.x += (pred.x - cam.x) * Math.min(1, dt * 9);
  cam.y += (pred.y - cam.y) * Math.min(1, dt * 9);
  const s = getScale(), halfW = vw / 2 / s, halfH = vh / 2 / s;
  cam.x = G.WORLD.w > halfW * 2 ? G.clamp(cam.x, halfW, G.WORLD.w - halfW) : G.WORLD.w / 2;
  cam.y = G.WORLD.h > halfH * 2 ? G.clamp(cam.y, halfH, G.WORLD.h - halfH) : G.WORLD.h / 2;
  shake *= Math.pow(0.001, dt);
  if (shake < 0.15) shake = 0;

  if (centerTimer > 0) {
    centerTimer -= dt;
    if (centerTimer <= 0) centerMsgEl.classList.add('hidden');
  }
  updateParticles(dt);
  if (showScore) renderScore();
  const drawElapsed=now-lastDraw;
  if(drawElapsed>=1000/60){lastDraw=now-drawElapsed%(1000/60);render(now);fpsFrames++;}
}
let keyLatchB = false;

function blocked(x, y, r) {
  if (Math.hypot(x - G.BASE.x, y - G.BASE.y) < G.BASE.r + r) return true;
  for (const w of wallsLive) {
    if (!(G.BUILD[w.kind || (w.k===1?'turret':'wall')]||{}).solid) continue;
    if (circleRect(x, y, r, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) return true;
  }
  return false;
}

function updateParticles(dt) {
  for(const a of arcs)a.t-=dt;arcs=arcs.filter(a=>a.t>0);
  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  particles = particles.filter(p => p.t < p.life);
}

/* ---------- rendering ---------- */
function lerpEntities(key) {
  const now = performance.now();
  const p0 = snapPrev, p1 = snapNext;
  const out = [];
  if (!p1) return out;
  const t1 = snapNextAt;
  const t0 = snapPrev ? snapNextAt - snapInterval : t1;
  const renderT = now - 90;
  let alpha = 1;
  if (p0) alpha = G.clamp((renderT - t0) / Math.max(1, t1 - t0), 0, 1);
  const map0 = new Map();
  if (p0) for (const e of p0[key]) map0.set(e.i, e);
  for (const e of (p1[key] || [])) {
    const o = map0.get(e.i);
    if (o) out.push({ ...e, x: o.x + (e.x - o.x) * alpha, y: o.y + (e.y - o.y) * alpha });
    else out.push(e);
  }
  return out;
}
let snapInterval = 33;

function render(now) {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, vw, vh);

  const s = getScale();
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(vw / 2 + sx, vh / 2 + sy);
  ctx.scale(s, s);
  ctx.translate(-cam.x, -cam.y);

  drawFloor();

  for (const d of decals) {
    ctx.fillStyle = 'rgba(140, 20, 30,' + d.a + ')';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, 0, 0, 7); ctx.fill();
  }

  drawBase(now);

  const interpPlayers = lerpEntities('P');
  const interpZombies = lerpEntities('Z');

  for (const w of wallsLive) drawWall(w);

  for (const a of (latest ? latest.A : [])) {
    ctx.fillStyle = '#9dff6b';
    ctx.shadowColor = '#9dff6b'; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
  }

  const drawables = [];
  const visibleZombieIds=new Set(interpZombies.map(z=>z.i));
  for(const id of zFace.keys())if(!visibleZombieIds.has(id)){zFace.delete(id);hitFlashes.delete(id);}
  for (const z of interpZombies) if(Math.abs(z.x-cam.x)<vw/(2*s)+100&&Math.abs(z.y-cam.y)<vh/(2*s)+100)drawables.push({ y: z.y, kind: 'z', e: z });
  for (const p of interpPlayers) drawables.push({ y: p.y, kind: 'p', e: p });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (d.kind === 'z') drawZombie(d.e, now);
    else drawPlayer(d.e, now);
  }

  for(const p of interpPlayers){if(!p.beam||p.s!=='alive')continue;
    const x=p.i===myId?pred.x:p.x,y=p.i===myId?pred.y:p.y,charge=p.beam.t/4;
    ctx.save();ctx.strokeStyle=charge>.8?'#fff1c4':'#ff669a';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=14+charge*12;ctx.lineWidth=2+charge*5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(p.beam.x,p.beam.y);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#fff5eb';ctx.stroke();
    if(p.beam.target){ctx.fillStyle='#ffe5d3';ctx.font='bold 13px Segoe UI';ctx.textAlign='center';ctx.fillText(p.beam.d+' / vuruş',p.beam.x,p.beam.y-35);ctx.beginPath();ctx.arc(p.beam.x,p.beam.y,7+charge*8,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  for(const a of arcs){ctx.save();ctx.globalAlpha=a.t/.18;ctx.strokeStyle='#c5a7ff';ctx.shadowColor='#b08bff';ctx.shadowBlur=15;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo((a.x+a.tx)/2+Math.sin(now)*10,(a.y+a.ty)/2+Math.cos(now)*10);ctx.lineTo(a.tx,a.ty);ctx.stroke();ctx.restore();}
  // bullets
  const extrapol = G.clamp((now - snapNextAt) / 1000, 0, 0.08);
  if (latest) {
    for (const b of latest.B) {
      const sp = b.v || bulletSpeed(b.o);
      const bx = b.x + Math.cos(b.a) * sp * extrapol;
      const by = b.y + Math.sin(b.a) * sp * extrapol;
      const col = b.c || (b.o === myId ? '#fff2b0' : b.o === -1 ? '#a8ffcf' : '#ffd98a');
      ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      ctx.shadowColor = col; ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(bx - Math.cos(b.a) * 15, by - Math.sin(b.a) * 15);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  for (const p of particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (placement) drawGhost();

  ctx.restore();

  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  if(nightBlend>.01){ctx.fillStyle='rgba(8,18,43,'+nightBlend*.16+')';ctx.fillRect(0,0,vw,vh);}
  const dawn=Math.max(0,(dawnUntil-now)/8500);
  if(dawn>0){const sunlight=ctx.createLinearGradient(0,0,vw,vh);sunlight.addColorStop(0,'rgba(255,205,132,'+dawn*.18+')');sunlight.addColorStop(1,'transparent');ctx.fillStyle=sunlight;ctx.fillRect(0,0,vw,vh);}
  const vignette=ctx.createRadialGradient(vw/2,vh/2,vh*.22,vw/2,vh/2,Math.max(vw,vh)*.65);
  vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#020809aa');ctx.fillStyle=vignette;ctx.fillRect(0,0,vw,vh);
  if(!shopOpen){ctx.strokeStyle='#c0ffe8';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mouse.x,mouse.y,7,0,Math.PI*2);ctx.moveTo(mouse.x-12,mouse.y);ctx.lineTo(mouse.x-4,mouse.y);ctx.moveTo(mouse.x+4,mouse.y);ctx.lineTo(mouse.x+12,mouse.y);ctx.moveTo(mouse.x,mouse.y-12);ctx.lineTo(mouse.x,mouse.y-4);ctx.moveTo(mouse.x,mouse.y+4);ctx.lineTo(mouse.x,mouse.y+12);ctx.stroke();}
  ctx.restore();
  // edge zombie arrows
  drawThreatIndicators(interpZombies, s);
}
function bulletSpeed(owner) {
  if (owner === -1) return G.BUILD.turret.bulletSpeed;
  const p = latest && latest.P.find(x => x.i === owner);
  const w = p && G.WEAPONS[p.w];
  return w ? w.speed : 800;
}

function drawFloor(){
  window.EnvironmentArt.drawGround(ctx);
  window.EnvironmentArt.drawLamps(ctx,nightBlend);
}
function drawBase(now){window.EnvironmentArt.drawRefuge(ctx,baseLevel,baseHp/baseMax,now,nightBlend);}

function drawWall(w) {
  const def=G.BUILD[w.kind || (w.k===1?'turret':'wall')];
  const x = w.x - w.w / 2, y = w.y - w.h / 2;
  if(shopOpen&&shopTab==='structures'){ctx.fillStyle='#e8d7a2';ctx.font='bold 12px Segoe UI';ctx.textAlign='center';ctx.fillText('#'+w.id,w.x,y+w.h+17);}
  if(w.lv>1){ctx.fillStyle='#ead898';ctx.font='bold 11px Segoe UI';ctx.textAlign='center';ctx.fillText('SV.'+w.lv,w.x,y-12);}
  if(def.turret&&(w.cool>0||w.jam)){ctx.fillStyle=w.cool>0?'#ffb279':'#ce9dff';ctx.font='bold 10px Segoe UI';ctx.textAlign='center';ctx.fillText(w.cool>0?'SOĞUMA':'BOZULDU',w.x,y-24);}
  if(def.turret&&w.heat>0){ctx.fillStyle='#25333d';ctx.fillRect(x,y+w.h+4,w.w,3);ctx.fillStyle=w.cool>0?'#f9a26b':'#dcc684';ctx.fillRect(x,y+w.h+4,w.w*Math.min(1,w.heat),3);}
  const frac = w.mh > 0 ? w.hp / w.mh : 1;
  if(def.mesh){
    ctx.fillStyle='rgba(100,135,137,.12)';ctx.fillRect(x,y,w.w,w.h);
    ctx.strokeStyle=frac>.4?'#a6bebc':'#a56e56';ctx.lineWidth=1.4;
    ctx.save();ctx.beginPath();ctx.rect(x+3,y+3,w.w-6,w.h-6);ctx.clip();
    for(let i=-w.h;i<w.w+w.h;i+=10){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+w.h,y+w.h);ctx.moveTo(x+i,y+w.h);ctx.lineTo(x+i+w.h,y);ctx.stroke();}
    ctx.restore();ctx.strokeStyle='#718d92';ctx.lineWidth=4;ctx.strokeRect(x+2,y+2,w.w-4,w.h-4);
    ctx.fillStyle='#c5d3ce';for(const px of [x+1,x+w.w-5])for(const py of [y+1,y+w.h-5])ctx.fillRect(px,py,4,4);
    if(frac<1)hpBarSmall(w.x,y-7,w.w,frac);return;
  }
  if(def.trap){
    ctx.fillStyle=def.splash?'#efb56b':'#748d9b';ctx.strokeStyle='#a9c2c4';ctx.lineWidth=2;
    ctx.strokeRect(x,y,w.w,w.h);
    if(def.splash){ctx.beginPath();ctx.arc(w.x,w.y,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f84f51';ctx.fillRect(w.x-2,w.y-2,4,4);}
    else{for(let i=6;i<w.w;i+=13){ctx.beginPath();ctx.moveTo(x+i,y+4);ctx.lineTo(x+i-7,y+w.h-4);ctx.stroke();}}
    if(frac<1)hpBarSmall(w.x,y-7,w.w,frac);return;
  }
  if (w.k === 1) {
    ctx.fillStyle = '#232d3c';
    ctx.fillRect(x, y, w.w, w.h);
    ctx.strokeStyle = frac > 0.5 ? '#4a6180' : '#a4533c';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1.5, y + 1.5, w.w - 3, w.h - 3);
    // barrel
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.a || 0);
    ctx.fillStyle = '#8fa3bb';
    ctx.fillRect(2, -3.5, w.w * 0.58, 7);
    ctx.fillStyle = w.kind==='frostTurret'?'#8fe8ff':w.kind==='sniperTurret'?'#e3b7ff':'#69d990';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    if (frac < 1) hpBarSmall(w.x, y - 7, w.w, frac);
  } else {
    const grad = frac > 0.6 ? '#3a4b62' : frac > 0.3 ? '#54493a' : '#5c3a38';
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, w.w - 2, w.h - 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x + 7, y + 7, w.w - 14, w.h - 14);
    if(w.kind==='gate'){ctx.strokeStyle='#a3e7b6';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.strokeRect(x+6,y+6,w.w-12,w.h-12);ctx.setLineDash([]);ctx.fillStyle='#a3e7b6';ctx.font='bold 17px Segoe UI';ctx.textAlign='center';ctx.fillText('↔',w.x,w.y+5);}
    if(w.kind==='reinforced'){ctx.strokeStyle='#adbaca';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+5,y+5);ctx.lineTo(x+w.w-5,y+w.h-5);ctx.moveTo(x+w.w-5,y+5);ctx.lineTo(x+5,y+w.h-5);ctx.stroke();}
    if (frac < 1) hpBarSmall(w.x, y - 7, w.w, frac);
  }
}
function hpBarSmall(cx, y, wdt, frac) {
  ctx.fillStyle = '#10161f';
  ctx.fillRect(cx - wdt / 2, y, wdt, 4.5);
  ctx.fillStyle = frac > 0.5 ? '#3fbf6f' : frac > 0.25 ? '#ffd166' : '#ff5a5a';
  ctx.fillRect(cx - wdt / 2, y, wdt * frac, 4.5);
}

function drawZombie(z, now) {
  const base = G.ZOMBIES[z.t] || G.ZOMBIES.walker;
  const r = base.r;
  const prev=zFace.get(z.i),distance=prev?Math.hypot(z.x-prev.x,z.y-prev.y):0;
  const ang=prev?(distance>.4?Math.atan2(z.y-prev.y,z.x-prev.x):prev.a):Math.PI/2;
  const stride=(prev?.stride||0)+(distance<80?distance*.14*16/r:0);
  zFace.set(z.i,{x:z.x,y:z.y,a:ang,stride});
  if(base.disrupt){ctx.strokeStyle='#b991e233';ctx.lineWidth=1.5;ctx.setLineDash([8,12]);ctx.beginPath();ctx.arc(z.x,z.y,base.disrupt,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  if(base.healAura||base.boss){ctx.strokeStyle=base.boss?'#ff627955':'#60e2b955';ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,r+7+Math.sin(now/250)*2,0,Math.PI*2);ctx.stroke();}
  const flash=hitFlashes.get(z.i),hit=flash?Math.max(0,(flash.until-now)/110):0;
  ctx.save();ctx.translate(z.x-Math.cos(ang)*hit*2,z.y-Math.sin(ang)*hit*2);
  window.ZombieArt.drawCached(ctx,z.t,ang,stride,now,base.rage&&z.hp<z.mh*.5);
  if(hit>0){ctx.globalAlpha=hit*.45;ctx.globalCompositeOperation='screen';window.ZombieArt.drawCached(ctx,z.t,ang,stride,now,base.rage&&z.hp<z.mh*.5);}
  ctx.restore();

  if (z.hp < z.mh || base.boss) {
    const wdt = base.boss ? 76 : r * 2.2;
    ctx.fillStyle = '#10161f';
    ctx.fillRect(z.x - wdt / 2, z.y - r - 16, wdt, base.boss ? 7 : 5);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(z.x - wdt / 2, z.y - r - 16, wdt * Math.max(0, z.hp / z.mh), base.boss ? 7 : 5);
    if (base.boss) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(base.name, z.x, z.y - r - 23);
    }
  }
}

const playerPoses = new Map();
function drawPlayer(p, now) {
  const isMe = p.i === myId;
  const x = isMe ? pred.x : p.x, y = isMe ? pred.y : p.y;
  const R = G.PLAYER.r;

  if (p.s === 'dead') return;

  const down = p.s === 'down';
  const aim = isMe ? Math.atan2(mouseWorld().y - y, mouseWorld().x - x) : p.a;
  let pose = playerPoses.get(p.i);
  if (!pose) { pose = {x,y,time:now,stride:0,moving:0}; playerPoses.set(p.i,pose); }
  const distance = Math.hypot(x-pose.x,y-pose.y);
  const dt = Math.max(0,Math.min((now-pose.time)/1000,.1));
  const moving = !down && distance > .05 && distance < 50;
  if(moving) pose.stride += distance * .17;
  pose.moving += ((moving ? 1 : 0)-pose.moving)*Math.min(1,dt*18);
  pose.x=x;pose.y=y;pose.time=now;
  if(isMe) {
    ctx.strokeStyle='rgba(166,222,188,.5)';ctx.lineWidth=1.3;
    ctx.beginPath();ctx.ellipse(x,y+17,20,8,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.save();ctx.translate(x,y);
  const kick=Math.max(0,((shotFlashes.get(p.i)||0)-now)/75);
  window.CharacterArt.draw(ctx,p.ap,aim,pose.stride,pose.moving,down,kick*2);
  if(kick>0&&!down&&p.w!=='laser'){
    ctx.save();ctx.translate(0,-3);ctx.rotate(aim);ctx.globalAlpha=kick;
    ctx.fillStyle=G.WEAPONS[p.w]?.color||'#ffda89';ctx.beginPath();ctx.moveTo(35,-1);ctx.lineTo(44,-7);ctx.lineTo(42,-1);ctx.lineTo(51,0);ctx.lineTo(42,3);ctx.lineTo(44,8);ctx.lineTo(35,3);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.restore();

  if (down) {
    ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7);
    ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7);
    ctx.stroke();
    if (p.rv > 0) {
      const fr = G.clamp(p.rv / G.PLAYER.reviveTime, 0, 1);
      ctx.strokeStyle = '#69d990'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, R + 8, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ff9d9d';
    ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(p.b) + 's', x, y + R + 18);
  }

  // name + hp
  ctx.font = 'bold 12.5px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillText(p.n, x + 1, y - R - 37);
  ctx.fillStyle = isMe ? '#ffffff' : p.c;
  ctx.fillText(p.n, x, y - R - 38);
  if (p.hp < p.mh || down) {
    const wdt = 42;
    ctx.fillStyle = '#10161f';
    ctx.fillRect(x - wdt / 2, y - R - 32, wdt, 5);
    ctx.fillStyle = down ? '#ff5a5a' : '#3fbf6f';
    ctx.fillRect(x - wdt / 2, y - R - 32, wdt * G.clamp(p.hp / p.mh, 0, 1), 5);
  }

  if (isMe && myReload > 0) {
    const w = G.WEAPONS[myWeapon];
    const fr = 1 - myReload / (w.reload*(1-.1*(myUpgrades.handling||0)));
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, R + 6, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); ctx.stroke();
  }
}

function drawGhost() {
  const def = G.BUILD[placement];
  const w = mouseWorld();
  const x = Math.round(w.x), y = Math.round(w.y);
  const ok = placeValid(placement, x, y);
  ctx.globalAlpha = 0.75;
  if (def.turret) {
    ctx.strokeStyle = ok ? '#69d990' : '#ff5a5a';
    ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, def.range, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = ok ? 'rgba(105, 217, 144, .35)' : 'rgba(255, 90, 90, .35)';
  ctx.strokeStyle = ok ? '#69d990' : '#ff5a5a';
  ctx.lineWidth = 2;
  ctx.fillRect(x - def.w / 2, y - def.h / 2, def.w, def.h);
  ctx.strokeRect(x - def.w / 2, y - def.h / 2, def.w, def.h);
  ctx.globalAlpha = 1;
}

function drawThreatIndicators(zombies, s) {
  if (!zombies.length) return;
  const margin = 56;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const z of zombies) {
    const sx = (z.x - cam.x) * s + vw / 2, sy = (z.y - cam.y) * s + vh / 2;
    if (sx > -20 && sx < vw + 20 && sy > -20 && sy < vh + 20) continue;
    const cx = G.clamp(sx, margin, vw - margin), cy = G.clamp(sy, margin, vh - margin);
    const a = Math.atan2(sy - vh / 2, sx - vw / 2);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255, 90, 90, .8)';
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- menu wiring ---------- */
$('soloBtn').onclick = () => { quickStart = true; $('createBtn').click(); };
$('marketBtn').onclick = toggleShop;
$('waveBtn').onclick = () => { if(hostId===myId && phase==='prep') sendMsg({t:'skip'}); };
$('muteBtn').onclick = () => {window.GameAudio?.toggle();};
$('nameInput').value = localStorage.getItem('zbd_name') || '';
$('createBtn').onclick = () => {
  ac();
  const name = ($('nameInput').value || '').trim() || 'Kahraman';
  localStorage.setItem('zbd_name', name);
  $('createBtn').disabled = true;
  connect(name, true, '');
  setTimeout(() => { $('createBtn').disabled = false; }, 1200);
};
$('joinBtn').onclick = () => {
  ac();
  const name = ($('nameInput').value || '').trim() || 'Kahraman';
  localStorage.setItem('zbd_name', name);
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length !== 5) { err('Oda kodu 5 harf olmalı'); return; }
  connect(name, false, code);
};
$('codeInput').addEventListener('keydown', e => { if (e.code === 'Enter') $('joinBtn').click(); });
$('startBtn').onclick = () => sendMsg({ t: 'start' });
$('leaveBtn').onclick = () => {
  intentionalClose = true;
  try { ws.close(); } catch (e) {}
  ws = null;
  showScreen(menuEl);
};
$('overBack').onclick = () => {
  intentionalClose = true;
  try { ws.close(); } catch (e) {}
  ws = null;
  showScreen(menuEl);
};

requestAnimationFrame(loop);
