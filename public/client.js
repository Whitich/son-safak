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
let placement = null;
let shopOpen = false, showScore = false;
let cam = { x: G.BASE.x, y: G.BASE.y };
let mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
let keys = new Set();
let pred = { x: G.BASE.x, y: G.BASE.y };
let zFace = new Map();
let myWeapon = 'pistol', myAmmo = 14, myReload = 0, myState = 'alive', ownedWeaps = ['pistol'];
let myBleed = 0, myRevive = 0;
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
let actx = null;
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type, vol, slide) {
  if (muted) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + dur);
    g.gain.value = vol || 0.15;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch (e) {}
}
function noiseBurst(dur, vol, freq) {
  if (muted) return;
  try {
    const a = ac(), n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = a.createGain(); g.gain.value = vol || 0.2;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  } catch (e) {}
}
const SFX = {
  shoot(kind) {
    const now = performance.now();
    if (now - lastShootSfx < 45) return;
    lastShootSfx = now;
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
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, create, code }));
  ws.onmessage = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    handleMsg(m);
  };
  ws.onerror = () => err('Sunucuya bağlanılamadı');
  ws.onclose = () => {
    if (intentionalClose) return;
    inGame = false;
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
    case 'over': onGameOver(m); break;
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
  baseHp = m.bh; baseMax = m.bmh;
  wallsLive = m.L; zombiesLive = m.Z; playersLive = m.P;

  const me = m.P.find(p => p.i === myId);
  if (me) {
    const dx = me.x - pred.x, dy = me.y - pred.y;
    const d = Math.hypot(dx, dy);
    if (!snapPrev || d > 200) { pred.x = me.x; pred.y = me.y; }
    else { pred.x += dx * 0.22; pred.y += dy * 0.22; }
    myWeapon = me.w; myAmmo = me.mz; myReload = me.rl;
    myState = me.s; myBleed = me.b; myRevive = me.rv;
    ownedWeaps = me.o || ['pistol'];
  }
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
      case 'h': SFX.hit(); spark(e.x, e.y); break;
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
      case 'ws':
        SFX.wave();
        centerMsg('DALGA ' + e.n, 'Hayatta kal!', 2.6);
        break;
      case 'wc':
        SFX.clear();
        centerMsg('DALGA TEMİZ!', '+' + e.b + '$', 2.6);
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
        if (e.id === myId) { downEl.classList.add('hidden'); centerMsg('ÖLDÜN', 'Dalganın başında dirileceksin', 3); }
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
function nameOf(id) {
  const p = latest && latest.P.find(x => x.i === id);
  return p ? esc(p.name) : '?';
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
  for (let i = 0; i < 4; i++) {
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
  if (e.code === 'Tab') { e.preventDefault(); if (inGame) { showScore = true; renderScore(); } return; }
  if (e.code === 'Escape') { placement = null; closeShop(); updateBuildHint(); }
  if (e.code === 'Space' && inGame && hostId === myId && phase === 'prep') { e.preventDefault(); sendMsg({ t: 'skip' }); }
  keys.add(e.code);
  if (inGame && !shopOpen) {
    const wi = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
    if (wi >= 0) {
      const w = G.WEAPON_ORDER[wi];
      if (w && ownedWeaps.includes(w)) sendMsg({ t: 'equip', w });
      else if (w) openShop();
    }
  }
});
addEventListener('blur', () => { keys.clear(); mouse.down = false; sendMsg({t:'in',mx:0,my:0,a:0,f:false,r:false}); });
addEventListener('keydown', e => { if (inGame && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'Tab') { showScore = false; scoreEl.classList.add('hidden'); }
});
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  ac();
  if (e.button !== 0) return;
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
  if (!placeValid(placement, x, y)) return;
  sendMsg({ t: 'build', k: placement, x, y });
}
function placeValid(kind, x, y) {
  const def = G.BUILD[kind];
  if (gold < def.cost) return false;
  if (x < def.w / 2 + 10 || y < def.h / 2 + 10 || x > G.WORLD.w - def.w / 2 - 10 || y > G.WORLD.h - def.h / 2 - 10) return false;
  if (Math.hypot(x - G.BASE.x, y - G.BASE.y) < G.BASE.r + Math.max(def.w, def.h) * 0.6) return false;
  for (const wl of wallsLive) {
    if (Math.abs(wl.x - x) < (wl.w + def.w) / 2 && Math.abs(wl.y - y) < (wl.h + def.h) / 2) return false;
  }
  for (const z of zombiesLive) {
    if (Math.hypot(z.x - x, z.y - y) < z_mh_r(z) + Math.max(def.w, def.h) * 0.5) return false;
  }
  return true;
}
function z_mh_r(z) { return (G.ZOMBIES[z.t] || G.ZOMBIES.walker).r; }

/* ---------- shop ---------- */
function openShop() {
  shopOpen = true;
  shopEl.classList.remove('hidden');
  renderShop();
}
function closeShop() { shopOpen = false; shopEl.classList.add('hidden'); }
function renderShop() {
  let h = '<h4>MARKET — <span style="color:#ffd166">$' + gold + '</span></h4>';
  h += '<div class="shopGroup"><div class="gt">SİLAHLAR</div>';
  for (const id of G.WEAPON_ORDER) {
    const w = G.WEAPONS[id];
    const owned = ownedWeaps.includes(id);
    const active = myWeapon === id;
    const can = owned || gold >= w.cost;
    h += '<div class="shopItem ' + (owned ? 'owned ' : '') + (active ? 'can' : can ? '' : 'no') + '" data-buy="' + id + '">' +
      '<div><div class="nm">' + w.name + (active ? ' ●' : '') + '</div>' +
      '<div class="ds">Hasar ' + w.damage + ' · ' + (w.pellets > 1 ? w.pellets + ' saçma · ' : '') + 'Kad ' + w.mag + '</div></div>' +
      '<div class="pr">' + (owned ? (active ? 'TAŞIYOR' : 'EŞLE') : '$' + w.cost) + '</div></div>';
  }
  h += '</div><div class="shopGroup"><div class="gt">İNŞA</div>';
  for (const id of ['wall', 'turret']) {
    const d = G.BUILD[id];
    h += '<div class="shopItem ' + (gold >= d.cost ? '' : 'no') + (placement === id ? ' can' : '') + '" data-place="' + id + '">' +
      '<div><div class="nm">' + d.name + '</div><div class="ds">' + (id === 'wall' ? 'Dayanıklı barikat · ' + d.hp + ' can' : 'Otomatik ateş · ' + d.damage + ' hasar') + '</div></div>' +
      '<div class="pr">$' + d.cost + '</div></div>';
  }
  h += '</div><div class="shopGroup"><div class="gt">DESTEK</div>';
  for (const id of ['medkit', 'wallrepair', 'baserepair']) {
    const d = G.SHOP[id];
    h += '<div class="shopItem ' + (gold >= d.cost ? '' : 'no') + '" data-buy="' + id + '">' +
      '<div><div class="nm">' + d.name + '</div><div class="ds">' +
      (id === 'medkit' ? '+' + d.heal + ' can' : id === 'wallrepair' ? 'En yakın duvara +' + d.heal : 'Üsse +' + d.heal + ' can') +
      '</div></div><div class="pr">$' + d.cost + '</div></div>';
  }
  h += '</div><div class="hint"><kbd>B</kbd> kapat · <kbd>Esc</kbd> iptal · inşa için marketten seç, yere tıkla</div>';
  shopEl.innerHTML = h;
}
shopEl.addEventListener('click', e => {
  const item = e.target.closest('[data-buy]');
  if (item) { sendMsg({ t: 'buy', item: item.dataset.buy }); return; }
  const pl = e.target.closest('[data-place]');
  if (pl) {
    const id = pl.dataset.place;
    if (gold >= G.BUILD[id].cost) {
      placement = placement === id ? null : id;
      closeShop();
      updateBuildHint();
      renderShopGhostCursor();
    }
  }
});
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
  $('goldVal').textContent = gold;
  $('waveVal').textContent = waveN;
  $('killVal').textContent = latest ? latest.P.reduce((n,p) => n + p.k,0) : 0;
  $('phaseLabel').textContent = phase === 'prep' ? 'HAZIRLIK' : 'SALDIRI';
  const bw = baseMax > 0 ? (baseHp / baseMax * 100) : 0;
  $('baseBar').style.width = bw + '%';
  $('baseBar').style.background = bw > 55 ? 'linear-gradient(90deg,#3fbf6f,#7be495)' : bw > 25 ? 'linear-gradient(90deg,#e0a93e,#ffd166)' : 'linear-gradient(90deg,#c92c3c,#ff7a6b)';
  $('baseTxt').textContent = baseHp + ' / ' + baseMax;

  if (phase === 'prep') {
    $('waveTimer').innerHTML = 'YENİ DALGA <b style="color:#ffd166">' + Math.ceil(phaseT) + 's</b>' + (hostId === myId ? ' · <span style="color:#55677e">boşluk: atla</span>' : '');
  } else {
    $('waveTimer').innerHTML = 'KALAN ZOMBİ: <b style="color:#ff7a6b">' + (latest ? latest.Z.length : 0) + '</b>';
  }

  const me = latest && latest.P.find(p => p.i === myId);
  const hp = me ? me.hp : 0, mh = me ? me.mh : 100;
  const hw = mh > 0 ? hp / mh * 100 : 0;
  $('hpBar').style.width = hw + '%';
  $('hpTxt').textContent = hp + ' / ' + mh;

  const w = G.WEAPONS[myWeapon] || G.WEAPONS.pistol;
  $('weapName').textContent = w.name;
  const am = $('ammoVal');
  if (myReload > 0) { am.innerHTML = 'ŞARJÖR…'; am.className = 'am low'; }
  else { am.innerHTML = myAmmo + '<small>/' + w.mag + '</small>'; am.className = 'am' + (myAmmo <= w.mag * 0.25 ? ' low' : ''); }

  const rh = $('reviveHint');
  if (myState === 'dead') rh.textContent = 'Ölüsün — dalganın başında dirileceksin';
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
  inGame = false;
  hudEl.classList.add('hidden');
  closeShop(); placement = null;
  SFX.over();
  showScreen(overEl);
  $('overWave').textContent = waveN + ' dalga dayandınız';
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
  if (!inGame) { return; }

  // input → local prediction
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const ml = Math.hypot(mx, my);
  if (ml > 0 && myState !== 'dead') {
    mx /= ml; my /= ml;
    const spd = G.PLAYER.speed * (myState === 'down' ? 0.35 : 1) * dt;
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
  if (fire) {
    const w = G.WEAPONS[myWeapon];
    if (now - lastShootSfx > (w ? w.rate * 1000 - 15 : 0)) SFX.shoot(myWeapon);
  }

  // shop hotkey
  if (keys.has('KeyB') && !keyLatchB) { keyLatchB = true; shopOpen ? closeShop() : openShop(); }
  if (!keys.has('KeyB')) keyLatchB = false;

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
  render(now);
}
let keyLatchB = false;

function blocked(x, y, r) {
  if (Math.hypot(x - G.BASE.x, y - G.BASE.y) < G.BASE.r + r) return true;
  for (const w of wallsLive) {
    if (w.k === 1) continue;
    if (circleRect(x, y, r, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) return true;
  }
  return false;
}

function updateParticles(dt) {
  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  particles = particles.filter(p => p.t < p.life);
}

/* ---------- rendering ---------- */
function lerpEntities(prevArr, nextArr, key) {
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

  const interpPlayers = lerpEntities(snapPrev, snapNext, 'P');
  const interpZombies = lerpEntities(snapPrev, snapNext, 'Z');

  for (const w of wallsLive) drawWall(w);

  for (const a of (latest ? latest.A : [])) {
    ctx.fillStyle = '#9dff6b';
    ctx.shadowColor = '#9dff6b'; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
  }

  const drawables = [];
  for (const z of interpZombies) drawables.push({ y: z.y, kind: 'z', e: z });
  for (const p of interpPlayers) drawables.push({ y: p.y, kind: 'p', e: p });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (d.kind === 'z') drawZombie(d.e, now);
    else drawPlayer(d.e, now);
  }

  // bullets
  const extrapol = G.clamp((now - snapNextAt) / 1000, 0, 0.08);
  if (latest) {
    for (const b of latest.B) {
      const sp = bulletSpeed(b.o);
      const bx = b.x + Math.cos(b.a) * sp * (extrapol - 0.09);
      const by = b.y + Math.sin(b.a) * sp * (extrapol - 0.09);
      const col = b.o === myId ? '#fff2b0' : b.o === -1 ? '#a8ffcf' : '#ffd98a';
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

function drawFloor() {
  const s = getScale();
  const x0 = cam.x - vw / 2 / s - 40, x1 = cam.x + vw / 2 / s + 40;
  const y0 = cam.y - vh / 2 / s - 40, y1 = cam.y + vh / 2 / s + 40;
  ctx.fillStyle = '#252c2b';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(70, 90, 120, .16)';
  ctx.lineWidth = 1;
  const g = 80;
  ctx.beginPath();
  for (let x = Math.floor(x0 / g) * g; x < x1; x += g) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = Math.floor(y0 / g) * g; y < y1; y += g) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  // Deterministic paving, road markings and perimeter lights.
  ctx.fillStyle = '#202728';
  ctx.fillRect(0, G.BASE.y - 135, G.WORLD.w, 270);
  ctx.fillRect(G.BASE.x - 135, 0, 270, G.WORLD.h);
  ctx.strokeStyle = '#b49b5c55'; ctx.lineWidth = 3; ctx.setLineDash([30, 35]);
  ctx.beginPath(); ctx.moveTo(0,G.BASE.y); ctx.lineTo(G.WORLD.w,G.BASE.y);
  ctx.moveTo(G.BASE.x,0);ctx.lineTo(G.BASE.x,G.WORLD.h);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<160;i++) {
    const x=(i*733+91)%G.WORLD.w,y=(i*397+63)%G.WORLD.h;
    ctx.fillStyle=i%3===0?'#53605635':'#0b111145';
    ctx.fillRect(x,y,3+i%8,2+i%5);
  }
  for(let x=80;x<G.WORLD.w;x+=160) {
    ctx.fillStyle='#f4c778';ctx.shadowColor='#ffb64c';ctx.shadowBlur=22;
    ctx.fillRect(x,18,8,5);ctx.fillRect(x,G.WORLD.h-23,8,5);
  }
  ctx.shadowBlur=0;
  // world bounds
  ctx.strokeStyle = 'rgba(255, 90, 90, .5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, G.WORLD.w, G.WORLD.h);
}

function drawBase(now) {
  const r = G.BASE.r;
  const frac = baseMax > 0 ? baseHp / baseMax : 0;
  ctx.save();
  ctx.translate(G.BASE.x, G.BASE.y);
  ctx.fillStyle = '#1b2431';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.strokeStyle = frac > 0.55 ? '#3fbf6f' : frac > 0.25 ? '#ffd166' : '#ff5a5a';
  ctx.lineWidth = 7;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, 7 * frac); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#2c3a4e'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, r - 3, 7 * frac, 7); ctx.stroke();
  ctx.strokeStyle='#71827a';ctx.lineWidth=2;ctx.strokeRect(-65,-65,130,130);
  ctx.fillStyle='#303f39';ctx.fillRect(-57,-57,114,114);
  for(let i=-48;i<=48;i+=24){ctx.fillStyle='#506057';ctx.fillRect(i,-53,8,106);}
  // core
  const pulse = 0.6 + Math.sin(now / 300) * 0.4;
  ctx.fillStyle = 'rgba(90, 200, 255,' + (0.35 + pulse * 0.3) + ')';
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
  ctx.fillStyle = '#0f151d';
  ctx.font = 'bold 17px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ÜS', 0, 1);
  ctx.restore();
}

function drawWall(w) {
  const x = w.x - w.w / 2, y = w.y - w.h / 2;
  const frac = w.mh > 0 ? w.hp / w.mh : 1;
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
    ctx.fillStyle = '#69d990';
    ctx.shadowColor = '#69d990'; ctx.shadowBlur = 8;
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
  // facing
  const prev = zFace.get(z.i);
  let ang = prev ? Math.atan2(z.y - prev.y, z.x - prev.x) : Math.PI / 2;
  if (prev && Math.hypot(z.x - prev.x, z.y - prev.y) < 0.4) ang = prev.a || ang;
  zFace.set(z.i, { x: z.x, y: z.y, a: ang });

  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(z.x, z.y + r * 0.5, r * 0.9, r * 0.42, 0, 0, 7); ctx.fill();

  if (base.boss) {
    ctx.strokeStyle = 'rgba(255, 77, 109, .55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(z.x, z.y, r + 7 + Math.sin(now / 200) * 3, 0, 7); ctx.stroke();
  }

  ctx.fillStyle = base.color;
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, 7); ctx.fill(); ctx.stroke();

  ctx.save();ctx.translate(z.x,z.y);ctx.rotate(ang);
  ctx.fillStyle=base.color;ctx.fillRect(1,-r*0.85,r*1.2,6);ctx.fillRect(1,r*0.5,r*1.2,6);
  ctx.fillStyle='#24352d';ctx.beginPath();ctx.arc(-3,0,r*.55,0,Math.PI*2);ctx.fill();ctx.restore();
  // eyes
  const ex = Math.cos(ang), ey = Math.sin(ang);
  const ex1 = z.x + ex * r * 0.45 - ey * r * 0.28, ey1 = z.y + ey * r * 0.45 + ex * r * 0.28;
  const ex2 = z.x + ex * r * 0.45 + ey * r * 0.28, ey2 = z.y + ey * r * 0.45 - ex * r * 0.28;
  ctx.fillStyle = base.boss ? '#ffe14d' : '#1a0d0d';
  ctx.beginPath(); ctx.arc(ex1, ey1, r * 0.16, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(ex2, ey2, r * 0.16, 0, 7); ctx.fill();

  if (z.hp < z.mh || base.boss) {
    const wdt = base.boss ? 76 : r * 2.2;
    ctx.fillStyle = '#10161f';
    ctx.fillRect(z.x - wdt / 2, z.y - r - 11, wdt, base.boss ? 7 : 5);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(z.x - wdt / 2, z.y - r - 11, wdt * Math.max(0, z.hp / z.mh), base.boss ? 7 : 5);
    if (base.boss) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText('BOSS', z.x, z.y - r - 16);
    }
  }
}

function drawPlayer(p, now) {
  const isMe = p.i === myId;
  const x = isMe ? pred.x : p.x, y = isMe ? pred.y : p.y;
  const R = G.PLAYER.r;

  if (p.s === 'dead') return;

  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x, y + R * 0.5, R * 0.95, R * 0.4, 0, 0, 7); ctx.fill();

  const down = p.s === 'down';
  const aim = isMe ? Math.atan2(mouseWorld().y - y, mouseWorld().x - x) : p.a;

  if (isMe) {
    ctx.strokeStyle='#8eecc6';ctx.lineWidth=2;ctx.shadowColor='#74ffd1';ctx.shadowBlur=12;
    ctx.beginPath();ctx.ellipse(x,y+8,R+11,(R+11)*0.6,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  }
  // gun
  ctx.strokeStyle = '#0c0f14'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(aim) * 4, y + Math.sin(aim) * 4);
  ctx.lineTo(x + Math.cos(aim) * (R + 12), y + Math.sin(aim) * (R + 12));
  ctx.stroke();

  ctx.fillStyle = down ? '#6b3a44' : p.c;
  ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(0,0,0,.6)';
  ctx.lineWidth = isMe ? 3 : 2;
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.stroke();

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

  // Helmet, shoulders and directional weapon silhouette.
  ctx.save();ctx.translate(x,y);ctx.rotate(aim);
  ctx.fillStyle=down?'#69434b':'#263d3e';ctx.fillRect(-9,-16,16,32);
  ctx.fillStyle='#d5b592';ctx.beginPath();ctx.arc(1,0,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=down?'#594248':'#788c72';ctx.beginPath();ctx.arc(-2,0,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111b20';ctx.fillRect(8,5,25,6);ctx.fillStyle='#9baaa8';ctx.fillRect(23,6,12,3);
  ctx.restore();
  // name + hp
  ctx.font = 'bold 12.5px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillText(p.n, x + 1, y - R - 21);
  ctx.fillStyle = isMe ? '#ffffff' : p.c;
  ctx.fillText(p.n, x, y - R - 22);
  if (p.hp < p.mh || down) {
    const wdt = 42;
    ctx.fillStyle = '#10161f';
    ctx.fillRect(x - wdt / 2, y - R - 17, wdt, 5);
    ctx.fillStyle = down ? '#ff5a5a' : '#3fbf6f';
    ctx.fillRect(x - wdt / 2, y - R - 17, wdt * G.clamp(p.hp / p.mh, 0, 1), 5);
  }

  if (isMe && myReload > 0) {
    const w = G.WEAPONS[myWeapon];
    const fr = 1 - myReload / w.reload;
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
  if (placement === 'turret') {
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
$('marketBtn').onclick = () => shopOpen ? closeShop() : openShop();
$('waveBtn').onclick = () => { if(hostId===myId && phase==='prep') sendMsg({t:'skip'}); };
$('muteBtn').onclick = () => { muted=!muted; $('muteBtn').textContent=muted?'SES KAPALI':'SES AÇIK'; };
$('nameInput').value = localStorage.getItem('zbd_name') || '';
$('createBtn').onclick = () => {
  const name = ($('nameInput').value || '').trim() || 'Kahraman';
  localStorage.setItem('zbd_name', name);
  $('createBtn').disabled = true;
  connect(name, true, '');
  setTimeout(() => { $('createBtn').disabled = false; }, 1200);
};
$('joinBtn').onclick = () => {
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
