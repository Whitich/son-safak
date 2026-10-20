(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WORLD = { w: 2400, h: 1600 };
  const BASE = { x: WORLD.w / 2, y: WORLD.h / 2, r: 120, hp: 3000 };

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
      name: 'BOSS', hp: 2200, dmg: 55, speed: 33, r: 40, money: 400, attackCd: 1.0, color: '#ff4d6d',
      boss: true, scaleUp: true
    }
  };

  const PLAYER_SCALE_STEP = 0.35;
  const MAX_PLAYERS = 8;
  const INTERMISSION = 18;

  function playerScale(n) {
    return 1 + PLAYER_SCALE_STEP * Math.max(0, n - 1);
  }

  function scaleZombie(type, wave, playerCount) {
    const base = ZOMBIES[type];
    const hpMul = (1 + (wave - 1) * 0.17) * playerScale(playerCount);
    const dmgMul = (1 + (wave - 1) * 0.09) * playerScale(playerCount);
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
    return 60 + wave * 15;
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
    WORLD, BASE, PLAYER, WEAPONS, WEAPON_ORDER, ZOMBIES, BUILD, SHOP,
    MAX_PLAYERS, INTERMISSION, PLAYER_SCALE_STEP,
    playerScale, scaleZombie, waveComp, waveSpawnInterval, waveBonus,
    dist, clamp, rand, roomCode, spawnEdgePoint
  };
});
