'use strict';
// Deterministik birim testleri: server.js'i doğrudan require eder, HTTP/WS başlatmaz.
const path = require('path');
const { Room, tickTimer } = require('./server.js');
const C = require('./public/game-core.js');

const results = [];
function log(name, ok, extra) { results.push({ ok }); console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); }

function fakeWs() {
  return { readyState: 1, sent: [], send(s) { this.sent.push(JSON.parse(s)); }, close() { this.readyState = 3; } };
}
function makeRoom(nPlayers) {
  const room = new Room('TEST1');
  const list = [];
  for (let i = 0; i < nPlayers; i++) list.push(room.addPlayer(fakeWs(), 'P' + (i + 1), '#fff'));
  return { room, list };
}

// 1. ölçekleme matematiği
{
  const s1 = C.scaleZombie('walker', 1, 1);
  const s2 = C.scaleZombie('walker', 1, 5);
  const s8 = C.scaleZombie('walker', 1, 8);
  log('ölçek 1 kişi', s1.hp === 55 && s1.dmg === 9, 'hp=' + s1.hp);
  log('ölçek 5 kişi hp', s2.hp === Math.round(55 * 2.4), 'hp=' + s2.hp);
  log('ölçek 8 kişi hp', s8.hp === Math.round(55 * (1 + 0.35 * 7)), 'hp=' + s8.hp);
  log('ölçek 8 kişi dmg', s8.dmg === +(9 * (1 + 0.35 * 7)).toFixed(1), 'dmg=' + s8.dmg);
  const w10 = C.scaleZombie('walker', 10, 1);
  log('dalga ölçeği', w10.hp === Math.round(55 * (1 + 9 * 0.17)), 'hp=' + w10.hp);
  const boss = C.scaleZombie('boss', 5, 4);
  log('boss ölçeği', boss.hp === Math.round(2200 * (1 + 4 * 0.17) * (1 + 0.35 * 3)), 'hp=' + boss.hp);
}

// 2. dalga kompozisyonu
{
  const w1 = C.waveComp(1);
  log('dalga 1: sadece yürüyen', w1.every(t => t === 'walker'), 'içerik=' + [...new Set(w1)].join(','));
  const w2 = C.waveComp(2);
  log('dalga 2: koşucu var', w2.includes('runner'), 'koşucu=' + w2.filter(t => t === 'runner').length);
  const w4 = C.waveComp(4);
  log('dalga 4: tükürükcü var', w4.includes('spitter'));
  const w5 = C.waveComp(5);
  log('dalga 5: boss başta', w5.includes('boss') && w5[0] === 'boss', 'ilk=' + w5[0]);
  const w6 = C.waveComp(6);
  log('dalga 6: güçlü (brute) başlar', w6.includes('brute'));
  log('dalga 6: boss yok', !C.waveComp(6).includes('boss'));
  log('dalga artan zorluk', w1.length < C.waveComp(8).length, w1.length + '→' + C.waveComp(8).length);
}

// 3. oda: katıl/ayrıl + rescale
{
  const { room, list } = makeRoom(1);
  room.start();
  room.wave = 1;
  room.phase = 'wave';
  room.queue = ['walker']; room.spawnZombie(); // walker
  let z = room.zombies[0];
  log('1 kişi zombi doğdu', z && z.hp === 55, z ? 'hp=' + z.hp : 'yok');
  const p2 = room.addPlayer(fakeWs(), 'P2', '#0f0');
  z = room.zombies[0];
  log('katılınca can arttı', z.hp === Math.round(55 * 1.35), 'hp=' + z.hp);
  log('katılınca hasar arttı', z.dmg === +(9 * 1.35).toFixed(1), 'dmg=' + z.dmg);
  const p3 = room.addPlayer(fakeWs(), 'P3', '#00f');
  z = room.zombies[0];
  log('3. katılınca tekrar arttı', z.hp === Math.round(55 * 1.7), 'hp=' + z.hp);
  // mevcut can oranı korunmalı
  z.hp = Math.round(z.maxHp / 2);
  const frac = z.hp / z.maxHp;
  room.removePlayer(p3.id);
  z = room.zombies[0];
  log('ayrılınca oran korunur', z.maxHp === Math.round(55 * 1.35) && z.hp === Math.round(z.maxHp / 2), 'hp=' + z.hp + '/' + z.maxHp);
  room.removePlayer(p2.id);
  log('tek kalınca başa döndü', room.zombies[0].maxHp === 55 && room.zombies[0].hp === Math.max(1, Math.round(frac * 55)), 'hp=' + room.zombies[0].hp + '/' + room.zombies[0].maxHp);
}

// 4. zombi melee: oyuncuya yakın → vurur
{
  const { room, list } = makeRoom(1);
  room.start();
  room.phase = 'wave';
  room.queue = ['walker']; room.spawnZombie();
  const p = list[0], z = room.zombies[0];
  z.x = p.x + 30; z.y = p.y; z.atk = 0; z.aggro = 0; z.range = 0;
  room.update(0.1);
  log('zombi oyuncuya vurdu', p.hp < p.maxHp, 'hp=' + p.hp + '/' + p.maxHp);
  const hpAfter = p.hp;
  room.update(0.1);
  log('attack cooldown çalışıyor', Math.abs(p.hp - (hpAfter + C.PLAYER.regen * 0.1)) < 0.011, 'hp=' + p.hp);
  z.atk = 0;
  room.update(0.1);
  log('cooldown sonra tekrar vurdu', p.hp < hpAfter, 'hp=' + p.hp);
}

// 5. zombi üssü hedefler ve vurur
{
  const { room, list } = makeRoom(1);
  room.start();
  room.phase = 'wave';
  room.queue = ['walker']; room.spawnZombie();
  const z = room.zombies[0];
  list[0].x = 100; list[0].y = 100; // oyuncu uzakta
  z.x = room.base.x + room.base.r + 10; z.y = room.base.y; z.atk = 0; z.range = 0;
  room.update(0.1);
  log('zombi üssü vurdu', room.base.hp < room.base.maxHp, 'üs=' + room.base.hp);
}

// 6. zombi duvarı hedefler ve yıkarsa olay üretir
{
  const { room, list } = makeRoom(1);
  room.start();
  room.gold = 500;
  const ok = room.build('wall', room.base.x + 250, room.base.y, list[0].id);
  log('duvar inşa edildi', ok && room.walls.length === 1);
  const wall = room.walls[0];
  room.phase = 'wave';
  room.queue = ['walker']; room.spawnZombie();
  const z = room.zombies[0];
  // zombiyi duvarın dışına, üs yönüne yerleştir
  z.x = wall.x + 70; z.y = wall.y; z.atk = 0; z.range = 0;
  list[0].x = 100; list[0].y = 100;
  const hp0 = wall.hp;
  for (let i = 0; i < 60 && wall.hp === hp0; i++) room.update(0.1);
  log('zombi duvara vurdu', wall.hp < hp0, 'duvar=' + wall.hp);
  // bitişik other yapıyla çakışma kontrolü
  const g0 = room.gold;
  const ok2 = room.build('wall', wall.x + 10, wall.y + 10, list[0].id);
  log('çakışan duvar reddedildi', !ok2 && room.gold === g0);
  const ok3 = room.build('wall', room.base.x, room.base.y, list[0].id);
  log('üzerine inşa reddedildi', !ok3);
}

// 7. inşa menzili/maliyet
{
  const { room, list } = makeRoom(1);
  room.start();
  room.gold = 40;
  log('yetersiz altınla inşa reddi', !room.build('wall', 100, 100, list[0].id) && room.gold === 40);
  room.gold = 100;
  log('dünya dışına inşa reddi', !room.build('wall', -50, 100, list[0].id) && room.gold === 100);
  log('geçerli inşa kabul', room.build('wall', 700, 500, list[0].id) && room.gold === 50);
}

// 8. taret: menzildeki zombiye otomatik atış
{
  const { room, list } = makeRoom(1);
  room.start();
  room.gold = 1000;
  room.build('turret', room.base.x + 300, room.base.y, list[0].id);
  room.phase = 'wave';
  room.queue = ['walker']; room.spawnZombie();
  const z = room.zombies[0];
  z.x = room.base.x + 300 + 200; z.y = room.base.y; z.hp = 10000; z.maxHp = 10000;
  list[0].x = 100; list[0].y = 100;
  let fired = false;
  for (let i = 0; i < 60 && !fired; i++) {
    room.update(0.1);
    if (room.bullets.some(b => b.owner === -1)) fired = true;
  }
  log('taret otomatik atış yaptı', fired);
  // menzil dışı: taret atmasın
  room.bullets = [];
  z.x = room.base.x + 300 + 900;
  room.walls[0].turretT = 0;
  let fired2 = false;
  for (let i = 0; i < 30; i++) {
    room.update(0.1);
    if (room.bullets.some(b => b.owner === -1)) fired2 = true;
  }
  log('taret menzil dışına atmadı', !fired2);
}

// 9. market
{
  const { room, list } = makeRoom(2);
  room.start();
  const p = list[0];
  room.gold = 0;
  log('altınsız silah reddi', !room.buy('smg', p.id) && !p.owned.includes('smg'));
  room.gold = 400;
  log('SMG alındı', room.buy('smg', p.id) && p.owned.includes('smg') && p.weapon === 'smg' && room.gold === 0);
  log('tekrar alma ücretsiz envantere', room.buy('smg', p.id) && room.gold === 0);
  room.gold = 120;
  p.hp = 50;
  log('medkit aldı', room.buy('medkit', p.id) && p.hp === p.maxHp && room.gold === 0, 'hp=' + p.hp);
  p.hp = p.maxHp;
  room.gold = 120;
  log('tam canda medkit reddi', !room.buy('medkit', p.id) && room.gold === 120);
  room.gold = 200;
  room.base.hp = 1000;
  log('üs tamiri', room.buy('baserepair', p.id) && room.base.hp === 1450 && room.gold === 0);
  room.gold = 200;
  room.build('wall', 700, 500, p.id);
  room.gold = 80;
  const w = room.walls[0];
  w.hp = 10;
  p.x = w.x; p.y = w.y;
  log('duvar tamiri', room.buy('wallrepair', p.id) && w.hp === 150, 'duvar=' + w.hp);
}

// 10. dalga akışı: prep → wave → tümü ölünce → prep + bonus
{
  const { room, list } = makeRoom(1);
  room.start();
  log('başlangıç prep', room.phase === 'prep' && room.timer === 12);
  log('başlangıç altın', room.gold === 250, 'g=' + room.gold);
  room.timer = 0.01;
  room.update(0.1);
  log('dalga 1 başladı', room.phase === 'wave' && room.wave === 1 && room.queue.length > 0);
  let guard = 0;
  while (room.queue.length && guard++ < 1000) room.spawnZombie();
  log('tüm zombiler doğdu', room.zombies.length > 0 && room.queue.length === 0, 'z=' + room.zombies.length);
  const g0 = room.gold;
  room.zombies = [];
  room.update(0.1);
  log('dalga temiz → bonus + prep', room.phase === 'prep' && room.gold === g0 + C.waveBonus(1), 'bonus=' + C.waveBonus(1));
  room.timer = 0.01;
  room.update(0.1);
  log('dalga 2 başladı', room.wave === 2 && room.phase === 'wave');
}

// 11. canlanma: yere düşme, kurtarma, kanama
{
  const { room, list } = makeRoom(2);
  room.start();
  const a = list[0], b = list[1];
  a.x = 1000; a.y = 1000; b.x = 1000; b.y = 1000;
  room.damagePlayer(a, 150);
  log('aşırı hasar → yere düştü', a.state === 'down' && a.bleed === C.PLAYER.downBleed);
  room.phase = 'wave'; room.queue = []; room.zombies = [];
  // kurtarıcı yakında: ilerleme
  let t = 0;
  while (t < 3.5) { room.update(0.1); t += 0.1; if (a.state === 'alive') break; }
  log('yanında bekleyince canlandı', a.state === 'alive' && a.hp > 0, 'hp=' + a.hp);
  // kanama: uzakta tek başına
  room.damagePlayer(a, 150);
  b.x = 2000; b.y = 2000;
  t = 0;
  while (t < 13 && a.state !== 'dead') { room.update(0.1); t += 0.1; }
  log('kurtarıcı yoksa kanayıp öldü', a.state === 'dead', 't=' + t.toFixed(1));
  log('ölü oyuncu vurulamaz', (room.damagePlayer(a, 50), a.state === 'dead'));
}

// 12. ölüm → dalga başında dirilme
{
  const { room, list } = makeRoom(1);
  room.start();
  const p = list[0];
  room.phase = 'wave'; room.queue = []; room.zombies = [];
  room.damagePlayer(p, 200);
  p.bleed = 0.05;
  room.update(0.1);
  log('öldü', p.state === 'dead', 'state=' + p.state);
  room.spawnWave();
  log('yeni dalgada dirildi', p.state === 'alive' && p.hp === p.maxHp, 'dalga=' + room.wave);
}

// 13. oyun sonu: üs düşerse over + istatistik
{
  const { room, list } = makeRoom(3);
  room.start();
  room.base.hp = 0;
  room.phase = 'wave'; room.queue = []; room.zombies = [];
  room.damagePlayer(list[0], 200); // biri yere düşsün, stats'ta yer alsın
  room.update(0.1);
  const ws = list[1].ws;
  const overMsg = ws.sent.find(m => m.t === 'over');
  log('üs düşünce over mesajı', room.state === 'over' && !!overMsg);
  log('over stats 3 kişi', overMsg && overMsg.stats.length === 3, overMsg ? 'n=' + overMsg.stats.length : '');
  log('over host alanı', overMsg && typeof overMsg.host === 'number');
  // host yeniden başlatabilmeli
  room.start();
  log('host restart → playing', room.state === 'playing' && room.base.hp === room.base.maxHp && room.wave === 0);
}

// 14. şarjör: boşalınca otomatik reload
{
  const { room, list } = makeRoom(1);
  room.start();
  const p = list[0];
  p.ammo = 1; p.fire = true; p.firedLatch = false; p.fireT = 0; p.aim = 0;
  room.update(0.1);
  log('son mermi ateşlendi', p.ammo === 0 && p.reloadT > 0, 'reload=' + p.reloadT.toFixed(2));
  const bCount = room.bullets.length;
  log('mermi oluştu', bCount === 1, 'b=' + bCount);
  p.fire = false;
  t2(room, p);
  log('reload sonrası dolu', p.ammo === C.WEAPONS.pistol.mag, 'ammo=' + p.ammo);
  function t2(r, pl) {
    let t = 0;
    while (pl.reloadT > 0 && t < 3) { r.update(0.1); t += 0.1; }
  }
}

// 15. çevrimiçi oyuncu limiti
{
  const { room, list } = makeRoom(8);
  log('8 kişi eklenebildi', room.players.size === 8);
  const fake = fakeWs();
  let refused = false;
  // join mantığı ws katmanında; burada addPlayer sonrası kontrol yerine MAX_PLAYERS sabiti
  log('MAX_PLAYERS=8', C.MAX_PLAYERS === 8);
}

clearInterval(tickTimer);
const fails = results.filter(r => !r.ok).length;
console.log('\nSONUÇ: ' + (results.length - fails) + '/' + results.length + ' geçti');
process.exit(fails ? 1 : 0);
