'use strict';
const WebSocket = require('ws');
const url = process.env.TEST_URL || 'ws://localhost:3000';
const C = require('./public/game-core');
const results = [];
function log(name, ok, extra) { results.push({ name, ok, extra }); console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); }

function connect() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const inbox = [];
    ws.on('message', d => { try { inbox.push(JSON.parse(d)); } catch (e) {} });
    ws.on('open', () => res({ ws, inbox }));
    ws.on('error', rej);
    setTimeout(() => rej(new Error('connect timeout')), 5000);
  });
}
function waitFor(inbox, pred, ms) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const m = inbox.find(pred);
      if (m) { clearInterval(iv); res(m); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout waiting')); }
    }, 20);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lastSnap = inbox => inbox.filter(m => m.t === 's').pop();

(async () => {
  // 1. oda kur
  const a = await connect();
  a.ws.send(JSON.stringify({ t: 'join', name: 'Host', create: true }));
  const joined = await waitFor(a.inbox, m => m.t === 'joined', 3000);
  log('oda kurma', !!joined.code, 'kod=' + joined.code);
  const code = joined.code;

  // 2. yanlış kodla katılma -> hata
  const bad = await connect();
  bad.ws.send(JSON.stringify({ t: 'join', name: 'Kotu', create: false, code: 'XXXXX' }));
  const errM = await waitFor(bad.inbox, m => m.t === 'err', 3000);
  log('yanlış kod hatası', /bulunamad/.test(errM.m || ''), errM.m);
  bad.ws.close();

  // 3. toplam 5 oyuncu lobide (altın = 100+150*5 = 850)
  const bots = [];
  for (let i = 0; i < 4; i++) {
    const b = await connect();
    b.ws.send(JSON.stringify({ t: 'join', name: 'Bot' + (i + 1), create: false, code }));
    await waitFor(b.inbox, m => m.t === 'joined', 3000);
    bots.push(b);
  }
  const lobbyA = await waitFor(a.inbox, m => m.t === 'lobby' && m.players.length === 5, 3000);
  log('5 oyuncu lobide', lobbyA.players.length === 5, 'sayı=' + lobbyA.players.length);

  // 4. host başlat
  a.ws.send(JSON.stringify({ t: 'start' }));
  await waitFor(a.inbox, m => m.t === 'gs', 3000);
  const snap = await waitFor(a.inbox, m => m.t === 's', 5000);
  log('oyun başladı', snap.st === 'playing' && snap.p === 'prep', 'phase=' + snap.p + ' altın=' + snap.g);
  log('5 kişi başlangıç altını', snap.g === C.startingGold(5), 'g=' + snap.g);

  // 5. dalga 1
  a.ws.send(JSON.stringify({ t: 'skip' }));
  const waveSnap = await waitFor(a.inbox, m => m.t === 's' && m.w >= 1, 6000);
  log('dalga 1 başladı', waveSnap.w === 1 && waveSnap.p === 'wave', 'dalga=' + waveSnap.w);

  // 6. zombi ölçeklemesi: 5 oyuncu -> 55*(1+0.35*4)=132
  await sleep(4000);
  const zs5 = a.inbox.filter(m => m.t === 's' && m.Z.length > 0).pop();
  const w5 = zs5 && zs5.Z.find(z => z.t === 'walker');
  log('zombi doğdu', !!(zs5 && zs5.Z.length), 'zs=' + (zs5 ? zs5.Z.length : 0));
  log('5 kişi zombi canı ölçeği', w5 && w5.mh === Math.round(55 * 2.4), w5 ? 'mh=' + w5.mh + ' beklenen=132' : 'walker yok');

  // 7. satın almalar (altın 850)
  a.ws.send(JSON.stringify({ t: 'buy', item: 'smg' }));
  await sleep(250);
  let s = lastSnap(a.inbox);
  const hostP = () => s.P.find(p => p.n === 'Host');
  log('SMG satın alındı', hostP().w === 'smg', 'silah=' + hostP().w);

  const g0 = s.g;
  a.ws.send(JSON.stringify({ t: 'build', k: 'wall', x: 1400, y: 640 }));
  await sleep(250);
  s = lastSnap(a.inbox);
  log('duvar inşa edildi', s.L.length >= 1, 'duvar=' + s.L.length);
  log('duvar altını düşürdü', s.g === g0 - 50, g0 + '→' + s.g);

  const g1 = s.g;
  a.ws.send(JSON.stringify({ t: 'build', k: 'turret', x: 1500, y: 800 }));
  await sleep(250);
  s = lastSnap(a.inbox);
  const turret = s.L.find(l => l.k === 1);
  log('taret inşa edildi', !!turret, turret ? 'taret hp=' + turret.hp : 'yok');
  log('taret altını düşürdü', s.g === g1 - 350, g1 + '→' + s.g);

  // 8. taret otomatik atış
  const turretShot = await waitFor(a.inbox, m => m.t === 's' && m.B.some(b => b.o === -1), 20000).catch(() => null);
  log('taret otomatik atış', !!turretShot);

  // 9. ateş → mermi
  a.ws.send(JSON.stringify({ t: 'in', mx: 0, my: 0, a: 0.5, f: true, r: false }));
  await sleep(100);
  a.ws.send(JSON.stringify({ t: 'in', mx: 0, my: 0, a: 0.5, f: false, r: false }));
  const bulletSnap = await waitFor(a.inbox, m => m.t === 's' && m.B.some(b => b.o === joined.id), 3000).catch(() => null);
  log('ateş → mermi', !!bulletSnap);

  // 10. skor verisi
  s = lastSnap(a.inbox);
  log('skor verisi (kills)', s.P.every(p => typeof p.k === 'number'), 'oyuncular=' + s.P.length);

  // 11. oyuncu ayrılır → ölçek düşer (5→4: 55*(1+0.35*3)=113)
  bots[3].ws.close();
  const lobby2 = await waitFor(a.inbox, m => m.t === 'lobby' && m.players.length === 4, 3000).catch(() => null);
  log('ayrılınca lobby güncellendi', !!lobby2);
  await sleep(900);
  const zs4 = a.inbox.filter(m => m.t === 's' && m.Z.length > 0).pop();
  const w4 = zs4 && zs4.Z.find(z => z.t === 'walker');
  log('ayrılınca ölçek düştü', w4 && w4.mh === Math.round(55 * 2.05), w4 ? 'mh=' + w4.mh + ' beklenen=113' : 'walker yok');

  // 12. oyuncu katılır → ölçek artar (4→5: 132)
  const extra = await connect();
  extra.ws.send(JSON.stringify({ t: 'join', name: 'Donuscu', create: false, code }));
  await waitFor(extra.inbox, m => m.t === 'joined', 3000);
  await sleep(900);
  const zsBack = a.inbox.filter(m => m.t === 's' && m.Z.length > 0).pop();
  const wBack = zsBack && zsBack.Z.find(z => z.t === 'walker');
  log('yeni oyuncu girince ölçek arttı', wBack && wBack.mh === Math.round(55 * 2.4), wBack ? 'mh=' + wBack.mh + ' beklenen=132' : 'walker yok');

  a.ws.close(); extra.ws.close();
  bots.forEach(b => b.ws.close());
  const fails = results.filter(r => !r.ok);
  console.log('\nSONUÇ: ' + (results.length - fails.length) + '/' + results.length + ' geçti');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('TEST HATASI:', e.message); process.exit(1); });
