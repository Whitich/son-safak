(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WORLD = { w: 2400, h: 1600 };
  const BASE = { x: WORLD.w / 2, y: WORLD.h / 2, r: 68, hp: 3000 };

  const PLAYER = {
    r: 16,
    hp: 100,
    speed: 190,
    regen: 2,
    downBleed: 12,
    reviveTime: 3,
    startMoney: 150
  };

  const WEAPONS = {
    pistol: {
      name: 'Tabanca', cost: 0, damage: 14, rate: 0.30, speed: 780, spread: 0.035,
      pellets: 1, mag: 14, reload: 1.1, range: 620, pierce: 0, auto: false, color: '#ffd166'
    },
    smg: {
      name: 'SMG', cost: 400, damage: 9, rate: 0.085, speed: 840, spread: 0.09,
      pellets: 1, mag: 32, reload: 1.5, range: 560, pierce: 0, auto: true, color: '#8ecaff'
    },
    shotgun: {
      name: 'Pompalı', cost: 750, damage: 9, rate: 0.75, speed: 700, spread: 0.28,
      pellets: 7, mag: 6, reload: 2.0, range: 330, pierce: 1, auto: false, color: '#ff9d68'
    },
    rifle: {
      name: 'Nişancı Tüfeği', cost: 1400, damage: 42, rate: 0.55, speed: 1150, spread: 0.012,
      pellets: 1, mag: 12, reload: 1.9, range: 950, pierce: 2, auto: false, color: '#bd87ff'
    },
    lmg: {
      name: 'LMG', cost: 2600, damage: 15, rate: 0.06, speed: 900, spread: 0.11,
      pellets: 1, mag: 80, reload: 3.0, range: 640, pierce: 1, auto: true, color: '#69d990'
    }
  };
  const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'lmg'];

  const ZOMBIES = {
    walker: {
      name: 'Yürüyen', hp: 55, dmg: 9, speed: 52, r: 15, money: 12, attackCd: 0.9, color: '#7bc47f'
    },
    runner: {
      name: 'Koşucu', hp: 34, dmg: 7, speed: 125, r: 12, money: 15, attackCd: 0.7, color: '#e8e26b'
    },
    spitter: {
      name: 'Tükürükcü', hp: 48, dmg: 12, speed: 44, r: 14, money: 22, attackCd: 1.6, range: 300, color: '#9d7bff'
    },
    brute: {
      name: 'Güçlü', hp: 240, dmg: 26, speed: 36, r: 24, money: 55, attackCd: 1.2, color: '#ff7a6b'
    },
    boss: {
      name: 'BOSS', hp: 1400, dmg: 35, speed: 33, r: 40, money: 400, attackCd: 1.0, color: '#ff4d6d',
      boss: true, scaleUp: true
    }
  };

  const PLAYER_SCALE_STEP = 0.35;
  const MAX_PLAYERS = 8;
  const INTERMISSION = 30;

  function playerScale(n) {
    return 1 + PLAYER_SCALE_STEP * Math.max(0, n - 1);
  }

  function scaleZombie(type, wave, playerCount) {
    const base = ZOMBIES[type];
    const hpMul = (1 + (wave - 1) * 0.17) * playerScale(playerCount);
    const dmgMul = (1 + (wave - 1) * 0.09) * (1+.08*Math.max(0,playerCount-1));
    const out = {
      type,
      name: base.name,
      hp: Math.round(base.hp * hpMul),
      dmg: +(base.dmg * dmgMul).toFixed(1),
      speed: base.speed * (type === 'boss' ? 1 : Math.min(1.25, 1 + wave * 0.008)),
      r: base.r,
      money: base.money,
      attackCd: base.attackCd,
      color: base.color,
      boss: !!base.boss
    };
    if (base.range) out.range = base.range;
    return out;
  }

  function waveComp(wave) {
    const list = [];
    const walkers = 4 + Math.floor(wave * 1.8);
    const runners = wave >= 2 ? Math.floor(wave * 0.9) : 0;
    const spitters = wave >= 4 ? Math.floor((wave - 2) * 0.5) : 0;
    const brutes = wave >= 5 ? Math.floor((wave - 3) * 0.35) : 0;
    if(wave>=3) for(let j=0;j<Math.floor(wave*.75);j++) list.push('swarm');
    if(wave>=4) for(let j=0;j<Math.floor((wave-2)*.6);j++) list.push('armored');
    if(wave>=6) for(let j=0;j<Math.floor((wave-3)*.5);j++) list.push('sapper');
    if(wave>=7) for(let j=0;j<Math.floor((wave-5)*.4);j++) list.push('healer');
    if(wave>=8) for(let j=0;j<Math.floor((wave-5)*.5);j++) list.push('berserker');
    if(wave%4===0) for(let j=0;j<Math.floor(wave*1.2);j++) list.push('runner');
    let i;
    for (i = 0; i < walkers; i++) list.push('walker');
    for (i = 0; i < runners; i++) list.push('runner');
    for (i = 0; i < spitters; i++) list.push('spitter');
    for (i = 0; i < brutes; i++) list.push('brute');
    if (wave % 5 === 0) list.push('boss');
    for (let j = list.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [list[j], list[k]] = [list[k], list[j]];
    }
    if (wave % 5 === 0) {
      const bi = list.indexOf('boss');
      if (bi >= 0) { list.splice(bi, 1); list.unshift('boss'); }
    }
    return list;
  }

  function waveSpawnInterval(wave) {
    return Math.max(0.35, 1.05 - wave * 0.04);
  }

  function waveBonus(wave) {
    return 100 + wave * 30;
  }

  const BUILD = {
    wall: { name: 'Duvar', cost: 50, hp: 240, w: 54, h: 54 },
    turret: { name: 'Taret', cost: 350, hp: 300, w: 46, h: 46, range: 340, rate: 0.55, damage: 26, bulletSpeed: 700 }
  };

  const SHOP = {
    medkit: { name: 'Medkit', cost: 120, heal: 60 },
    ammo: { name: 'Mermi Doldur', cost: 60 },
    wallrepair: { name: 'Duvar Tamiri', cost: 80, heal: 140 },
    baserepair: { name: 'Üs Tamiri', cost: 200, heal: 450 }
  };

  WEAPONS.pistol.desc = 'Güvenilir başlangıç silahı · basılı tutarak ateş';
  WEAPONS.pistol.auto = true;
  WEAPONS.shotgun.damage=14; WEAPONS.shotgun.cost=650; WEAPONS.shotgun.auto=true;
  WEAPONS.rifle.damage=80; WEAPONS.rifle.cost=1200; WEAPONS.rifle.auto=true;
  WEAPONS.lmg.cost=1800; WEAPONS.lmg.damage=18;
  WEAPONS.smg.desc = 'Yakın mesafede hızlı sürü temizliği';
  WEAPONS.shotgun.desc = 'Yakında 7 saçma · kalabalık kontrolü';
  WEAPONS.rifle.desc = 'Uzun menzil · 3 hedef delme';
  WEAPONS.lmg.desc = '80 mermi · uzun süreli baskı ateşi';
  Object.assign(WEAPONS, {
    revolver:{name:'Magnum',cost:260,damage:44,rate:.48,speed:1050,spread:.018,pellets:1,mag:6,reload:1.5,range:730,pierce:1,auto:true,color:'#ffc885',desc:'Zırhı delen ağır tabanca',armorPierce:true},
    carbine:{name:'Taarruz Tüfeği',cost:850,damage:24,rate:.14,speed:1050,spread:.035,pellets:1,mag:30,reload:1.7,range:760,pierce:0,auto:true,color:'#87d9ca',desc:'Orta menzil · isabetli otomatik ateş'},
    frost:{name:'Kriyo Tüfeği',cost:1100,damage:17,rate:.18,speed:820,spread:.04,pellets:1,mag:24,reload:1.8,range:650,pierce:0,auto:true,color:'#8fe8ff',slow:2.5,desc:'Vurduğu zombiyi %50 yavaşlatır'},
    launcher:{name:'Bomba Atar',cost:1900,damage:105,rate:1.1,speed:540,spread:.02,pellets:1,mag:4,reload:2.6,range:720,pierce:0,auto:true,color:'#ffb76b',splash:100,desc:'100 birim patlama · dostlara zarar vermez'}
  });
  WEAPON_ORDER.splice(1,0,'revolver'); WEAPON_ORDER.splice(3,0,'carbine'); WEAPON_ORDER.push('frost','launcher');
  Object.assign(ZOMBIES, {
    swarm:{name:'Sürücü',hp:23,dmg:5,speed:110,r:9,money:10,attackCd:.55,color:'#b4cd7c'},
    armored:{name:'Zırhlı',hp:145,dmg:15,speed:43,r:20,money:34,attackCd:1,color:'#829eb4',armor:.45},
    sapper:{name:'Yıkıcı',hp:100,dmg:18,speed:68,r:17,money:30,attackCd:1.1,color:'#e5a55e',siege:3},
    healer:{name:'Şifacı',hp:125,dmg:8,speed:45,r:18,money:45,attackCd:1.3,color:'#62dbbd',healAura:18},
    berserker:{name:'Öfkeli',hp:180,dmg:22,speed:72,r:21,money:45,attackCd:.8,color:'#d36b9c',rage:true}
  });
  BUILD.wall.desc='Mermilerin üzerinden geçer · zombileri durdurur';
  BUILD.wall.solid=true;
  BUILD.turret.desc='340 menzil · otomatik hedefleme';
  BUILD.turret.turret=true;
  Object.assign(BUILD, {
    reinforced:{name:'Çelik Barikat',cost:110,hp:700,w:54,h:54,solid:true,desc:'700 can · uzun savunmalar için'},
    gate:{name:'Geçiş Kapısı',cost:85,hp:300,w:54,h:54,desc:'Oyuncular geçer · zombiler geçemez'},
    spikes:{name:'Dikenli Tel',cost:65,hp:180,w:64,h:64,trap:true,slow:.5,dps:14,desc:'Geçen zombiyi %50 yavaşlatır ve yaralar'},
    mine:{name:'Yakınlık Mayını',cost:90,hp:1,w:32,h:32,trap:true,splash:110,damage:220,desc:'Yaklaşan sürüye 220 alan hasarı · tek kullanım'},
    sniperTurret:{name:'Keskin Taret',cost:700,hp:260,w:46,h:46,turret:true,range:620,rate:1.15,damage:95,bulletSpeed:1200,pierce:2,armorPierce:true,desc:'Uzun menzil · zırh delici · 3 hedef'},
    frostTurret:{name:'Kriyo Taret',cost:500,hp:260,w:46,h:46,turret:true,range:290,rate:.45,damage:12,bulletSpeed:700,slow:2.5,desc:'Yaklaşanları %50 yavaşlatır'}
  });
  SHOP.medkit.cost=45;
  SHOP.wallrepair.cost=15; SHOP.wallrepair.heal=160; SHOP.wallrepair.name='Yapı Tamiri';
  SHOP.baserepair.cost=100; SHOP.ammo.cost=20;
  const UPGRADES={
    vitality:{name:'Dayanıklılık',cost:180,max:4,desc:'Her seviye +25 maksimum can'},
    mobility:{name:'Hafif Ekipman',cost:200,max:3,desc:'Her seviye +%8 hareket hızı'},
    power:{name:'Güçlendirilmiş Mermi',cost:250,max:5,desc:'Tüm silahlarda seviye başına +%10 hasar'},
    handling:{name:'Hızlı Şarjör',cost:180,max:3,desc:'Seviye başına %10 daha kısa doldurma'}
  };
  function nightInfo(n){return {name:n%5===0?'DEV AVCISI':n%4===0?'KOŞUCU AKINI':n>=8?'MUTASYON':n>=4?'KUŞATMA':'İLK TEMAS',boss:n%5===0,types:[...new Set(waveComp(n))].sort()};}
  const startingGold=n=>550+200*Math.max(0,n-1);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function roomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function spawnEdgePoint() {
    const side = Math.floor(Math.random() * 4);
    const m = 60;
    if (side === 0) return { x: rand(m, WORLD.w - m), y: m };
    if (side === 1) return { x: rand(m, WORLD.w - m), y: WORLD.h - m };
    if (side === 2) return { x: m, y: rand(m, WORLD.h - m) };
    return { x: WORLD.w - m, y: rand(m, WORLD.h - m) };
  }

  return {
    WORLD, BASE, PLAYER, WEAPONS, WEAPON_ORDER, ZOMBIES, BUILD, SHOP, UPGRADES, nightInfo, startingGold,
    MAX_PLAYERS, INTERMISSION, PLAYER_SCALE_STEP,
    playerScale, scaleZombie, waveComp, waveSpawnInterval, waveBonus,
    dist, clamp, rand, roomCode, spawnEdgePoint
  };
});
