'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const C = require('./public/game-core.js');

const PORT = process.env.PORT || 3000;
const VERSION = '2.0.0';
const TICK = 1 / 30;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/_health', (_q, res) => res.json({ ok: true, version: VERSION, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

const rooms = new Map();
let nextPlayerId = 1;

function circleRect(cx, cy, r, x, y, w, h) {
  const px = C.clamp(cx, x, x + w), py = C.clamp(cy, y, y + h);
  const dx = cx - px, dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.hostId = null;
    this.state = 'lobby';
    this.phase = 'prep';
    this.wave = 0;
    this.timer = 45;
    this.gold = 0;
    this.base = { x: C.BASE.x, y: C.BASE.y, r: C.BASE.r, hp: C.BASE.hp, maxHp: C.BASE.hp };
    this.walls = [];
    this.zombies = [];
    this.bullets = [];
    this.acids = [];
    this.queue = [];
    this.spawnT = 0;
    this.events = [];
    this.nextZid = 1;
  }

  addPlayer(ws, name, color) {
    const id = nextPlayerId++;
    const ang = Math.random() * Math.PI * 2;
    const p = {
      id, ws, name: String(name || 'Oyuncu').slice(0, 16), color,
      x: this.base.x + Math.cos(ang) * (this.base.r + 70),
      y: this.base.y + Math.sin(ang) * (this.base.r + 70),
      a: 0, hp: C.PLAYER.hp, maxHp: C.PLAYER.hp, r: C.PLAYER.r,
      money: 0, weapon: 'pistol', owned: ['pistol'],
      ammo: C.WEAPONS.pistol.mag, ammoStore: {}, upgrades: {vitality:0,mobility:0,power:0,handling:0},
      reloadT: 0, fireT: 0, state: 'alive', bleed: 0, reviveProg: 0,
      kills: 0, mx: 0, my: 0, aim: 0, fire: false, rel: false
    };
    this.players.set(id, p);
    if (!this.hostId) this.hostId = id;
    if (this.state === 'playing') {
      p.money = C.PLAYER.startMoney;
      this.rescale();
    }
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = this.players.keys().next().value || null;
    }
    if (this.state === 'playing') this.rescale();
    if (this.players.size === 0) rooms.delete(this.code);
  }

  rescale() {
    const n = Math.max(1, this.players.size);
    for (const z of this.zombies) {
      const s = C.scaleZombie(z.type, z.wave, n);
      const frac = z.maxHp > 0 ? z.hp / z.maxHp : 1;
      z.maxHp = s.hp;
      z.hp = Math.max(1, Math.round(frac * s.hp));
      z.dmg = s.dmg;
    }
  }

  start() {
    this.state = 'playing';
    this.phase = 'prep';
    this.wave = 0;
    this.timer = 45;
    this.gold = C.startingGold(this.players.size);
    this.base.hp = this.base.maxHp;
    this.walls = [];
    this.zombies = [];
    this.bullets = [];
    this.acids = [];
    this.queue = [];
    for (const p of this.players.values()) {
      p.hp = p.maxHp = C.PLAYER.hp;
      p.money = C.PLAYER.startMoney;
      p.weapon = 'pistol';
      p.owned = ['pistol']; p.ammoStore = {}; p.upgrades = {vitality:0,mobility:0,power:0,handling:0};
      p.ammo = C.WEAPONS.pistol.mag;
      p.reloadT = 0; p.fireT = 0; p.state = 'alive'; p.bleed = 0;
      p.reviveProg = 0; p.kills = 0; p.mx = p.my = 0; p.fire = p.rel = p.firedLatch = false;
      const ang = Math.random() * Math.PI * 2;
      p.x = this.base.x + Math.cos(ang) * (this.base.r + 70);
      p.y = this.base.y + Math.sin(ang) * (this.base.r + 70);
    }
  }

  build(kind, x, y, playerId) {
    const def = C.BUILD[kind];
    const builder = this.players.get(playerId);
    if (!def || !builder || builder.state !== 'alive' || this.state !== 'playing') return false;
    if (this.gold < def.cost) return false;
    x = Math.round(x); y = Math.round(y);
    if (x < def.w / 2 + 10 || y < def.h / 2 + 10 || x > C.WORLD.w - def.w / 2 - 10 || y > C.WORLD.h - def.h / 2 - 10) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const bx = x - def.w / 2, by = y - def.h / 2;
    if (Math.hypot(x - this.base.x, y - this.base.y) < this.base.r + Math.max(def.w, def.h) * 0.6) return false;
    for (const w of this.walls) {
      if (circleRect(x, y, Math.max(def.w, def.h) * 0.55, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) return false;
      if (Math.abs(w.x - x) < (w.w + def.w) / 2 && Math.abs(w.y - y) < (w.h + def.h) / 2) return false;
    }
    for (const z of this.zombies) {
      if (Math.hypot(z.x - x, z.y - y) < z.r + Math.max(def.w, def.h) * 0.5) return false;
    }
    for (const p of this.players.values()) {
      if (p.state !== 'dead' && circleRect(p.x,p.y,p.r+3,x-def.w/2,y-def.h/2,def.w,def.h)) return false;
    }
    this.gold -= def.cost;
    const wall = {
      x, y, w: def.w, h: def.h, hp: def.hp, maxHp: def.hp,
      kind, turretT: 0, angle: 0
    };
    if (def.turret) wall.range = def.range;
    this.walls.push(wall);
    this.events.push({ e: 'bld', x, y, k: kind });
    return true;
  }

  buy(item, playerId) {
    const p = this.players.get(playerId);
    if (!p || p.state !== 'alive') return false;
    if (this.state !== 'playing') return false;
    if (C.WEAPONS[item]) {
      const def = C.WEAPONS[item];
      if (p.owned.includes(item)) return this.equip(p,item);
      if (this.gold < def.cost) return false;
      this.gold -= def.cost;
      p.owned.push(item);
      this.equip(p,item);
      this.events.push({ e: 'buy', id: p.id, item: def.name });
      return true;
    }
    if (C.UPGRADES[item]) {
      const def=C.UPGRADES[item], level=p.upgrades[item]||0, price=def.cost*(level+1);
      if(level>=def.max || this.gold<price) return false;
      this.gold-=price;p.upgrades[item]=level+1;
      if(item==='vitality'){p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+25);}
      this.events.push({e:'buy',id:p.id,item:def.name+' '+(level+1)});return true;
    }
    const def = C.SHOP[item];
    if (!def || this.gold < def.cost) return false;
    if (item === 'medkit') {
      if (p.hp >= p.maxHp) return false;
      p.hp = Math.min(p.maxHp, p.hp + def.heal);
    } else if (item === 'ammo') {
      const w = C.WEAPONS[p.weapon];
      if (p.ammo >= w.mag && p.reloadT <= 0) return false;
      p.ammo = w.mag; p.reloadT = 0;
    } else if (item === 'baserepair') {
      if (this.base.hp >= this.base.maxHp) return false;
      this.base.hp = Math.min(this.base.maxHp, this.base.hp + def.heal);
    } else if (item === 'wallrepair') {
      let best = null, bestDist = 420;
      for (const w of this.walls) {
        if (w.hp >= w.maxHp) continue;
        const d = Math.hypot(w.x-p.x,w.y-p.y);
        if (d < bestDist) { best = w; bestDist = d; }
      }
      if (!best) return false;
      best.hp = Math.min(best.maxHp, best.hp + def.heal);
    } else return false;
    this.gold -= def.cost;
    this.events.push({ e: 'buy', id: p.id, item: def.name });
    return true;
  }

  equip(p, weapon) {
    if(!p || p.state!=='alive' || !p.owned.includes(weapon) || !C.WEAPONS[weapon]) return false;
    if(p.weapon===weapon) return true;
    p.ammoStore[p.weapon]=p.ammo;
    p.weapon=weapon;p.ammo=p.ammoStore[weapon] ?? C.WEAPONS[weapon].mag;
    p.reloadT=0;p.fireT=Math.max(.2,p.fireT);p.firedLatch=false;
    if(p.ammo===0)this.startReload(p);
    return true;
  }

  salvage(x,y,playerId) {
    const p=this.players.get(playerId);
    if(!p || p.state!=='alive' || this.state!=='playing' || !Number.isFinite(x)||!Number.isFinite(y)) return false;
    const w=this.walls.find(w=>Math.abs(w.x-x)<w.w/2+12 && Math.abs(w.y-y)<w.h/2+12);
    if(!w || Math.hypot(p.x-w.x,p.y-w.y)>300) return false;
    const refund=Math.floor(C.BUILD[w.kind].cost*.4*w.hp/w.maxHp);
    this.gold+=refund;this.removeWall(w);send(p.ws,{t:'notice',m:'Yapı söküldü. Ortak kasaya +$'+refund});return true;
  }

  hitZombie(z,damage,owner,armorPierce=false,slow=0) {
    if(z.hp<=0)return;
    const def=C.ZOMBIES[z.type];
    z.hp-=damage*(armorPierce?1:1-(def.armor||0));
    z.aggro=8;z.aggroId=owner;
    if(slow)z.slowT=Math.max(z.slowT||0,slow);
    this.events.push({e:'h',x:z.x,y:z.y});
    if(z.hp<=0){const p=this.players.get(owner);if(p)p.kills++;this.gold+=z.money;this.events.push({e:'k',x:z.x,y:z.y,t:z.type});}
  }

  blast(x,y,r,damage,owner){
    for(const z of this.zombies)if(Math.hypot(z.x-x,z.y-y)<r+z.r)this.hitZombie(z,damage,owner,true);
    this.events.push({e:'blast',x,y,r});
  }

  spawnWave() {
    this.wave++;
    this.phase = 'wave';
    this.queue = C.waveComp(this.wave);
    this.spawnT = 0;
    for (const p of this.players.values()) {
      if (p.state === 'dead') {
        p.state = 'alive'; p.hp = p.maxHp;
        const ang = Math.random() * Math.PI * 2;
        p.x = this.base.x + Math.cos(ang) * (this.base.r + 70);
        p.y = this.base.y + Math.sin(ang) * (this.base.r + 70);
      }
    }
    this.events.push({ e: 'ws', n: this.wave });
  }

  spawnZombie() {
    const type = this.queue.shift();
    if (!type) return;
    const s = C.scaleZombie(type, this.wave, Math.max(1, this.players.size));
    const pos = C.spawnEdgePoint();
    this.zombies.push({
      i: this.nextZid++, type, wave: this.wave,
      x: pos.x, y: pos.y, hp: s.hp, maxHp: s.hp, dmg: s.dmg,
      speed: s.speed, r: s.r, money: s.money, attackCd: s.attackCd,
      range: s.range || 0, color: s.color, boss: s.boss, name: s.name,
      atk: Math.random() * 0.5, aggro: 0, aggroId: 0
    });
  }

  update(dt) {
    if (this.state !== 'playing') return;

    if (this.phase === 'prep') {
      this.timer -= dt;
      if (this.timer <= 0) this.spawnWave();
    } else {
      if (this.queue.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnZombie();
          this.spawnT = C.waveSpawnInterval(this.wave);
        }
      } else if (this.zombies.length === 0 && [...this.players.values()].some(p => p.state === 'alive') && this.base.hp > 0) {
        const bonus = C.waveBonus(this.wave);
        this.gold += bonus;
        this.phase = 'prep';
        this.timer = C.INTERMISSION;
        this.acids = []; this.bullets = [];
        for (const p of this.players.values()) {
          if (p.state !== 'alive') {
            const ang = Math.random() * Math.PI * 2;
            p.x = this.base.x + Math.cos(ang) * (this.base.r + 70);
            p.y = this.base.y + Math.sin(ang) * (this.base.r + 70);
          }
          p.state = 'alive'; p.hp = p.maxHp; p.bleed = 0; p.reviveProg = 0;
          p.ammoStore={};p.reloadT = 0; p.ammo = C.WEAPONS[p.weapon].mag;
          p.mx = 0; p.my = 0; p.fire = false; p.rel = false; p.firedLatch = false;
        }
        this.events.push({ e: 'wc', n: this.wave, b: bonus });
      }
    }

    this.updatePlayers(dt);
    this.updateBullets(dt);
    this.updateAcids(dt);
    this.updateTurrets(dt);
    this.updateZombies(dt);

    if (this.players.size && [...this.players.values()].every(p => p.state === 'dead')) {
      this.gameOver();
      return;
    }

    if (this.base.hp <= 0) {
      this.base.hp = 0;
      this.gameOver();
    }
  }

  updatePlayers(dt) {
    for (const p of this.players.values()) {
      p.fireT -= dt;
      if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) p.reloadT = 0, p.ammo = C.WEAPONS[p.weapon].mag;
      }
      if (p.state === 'down') {
        p.bleed -= dt;
        let rescuer = null;
        for (const o of this.players.values()) {
          if (o.id !== p.id && o.state === 'alive' && Math.hypot(o.x - p.x, o.y - p.y) < 85) { rescuer = o; break; }
        }
        if (rescuer) {
          p.reviveProg += dt;
          if (p.reviveProg >= C.PLAYER.reviveTime) {
            p.state = 'alive'; p.hp = Math.round(p.maxHp * 0.55);
            p.reviveProg = 0; p.bleed = 0;
            this.events.push({ e: 'dr', id: p.id });
            continue;
          }
        } else p.reviveProg = Math.max(0, p.reviveProg - dt * 0.6);
        if (p.bleed <= 0) {
          p.state = 'dead'; p.reviveProg = 0;
          this.events.push({ e: 'dk', id: p.id });
        }
        p.x += p.mx * C.PLAYER.speed * 0.35 * dt;
        p.y += p.my * C.PLAYER.speed * 0.35 * dt;
        p.x = C.clamp(p.x, p.r, C.WORLD.w - p.r);
        p.y = C.clamp(p.y, p.r, C.WORLD.h - p.r);
        continue;
      }
      if (p.state !== 'alive') continue;

      p.hp = Math.min(p.maxHp, p.hp + C.PLAYER.regen * dt);

      const len = Math.hypot(p.mx, p.my) || 1;
      const spd = C.PLAYER.speed * (1+.08*(p.upgrades.mobility||0)) * dt;
      const nx = p.x + (p.mx / len) * spd;
      const ny = p.y + (p.my / len) * spd;
      if (!this.solidForPlayer(nx, p.y, p.r)) p.x = C.clamp(nx, p.r, C.WORLD.w - p.r);
      if (!this.solidForPlayer(p.x, ny, p.r)) p.y = C.clamp(ny, p.r, C.WORLD.h - p.r);

      p.a = p.aim;

      const w = C.WEAPONS[p.weapon];
      if (p.rel && p.reloadT <= 0 && p.ammo < w.mag) this.startReload(p);
      if (p.fire && p.fireT <= 0 && p.reloadT <= 0 && p.ammo > 0) {
        if (w.auto || !p.firedLatch) {
          this.shoot(p, w);
          p.firedLatch = true;
        }
      }
      if (!p.fire) p.firedLatch = false;
    }
  }

  startReload(p) {
    const w = C.WEAPONS[p.weapon];
    p.reloadT = w.reload * (1-.1*(p.upgrades.handling||0));
    this.events.push({ e: 'rl', id: p.id });
  }

  shoot(p, w) {
    p.fireT = w.rate;
    p.ammo--;
    for (let i = 0; i < w.pellets; i++) {
      const a = p.a + (Math.random() - 0.5) * 2 * w.spread;
      this.bullets.push({
        x: p.x + Math.cos(p.a) * (p.r + 6),
        y: p.y + Math.sin(p.a) * (p.r + 6),
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.damage*(1+.1*(p.upgrades.power||0)), slow:w.slow, splash:w.splash, armorPierce:w.armorPierce, hit:new Set(), pierce: w.pierce, life: w.range / w.speed,
        owner: p.id, color:w.color, a
      });
    }
    if (p.ammo <= 0) this.startReload(p);
  }

  solidForPlayer(x, y, r) {
    if (Math.hypot(x - this.base.x, y - this.base.y) < this.base.r + r) return true;
    for (const w of this.walls) {
      if (!C.BUILD[w.kind].solid) continue;
      if (circleRect(x, y, r, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) return true;
    }
    return false;
  }

  updateBullets(dt) {
    const alive=[];
    for(const b of this.bullets){
      const ox=b.x,oy=b.y,travel=Math.min(dt,Math.max(0,b.life));
      b.x+=b.vx*travel;b.y+=b.vy*travel;b.life-=dt;
      const dx=b.x-ox,dy=b.y-oy,len=dx*dx+dy*dy;
      b.hit ||= new Set();
      const hits=[];
      for(const z of this.zombies){
        if(z.hp<=0||b.hit.has(z.i))continue;
        const t=len?Math.max(0,Math.min(1,((z.x-ox)*dx+(z.y-oy)*dy)/len)):0;
        if(Math.hypot(z.x-(ox+dx*t),z.y-(oy+dy*t))<z.r+4)hits.push({z,t});
      }
      hits.sort((a,b)=>a.t-b.t);let dead=false;
      for(const {z,t} of hits){
        b.hit.add(z.i);
        if(b.splash){this.blast(ox+dx*t,oy+dy*t,b.splash,b.dmg,b.owner);dead=true;break;}
        this.hitZombie(z,b.dmg,b.owner,b.armorPierce,b.slow);
        if(b.pierce>0)b.pierce--;else {dead=true;break;}
      }
      if(!dead&&b.life<=0&&b.splash)this.blast(b.x,b.y,b.splash,b.dmg,b.owner);
      if(!dead&&b.life>0&&b.x>=0&&b.y>=0&&b.x<=C.WORLD.w&&b.y<=C.WORLD.h)alive.push(b);
    }
    this.bullets=alive;this.zombies=this.zombies.filter(z=>z.hp>0);
  }

  updateAcids(dt) {
    const alive = [];
    for (const a of this.acids) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
      let dead = a.life <= 0;
      if (!dead) {
        for (const p of this.players.values()) {
          if (p.state === 'alive' && Math.hypot(p.x - a.x, p.y - a.y) < p.r + 5) {
            this.damagePlayer(p, a.dmg); dead = true; break;
          }
        }
      }
      if (!dead && Math.hypot(a.x - this.base.x, a.y - this.base.y) < this.base.r) {
        this.base.hp -= a.dmg;
        this.events.push({ e: 'bh', x: a.x, y: a.y });
        dead = true;
      }
      if (!dead) {
        for (const w of this.walls) {
          if (!C.BUILD[w.kind].trap && circleRect(a.x, a.y, 4, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) {
            w.hp -= a.dmg; dead = true;
            if (w.hp <= 0) this.removeWall(w);
            break;
          }
        }
      }
      if (a.x > -30 && a.y > -30 && a.x < C.WORLD.w + 30 && a.y < C.WORLD.h + 30 && !dead) alive.push(a);
    }
    this.acids = alive;
  }

  damagePlayer(p, dmg) {
    if (p.state !== 'alive') return;
    p.hp -= dmg;
    this.events.push({ e: 'ph', id: p.id, x: p.x, y: p.y });
    if (p.hp <= 0) {
      p.hp = 0;
      p.state = 'down';
      p.bleed = C.PLAYER.downBleed;
      p.reviveProg = 0;
      this.events.push({ e: 'dd', id: p.id });
    }
  }

  removeWall(w) {
    const i = this.walls.indexOf(w);
    if (i >= 0) this.walls.splice(i, 1);
    this.events.push({ e: 'wbd', x: w.x, y: w.y });
  }

  updateTurrets(dt) {
    for (const w of this.walls) {
      const def=C.BUILD[w.kind];
      if (!def.turret) continue;
      w.turretT -= dt;
      if (w.turretT > 0) continue;
      let best = null, bd = w.range;
      for (const z of this.zombies) {
        const d = Math.hypot(z.x - w.x, z.y - w.y);
        if (d < bd) { bd = d; best = z; }
      }
      if (!best) continue;
      // Each turret uses its own range, fire rate and projectile effects.
      w.turretT = def.rate;
      const a = Math.atan2(best.y - w.y, best.x - w.x);
      w.angle = a;
      this.bullets.push({
        x: w.x + Math.cos(a) * 26, y: w.y + Math.sin(a) * 26,
        vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed,
        dmg: def.damage, pierce: def.pierce||0, slow:def.slow, armorPierce:def.armorPierce, life: def.range / def.bulletSpeed,
        owner: -1, color:def.slow?'#8fe8ff':def.armorPierce?'#d4aeff':'#a8ffcf', a
      });
    }
  }

  updateZombies(dt) {
    const n = Math.max(1, this.players.size);
    for (const w of [...this.walls]) {
      const def=C.BUILD[w.kind];if(!def.trap)continue;
      if(def.splash){if(this.zombies.some(z=>z.hp>0&&Math.hypot(z.x-w.x,z.y-w.y)<65)){this.blast(w.x,w.y,def.splash,def.damage,0);this.removeWall(w);}continue;}
      let touched=false;
      for(const z of this.zombies)if(z.hp>0&&circleRect(z.x,z.y,z.r,w.x-w.w/2,w.y-w.h/2,w.w,w.h)){z.slowT=.3;this.hitZombie(z,def.dps*dt,0);touched=true;}
      if(touched){w.hp-=8*dt;if(w.hp<=0)this.removeWall(w);}
    }
    for (const z of this.zombies) {
      if(z.hp<=0)continue;
      const zd=C.ZOMBIES[z.type];
      z.slowT=Math.max(0,(z.slowT||0)-dt);
      if(zd.healAura)for(const ally of this.zombies)if(ally!==z&&ally.hp>0&&Math.hypot(ally.x-z.x,ally.y-z.y)<160)ally.hp=Math.min(ally.maxHp,ally.hp+zd.healAura*dt);
      z.atk -= dt;
      z.aggro -= dt;

      let target = null, tdist = Infinity;
      if (z.aggro > 0 && z.aggroId) {
        const ap = this.players.get(z.aggroId);
        if (ap && ap.state !== 'dead') { target = ap; tdist = Math.hypot(ap.x - z.x, ap.y - z.y); }
      }
      if (!target) {
        for (const p of this.players.values()) {
          if (p.state !== 'alive') continue;
          const d = Math.hypot(p.x - z.x, p.y - z.y);
          if (d < 210 && d < tdist) { target = p; tdist = d; }
        }
      }

      if(zd.siege)target=null;
      const isSpit = z.range > 0;
      const aimX = target ? target.x : this.base.x;
      const aimY = target ? target.y : this.base.y;
      let dist = Math.hypot(aimX - z.x, aimY - z.y);

      if (isSpit && target && dist < z.range && dist > 150 && z.atk <= 0) {
        z.atk = z.attackCd;
        const lead = Math.min(0.6, dist / 300);
        const ta = target.a || 0;
        const tx = target.x + (target.mx || 0) * C.PLAYER.speed * lead;
        const ty = target.y + (target.my || 0) * C.PLAYER.speed * lead;
        const a = Math.atan2(ty - z.y, tx - z.x);
        this.acids.push({ x: z.x, y: z.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: z.dmg, life: 2.4 });
        continue;
      }
      if (isSpit && !target && dist < z.range && z.atk <= 0) {
        z.atk = z.attackCd;
        const a = Math.atan2(this.base.y - z.y, this.base.x - z.x);
        this.acids.push({ x: z.x, y: z.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: z.dmg, life: 2.4 });
        continue;
      }

      if (target && dist < z.r + target.r + 6) {
        if (z.atk <= 0) {
          z.atk = z.attackCd;
          this.damagePlayer(target, z.dmg);
          if (target.state !== 'alive') z.aggro = 0;
        }
        continue;
      }
      if (isSpit && target && dist < 150) {
        const a = Math.atan2(z.y - target.y, z.x - target.x);
        this.moveZombie(z, z.x + Math.cos(a) * z.speed * (z.slowT>0?.5:1) * (zd.rage&&z.hp<z.maxHp*.5?1.7:1) * dt, z.y + Math.sin(a) * z.speed * (z.slowT>0?.5:1) * (zd.rage&&z.hp<z.maxHp*.5?1.7:1) * dt, dt);
        continue;
      }
      if (!target && Math.hypot(z.x - this.base.x, z.y - this.base.y) < this.base.r + z.r + 6) {
        if (z.atk <= 0) {
          z.atk = z.attackCd;
          this.base.hp -= z.dmg;
          this.events.push({ e: 'bh', x: this.base.x + (z.x - this.base.x) * 0.7, y: this.base.y + (z.y - this.base.y) * 0.7 });
        }
        continue;
      }

      const d = Math.hypot(aimX - z.x, aimY - z.y) || 1;
      const nx = z.x + (aimX - z.x) / d * z.speed * (z.slowT>0?.5:1) * (zd.rage&&z.hp<z.maxHp*.5?1.7:1) * dt;
      const ny = z.y + (aimY - z.y) / d * z.speed * (z.slowT>0?.5:1) * (zd.rage&&z.hp<z.maxHp*.5?1.7:1) * dt;
      const blocked = this.moveZombie(z, nx, ny, dt);
      if (blocked && blocked !== 'base') {
        if (z.atk <= 0) {
          z.atk = z.attackCd;
          blocked.hp -= z.dmg*(zd.siege||1);
          this.events.push({ e: 'whp', x: blocked.x, y: blocked.y });
          if (blocked.hp <= 0) this.removeWall(blocked);
        }
      }
    }
    this.zombies=this.zombies.filter(z=>z.hp>0);
    if (n !== this.lastPlayerCount) this.lastPlayerCount = n;
  }

  moveZombie(z, nx, ny, dt) {
    nx = C.clamp(nx, z.r, C.WORLD.w - z.r);
    ny = C.clamp(ny, z.r, C.WORLD.h - z.r);
    for (const w of this.walls) {
      if(C.BUILD[w.kind].trap)continue;
      if (circleRect(nx, ny, z.r, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h)) return w;
    }
    if (Math.hypot(nx - this.base.x, ny - this.base.y) < this.base.r + z.r * 0.5) return 'base';
    z.x = nx; z.y = ny;
    return null;
  }

  gameOver() {
    this.state = 'over';
    const stats = [];
    for (const p of this.players.values()) {
      stats.push({ id: p.id, name: p.name, kills: p.kills, color: p.color });
    }
    stats.sort((a, b) => b.kills - a.kills);
    this.broadcast({ t: 'over', wave: this.wave, host: this.hostId, stats });
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws.readyState === 1) p.ws.send(s);
    }
  }

  snapshot() {
    const P = [], Z = [], B = [], A = [], L = [];
    for (const p of this.players.values()) {
      P.push({
        i: p.id, x: +p.x.toFixed(1), y: +p.y.toFixed(1), a: +p.a.toFixed(2),
        hp: Math.max(0, Math.round(p.hp)), mh: p.maxHp, s: p.state,
        w: p.weapon, mz: p.ammo, rl: p.reloadT > 0 ? +p.reloadT.toFixed(1) : 0,
        b: p.state === 'down' ? +p.bleed.toFixed(1) : 0,
        rv: +p.reviveProg.toFixed(1), k: p.kills, n: p.name, c: p.color, o: p.owned, u:p.upgrades
      });
    }
    for (const z of this.zombies) {
      Z.push({ i: z.i, x: +z.x.toFixed(1), y: +z.y.toFixed(1), hp: Math.max(0, Math.round(z.hp)), mh: z.maxHp, t: z.type });
    }
    for (const b of this.bullets) B.push({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), a: +b.a.toFixed(2), o: b.owner, v:Math.round(Math.hypot(b.vx,b.vy)), c:b.color });
    for (const a of this.acids) A.push({ x: +a.x.toFixed(1), y: +a.y.toFixed(1) });
    for (const w of this.walls) {
      L.push({ x: w.x, y: w.y, w: w.w, h: w.h, hp: Math.max(0, Math.round(w.hp)), mh: w.maxHp, kind:w.kind, k: C.BUILD[w.kind].turret ? 1 : 0, a: +((w.angle || 0).toFixed(2)) });
    }
    const ev = this.events;
    this.events = [];
    return {
      t: 's', q:this.queue.length, p: this.phase, w: this.wave, ti: +Math.max(0, this.timer).toFixed(1),
      g: Math.floor(this.gold), bh: Math.max(0, Math.round(this.base.hp)), bmh: this.base.maxHp,
      P, Z, B, A, L, ev, st: this.state
    };
  }
}

wss.on('connection', ws => {
  let joined = null;
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'join') {
      if (joined) return;
      let code = String(msg.code || '').toUpperCase().trim();
      let room = rooms.get(code);
      if (!room && !msg.create) {
        send(ws, { t: 'err', m: 'Oda bulunamadı: ' + code });
        return;
      }
      if (!room) {
        code = C.roomCode();
        room = new Room(code);
        rooms.set(code, room);
      }
      if (room.players.size >= C.MAX_PLAYERS) {
        send(ws, { t: 'err', m: 'Oda dolu (8 kişi limiti)' });
        return;
      }
      const colors = ['#ff728b', '#68a8ff', '#69d990', '#ffd166', '#bd87ff', '#ff9d68', '#55dfc2', '#f18ab9'];
      const used = new Set([...room.players.values()].map(p => p.color));
      const color = colors.find(c => !used.has(c)) || colors[room.players.size % colors.length];
      const p = room.addPlayer(ws, msg.name, color);
      joined = { room, id: p.id };
      send(ws, { t: 'joined', id: p.id, code: room.code, state: room.state });
      room.broadcast({ t: 'lobby', host: room.hostId, state: room.state, players: lobbyList(room) });
      return;
    }

    if (!joined) return;
    const { room, id } = joined;
    if (!room.players.has(id)) return;

    switch (msg.t) {
      case 'in': {
        const p = room.players.get(id);
        if (!p) break;
        const mx = Math.max(-1, Math.min(1, +msg.mx || 0));
        const my = Math.max(-1, Math.min(1, +msg.my || 0));
        p.mx = mx; p.my = my;
        if (typeof msg.a === 'number' && isFinite(msg.a)) p.aim = msg.a;
        p.fire = !!msg.f;
        p.rel = !!msg.r;
        break;
      }
      case 'buy': if (!room.buy(String(msg.item), id)) send(ws, {t:'notice', m:'Satın alınamadı: ortak para yetersiz, karakter ayakta değil veya bu desteğe şu an ihtiyaç yok.'}); break;
      case 'equip': room.equip(room.players.get(id),String(msg.w));break;
      case 'salvage': if(!room.salvage(+msg.x,+msg.y,id))send(ws,{t:'notice',m:'Sökmek için yapıya yaklaş ve imleci üzerine getir (300 menzil).'});break;
      case 'build': { const ok = room.build(String(msg.k), +msg.x, +msg.y, id); send(ws, {t:'buildResult', ok}); break; }
      case 'start': if (id === room.hostId && room.state !== 'playing') { room.start(); room.broadcast({ t: 'gs', state: 'playing' }); } break;
      case 'skip': if (id === room.hostId && room.state === 'playing' && room.phase === 'prep') room.timer = 0; break;
      case 'ping': send(ws, { t: 'pong', id: msg.id }); break;
    }
  });

  ws.on('close', () => {
    if (!joined) return;
    const { room, id } = joined;
    room.removePlayer(id);
    room.broadcast({ t: 'lobby', host: room.hostId, state: room.state, players: lobbyList(room) });
    room.broadcast({ t: 'left', id });
  });
  ws.on('error', () => {});
});

function lobbyList(room) {
  const out = [];
  for (const p of room.players.values()) {
    out.push({ id: p.id, name: p.name, color: p.color, kills: p.kills });
  }
  return out;
}

let last = Date.now();
const tickTimer = setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  for (const room of rooms.values()) {
    try {
      room.update(dt);
      if (room.state === 'playing') {
        room.broadcast(room.snapshot());
      }
    } catch (err) {
      console.error('tick error', room.code, err);
    }
  }
}, 1000 / 30);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Zombie Base Defense sunucusu çalışıyor: http://localhost:${PORT}`);
  });
}

module.exports = { Room, rooms, circleRect, tickTimer, server };

