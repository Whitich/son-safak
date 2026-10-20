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
      name: 'Tükürükçü', hp: 48, dmg: 12, speed: 44, r: 14, money: 22, attackCd: 1.6, range: 300, color: '#9d7bff'
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
    const hpMul = (1 + (wave - 1) * 0.17 + Math.pow(Math.max(0,wave-10),2)*.028) * playerScale(playerCount);
    const dmgMul = (1 + (wave - 1) * 0.09 + Math.pow(Math.max(0,wave-12),2)*.012) * (1+.08*Math.max(0,playerCount-1));
    const out = {
      type,
      name: base.name,
      hp: Math.round(base.hp * hpMul),
      dmg: +(base.dmg * dmgMul).toFixed(1),
      speed: base.speed * Math.min(1.55, 1 + wave * 0.012),
      r: base.r,
      money: base.money,
      attackCd: base.attackCd / Math.min(1.8,1+Math.max(0,wave-6)*.025),
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
    if(wave>=7) for(let j=0;j<Math.max(1,Math.floor((wave-5)*.4));j++) list.push('healer');
    if(wave>=8) for(let j=0;j<Math.floor((wave-5)*.5);j++) list.push('berserker');
    if(wave>=10) for(let j=0;j<1+Math.floor((wave-10)*.25);j++) list.push('mortar');
    if(wave>=12) for(let j=0;j<1+Math.floor((wave-12)*.2);j++) list.push('disruptor');
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
    return Math.max(0.18, 1.05 - wave * 0.035);
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
    frost:{name:'Kriyo Tüfeği',cost:1100,damage:17,rate:.18,speed:820,spread:.04,pellets:1,mag:24,reload:1.8,range:650,pierce:0,auto:true,color:'#8fe8ff',slow:2.5,desc:'Zombileri yavaşlatır; geç gecelerde etkisine direnç gelişir'},
    launcher:{name:'Bomba Atar',cost:1900,damage:105,rate:1.1,speed:540,spread:.02,pellets:1,mag:4,reload:2.6,range:720,pierce:0,auto:true,color:'#ffb76b',splash:100,desc:'100 birim patlama · dostlara zarar vermez'}
  });
  WEAPON_ORDER.splice(1,0,'revolver'); WEAPON_ORDER.splice(3,0,'carbine'); WEAPON_ORDER.push('frost','launcher');
  Object.assign(ZOMBIES, {
    swarm:{name:'Sürücü',hp:23,dmg:5,speed:110,r:9,money:10,attackCd:.55,color:'#b4cd7c'},
    armored:{name:'Zırhlı',hp:145,dmg:15,speed:43,r:20,money:34,attackCd:1,color:'#829eb4',armor:.45},
    sapper:{name:'Yıkıcı',hp:100,dmg:18,speed:68,r:17,money:30,attackCd:1.1,color:'#e5a55e',siege:3},
    healer:{name:'Şifacı',hp:125,dmg:8,speed:45,r:18,money:45,attackCd:1.3,color:'#62dbbd',healAura:18},
    mortar:{name:'Kuşatmacı',hp:170,dmg:24,speed:39,r:19,money:50,attackCd:3.5,range:510,color:'#e5a879',siege:2.2,artillery:true},
    disruptor:{name:'Bozucu',hp:220,dmg:14,speed:55,r:19,money:55,attackCd:1.1,color:'#b991e2',disrupt:260},
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
    frostTurret:{name:'Kriyo Taret',cost:500,hp:260,w:46,h:46,turret:true,range:290,rate:.45,damage:12,bulletSpeed:700,slow:2.5,desc:'Yaklaşanları yavaşlatır; geç gecelerde etkisine direnç gelişir'}
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
  Object.assign(WEAPONS,{
    laser:{name:'Odak Lazeri',cost:1700,damage:3,rate:.2,speed:1800,spread:0,pellets:1,mag:50,reload:2.8,range:800,pierce:0,auto:true,color:'#ff6d95',beam:true,armorPierce:true,desc:'Aynı hedefte 4 sn tut: vuruş 3 → 150. Işını kesmek veya hedef değiştirmek odağı sıfırlar. Zırh deler.'},
    arc:{name:'Tesla Yayı',cost:1450,damage:38,rate:.45,speed:1100,spread:.02,pellets:1,mag:18,reload:2.1,range:600,pierce:0,auto:true,color:'#be9dff',chain:3,desc:'İlk hedeften 160 menzilde 3 ek hedefe sıçrar; her sıçrayışta %25 hasar azalır. Zırh deler.',armorPierce:true},
    flame:{name:'Alev Püskürtücü',cost:950,damage:5,rate:.09,speed:600,spread:.15,pellets:1,mag:65,reload:2.5,range:250,pierce:1,auto:true,color:'#ff9e4f',burn:4,desc:'Kısa menzilde yaylım. 4 sn boyunca saniyede 16 yanma hasarı; tekrar isabet süreyi yeniler.'}
  });
  WEAPON_ORDER.push('laser','arc','flame');
  Object.assign(UPGRADES,{
    recovery:{name:'Ekip Rejenerasyonu',cost:220,max:3,desc:'Tüm ekibe seviye başına +0.5 can/sn yenilenme'},
    fortification:{name:'Güçlendirilmiş Yapılar',cost:280,max:3,desc:'Mevcut ve yeni yapıların dayanıklılığına seviye başına +%20 (mayın hariç)'},
    sentry:{name:'Taret Mühimmatı',cost:300,max:4,desc:'Tüm taretlerin hasarına seviye başına +%15'}
  });
  SHOP.teammed={name:'Ekip Sağlık Paketi',cost:150,heal:60,desc:'Ayaktaki bütün yaralı oyunculara anında +60 can. Yerdekileri diriltmez.'};
  SHOP.teamammo={name:'Ekip Mühimmat Sandığı',cost:100,desc:'Tüm oyuncuların aktif ve yedek silahlarının şarjörlerini doldurur.'};
  const newUpgrades=()=>Object.fromEntries(Object.keys(UPGRADES).map(k=>[k,0]));
  const laserDamage=t=>Math.round(3+147*Math.pow(Math.max(0,Math.min(1,t/4)),3));
  const APPEARANCE={
    colors:[{id:'sage',name:'Adaçayı',value:'#8cab81'},{id:'cobalt',name:'Kobalt',value:'#629ddd'},{id:'ember',name:'Kor',value:'#dc865c'},{id:'plum',name:'Erik',value:'#b087c8'},{id:'sand',name:'Kum',value:'#d0bb8c'},{id:'rose',name:'Gül',value:'#cf809e'}],
    outfits:[{id:'ranger',name:'İzci'},{id:'heavy',name:'Ağır Zırh'},{id:'hazmat',name:'Koruyucu Tulum'}],
    heads:[{id:'helmet',name:'Kask'},{id:'beret',name:'Bere'},{id:'hood',name:'Kapüşon'}],
    skins:[{id:'light',name:'Açık',value:'#e1bd99'},{id:'medium',name:'Orta',value:'#b78561'},{id:'deep',name:'Koyu',value:'#805742'}]
  };
  function sanitizeAppearance(input={}){
    if(!input||typeof input!=='object')input={};
    return Object.fromEntries(Object.entries(APPEARANCE).map(([key,values])=>[key,values.some(v=>v.id===input[key])?input[key]:values[0].id]));
  }
  const ZOMBIE_GUIDE={
    walker:{night:1,role:'Temel tehdit',behavior:'Sığınağa yürür; yakındaki oyuncuya döner. Vurulursa saldıranı takip eder.',counter:'Mesafeni koru. Tabanca ve sıradan barikatlar yeterlidir.'},
    runner:{night:2,role:'Hızlı avcı',behavior:'Yüksek hızla arayı kapatır. İlerleyen gecelerde sayısı ve saldırı hızı artar.',counter:'Kriyo, dikenli tel ve SMG ile yavaşlatıp temizle.'},
    swarm:{night:3,role:'Kalabalık saldırısı',behavior:'Küçük, hızlı ve az canlıdır; sayı üstünlüğüyle çevreler.',counter:'Tesla sıçraması, alev, pompalı veya mayın kullan.'},
    spitter:{night:4,role:'Menzilli saldırgan',behavior:'Uzaktan asit atar; yaklaşırsan geri çekilir. Asit oyuncuları, yapıları ve sığınağı yaralar.',counter:'Asitten yana kaçarak kurtul. Barikat asidi durdurur; uzun menzilli silahla avla.'},
    armored:{night:4,role:'Zırhlı öncü',behavior:'Normal vuruşların hasarını %45 azaltır; yavaştır ama dayanıklıdır.',counter:'Magnum, Odak Lazeri, Tesla veya Keskin Taret zırhı yok sayar.'},
    brute:{night:6,role:'Ağır baskı',behavior:'Çok canlı, yavaş bir yakın dövüş tehdididir. Yüksek tek vuruş hasarı verir.',counter:'Kriyo ile yavaşlat; lazer odağını koru veya tüfekle uzaktan vur.'},
    sapper:{night:6,role:'Yapı yıkıcı',behavior:'Oyuncular yerine sığınağa ilerler. Önündeki yapılara 3 kat hasar verir.',counter:'Barikatlara ulaşmadan öldür. Kriyo ve Keskin Taret güçlü karşılıklardır.'},
    healer:{night:7,role:'Destekçi',behavior:'160 menzildeki diğer zombilere saniyede 18 can geri kazandırır; kendini iyileştirmez.',counter:'Önce şifacıyı indir. Alan hasarıyla desteklediği grubu birlikte temizle.'},
    berserker:{night:8,role:'Öfkeli avcı',behavior:'Canı yarının altına düşünce %70 hızlanır.',counter:'Yarı cana düşürdükten sonra ateşi kesme; kriyo ile kaçış aralığını koru.'},
    mortar:{night:10,role:'Taret avcısı',behavior:'510 menzilden öncelikle taretlere asit atar. Duvarlar atışını engeller. Oyuncularla oyalanmaz.',counter:'Taret menzili dışında bekleyebilir. Silahınla yaklaş veya uzun menzilli Keskin Taret kullan.'},
    disruptor:{night:12,role:'Savunma bozucu',behavior:'260 menzildeki taretlerin atış aralığını iki katına çıkarır. Etkiler üst üste birikmez.',counter:'Mor etki alanına dikkat et; bozucuyu öncelikli hedef yap.'},
    boss:{night:5,role:'Gece lideri',behavior:'Her 5. gecede gelir. Çok yüksek canı ve yakın dövüş hasarı vardır.',counter:'Aynı hedefte lazer odağı biriktir. Ekibin diğer üyeleri küçük zombileri temizlesin.'}
  };
  function nightInfo(n){return {name:n%5===0?'DEV AVCISI':n>=12?'ELEKTRONİK KUŞATMA':n>=10?'TARET AVCILARI':n>=8?'MUTASYON':n>=4?'KUŞATMA':'İLK TEMAS',boss:n%5===0,types:[...new Set(waveComp(n))].sort(),desc:n>=12?'Taret bozma · artan saldırı hızı · yavaşlatma direnci':n>=10?'Uzun menzilli kuşatmacılar taretleri avlar':n>=6?'Yıkıcı ve destekçi birlikleri öncelikle avla':'İlk savunmanı kur; sonraki gecelere yatırım yap'};}
  const BASE_LEVELS=[
    {name:'Sığınak',cost:0,night:0,hp:3000,turrets:4,desc:'Temel silahlar ve savunmalar'},
    {name:'Karakol',cost:650,night:3,hp:3800,turrets:6,desc:'Taarruz, nişancı, kriyo, alev ve uzman taretler'},
    {name:'Kale',cost:1500,night:6,hp:4700,turrets:8,desc:'Tesla, lazer, LMG ve bomba atar'},
    {name:'Son Hat',cost:3000,night:10,hp:5800,turrets:10,desc:'Tüm yapıların 4. seviyesi; en yüksek savunma kapasitesi'}
  ];
  for(const id of ['carbine','rifle','frost','flame'])WEAPONS[id].baseLevel=2;
  for(const id of ['lmg','launcher','laser','arc'])WEAPONS[id].baseLevel=3;
  for(const id of ['sniperTurret','frostTurret','reinforced'])BUILD[id].baseLevel=2;
  function structureStats(kind,level=1,fortification=0){const d=BUILD[kind];return {hp:Math.round(d.hp*(1+.65*(level-1))*(1+.2*fortification)),damage:(d.damage||d.dps||0)*(1+.3*(level-1)),range:(d.range||0)*(1+.05*(level-1))};}
  function structureUpgradeCost(kind,level){return Math.ceil(BUILD[kind].cost*.6*level);}
  function slowFactor(wave){return .5+Math.min(.3,Math.max(0,wave-10)*.012);}

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
    BASE_LEVELS, structureStats, structureUpgradeCost, slowFactor, WORLD, BASE, PLAYER, WEAPONS, WEAPON_ORDER, ZOMBIES, BUILD, SHOP, UPGRADES, nightInfo, startingGold, newUpgrades, laserDamage, APPEARANCE, sanitizeAppearance, ZOMBIE_GUIDE,
    MAX_PLAYERS, INTERMISSION, PLAYER_SCALE_STEP,
    playerScale, scaleZombie, waveComp, waveSpawnInterval, waveBonus,
    dist, clamp, rand, roomCode, spawnEdgePoint
  };
});
