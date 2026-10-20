'use strict';
const assert=require('assert/strict');
const C=require('./public/game-core');
const {Room,tickTimer}=require('./server');
const ws=()=>({readyState:1,send(){}});
function setup(){const r=new Room('PROGRESS');const p=r.addPlayer(ws(),'A','#fff');r.start();r.gold=100000;p.x=p.y=100;return {r,p};}
function enemy(r,type,x,y){r.queue=[type];r.spawnZombie();const z=r.zombies.at(-1);Object.assign(z,{x,y,atk:0});return z;}
let count=0;function test(name,fn){fn();count++;console.log('PASS | '+name);}
try{
test('Server enforces weapon and building tier locks without spending money',()=>{
  const {r,p}=setup(),g=r.gold;
  assert.equal(r.buy('arc',p.id),false);assert.equal(r.buy('laser',p.id),false);
  assert.equal(r.build('sniperTurret',500,500,p.id),false);assert.equal(r.gold,g);
  assert.equal(r.buy('smg',p.id),true);
});
test('Base progression requires completed nights, previous tier, prep and money',()=>{
  const {r,p}=setup();assert.equal(r.buy('baselevel',p.id),false);
  r.completed=3;r.base.hp=2000;const g=r.gold;
  assert.equal(r.buy('baselevel',p.id),true);assert.equal(r.baseLevel,2);assert.equal(r.gold,g-650);
  assert.equal(r.base.hp,2800);assert.equal(r.base.maxHp,3800);
  assert.equal(r.buy('arc',p.id),false);assert.equal(r.buy('frost',p.id),true);
  r.completed=6;r.phase='wave';assert.equal(r.buy('baselevel',p.id),false);
  r.phase='prep';assert.equal(r.buy('baselevel',p.id),true);assert.equal(r.buy('arc',p.id),true);
  r.completed=10;r.gold=2999;assert.equal(r.buy('baselevel',p.id),false);
  r.gold=3000;assert.equal(r.buy('baselevel',p.id),true);assert.equal(r.buy('baselevel',p.id),false);
});
test('Turret capacity is authoritative; salvage frees a slot',()=>{
  const {r,p}=setup();for(let i=0;i<4;i++)assert.equal(r.build('turret',500+i*100,500,p.id),true);
  assert.equal(r.build('turret',900,500,p.id),false);p.x=p.y=500;r.salvage(500,500,p.id);
  assert.equal(r.build('turret',900,500,p.id),true);
});
test('Structure levels preserve damage fraction and compose with team fortification',()=>{
  const {r,p}=setup();r.build('wall',300,100,p.id);const w=r.walls[0];w.hp=w.maxHp/2;
  assert.equal(r.upgradeStructure(w.id,p.id),false);r.baseLevel=2;
  const cost=C.structureUpgradeCost('wall',1),g=r.gold;
  assert.equal(r.upgradeStructure(w.id,p.id),true);assert.equal(r.gold,g-cost);assert.equal(w.level,2);
  assert.equal(w.hp/w.maxHp,.5);r.buy('fortification',p.id);assert.equal(w.hp/w.maxHp,.5);
  assert.equal(w.maxHp,C.structureStats('wall',2,1).hp);
  r.baseLevel=4;p.x=1000;assert.equal(r.upgradeStructure(w.id,p.id),false);p.x=100;
  assert.equal(r.upgradeStructure(w.id,p.id),true);assert.equal(r.upgradeStructure(w.id,p.id),true);
  assert.equal(r.upgradeStructure(w.id,p.id),false);assert.equal(w.level,4);
  p.state='dead';assert.equal(r.upgradeStructure(w.id,p.id),false);
});
test('Turret levels increase actual damage and range; heat stops continuous fire',()=>{
  const {r,p}=setup();r.baseLevel=4;r.build('turret',300,100,p.id);const w=r.walls[0];
  r.upgradeStructure(w.id,p.id);assert.ok(w.range>C.BUILD.turret.range);
  const z=enemy(r,'walker',500,100);z.hp=z.maxHp=1e7;
  r.updateTurrets(.1);assert.equal(r.bullets[0].dmg,C.BUILD.turret.damage*1.3);
  for(let i=0;i<100&&!w.cool;i++)r.updateTurrets(.1);
  assert.ok(w.cool>0);const shots=r.bullets.length;r.updateTurrets(1);assert.equal(r.bullets.length,shots);
  r.updateTurrets(3);assert.equal(w.heat,0);
});
test('Disruptor doubles turret fire interval and stops disrupting after death',()=>{
  const {r,p}=setup();r.build('turret',300,100,p.id);const w=r.walls[0];
  const z=enemy(r,'disruptor',450,100);r.updateTurrets(.1);
  assert.equal(w.jammed,true);assert.equal(w.turretT,C.BUILD.turret.rate*2);
  z.hp=0;r.updateTurrets(.1);assert.equal(w.jammed,false);
});
test('Artillery targets turrets from outside basic turret range, not nearby players',()=>{
  const {r,p}=setup();r.baseLevel=2;r.build('turret',700,500,p.id);
  const z=enemy(r,'mortar',1100,500);p.x=1100;p.y=550;
  r.updateZombies(.1);assert.equal(r.acids.length,1);assert.ok(r.acids[0].vx<0);assert.ok(Math.abs(r.acids[0].vy)<1e-8);
  assert.ok(Math.hypot(z.x-700,z.y-500)>C.BUILD.turret.range);
});
test('Nights grow at a controlled rate and evolve beyond health',()=>{
  for(let n=2;n<=50;n++){const before=C.waveComp(n-1).length,now=C.waveComp(n).length;assert.ok(now>=before);assert.ok(now-before<=12);}
  assert.ok(C.waveComp(10).includes('mortar'));assert.ok(C.waveComp(12).includes('disruptor'));
  assert.ok(!C.waveComp(9).includes('mortar'));assert.ok(!C.waveComp(11).includes('disruptor'));
  assert.ok(C.scaleZombie('walker',30,1).attackCd<C.scaleZombie('walker',10,1).attackCd);
  assert.ok(C.slowFactor(30)>C.slowFactor(10));assert.ok(C.waveSpawnInterval(30)<C.waveSpawnInterval(10));
});
test('Completed nights, IDs and structure levels reach snapshots and reset on restart',()=>{
  const {r,p}=setup();r.build('wall',300,100,p.id);r.baseLevel=3;r.completed=6;
  const snap=r.snapshot();assert.equal(snap.bl,3);assert.equal(snap.cn,6);assert.equal(snap.L[0].lv,1);assert.ok(snap.L[0].id);
  r.start();assert.equal(r.completed,0);assert.equal(r.baseLevel,1);assert.equal(r.base.maxHp,C.BASE.hp);assert.equal(r.walls.length,0);
});
test('Shared structure upgrades cannot overspend under consecutive teammate requests',()=>{
  const {r,p}=setup();const other=r.addPlayer(ws(),'B','#fff');other.x=other.y=100;
  r.build('wall',300,100,p.id);r.build('wall',300,200,p.id);r.baseLevel=2;r.gold=C.structureUpgradeCost('wall',1);
  assert.equal(r.upgradeStructure(r.walls[0].id,p.id),true);
  assert.equal(r.upgradeStructure(r.walls[1].id,other.id),false);assert.equal(r.gold,0);
});
test('Only a cleared night increments the survival score',()=>{
  const {r}=setup();r.phase='wave';r.wave=4;r.queue=[];r.zombies=[];
  r.update(.01);assert.equal(r.completed,4);r.spawnWave();assert.equal(r.wave,5);assert.equal(r.completed,4);
  let message;for(const p of r.players.values())p.ws.send=data=>{message=JSON.parse(data)};
  r.gameOver();assert.equal(message.completed,4);assert.equal(message.wave,5);
});
test('Night report counts real damage even after repair, revives, kills and clutch state',()=>{
  const {r,p}=setup();const ally=r.addPlayer(ws(),'Rescuer','#fff');p.x=p.y=300;ally.x=310;ally.y=300;
  r.spawnWave();r.queue=[];r.damageBase(500);r.base.hp=r.base.maxHp;
  r.damagePlayer(p,1000);r.updatePlayers(C.PLAYER.reviveTime+.01);
  assert.equal(p.state,'alive');const z=enemy(r,'walker',600,600);r.hitZombie(z,10000,ally.id,true);
  const report=r.nightReport();assert.equal(report.baseDamage,500);assert.equal(report.downs,1);assert.equal(report.kills,1);
  assert.equal(report.rescuer.name,'Rescuer');assert.equal(report.rescuer.count,1);assert.equal(report.hunter.name,'Rescuer');
  p.hp=10;assert.equal(r.nightReport().clutch,true);
});
console.log('RESULT: '+count+' progression tests passed');
}finally{clearInterval(tickTimer);}
