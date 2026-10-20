'use strict';
const assert=require('assert/strict'),C=require('./public/game-core');
const {Room,tickTimer}=require('./server');
function setup(){const r=new Room('COVER'),p=r.addPlayer({readyState:1,send(){}},'A','#fff');r.start();r.baseLevel=4;r.gold=100000;p.x=p.y=100;return {r,p};}
function enemy(r,x,y){r.wave=1;r.queue=['walker'];r.spawnZombie();const z=r.zombies.at(-1);Object.assign(z,{x,y,atk:0,hp:1000,maxHp:1000});return z;}
function bullet(r,x,y,angle=0,pierce=0,owner=-1){r.bullets.push({x,y,vx:Math.cos(angle)*2000,vy:Math.sin(angle)*2000,life:1,dmg:20,owner,pierce,a:angle});}
let tests=0;function test(name,fn){fn();tests++;console.log('PASS | '+name);}
try{
test('Every turret respects wall, steel barricade and gate line of sight',()=>{
  for(const turret of ['turret','sniperTurret','frostTurret'])for(const kind of ['wall','reinforced','gate']){
    const {r,p}=setup();r.build(turret,400,400,p.id);r.build(kind,500,400,p.id);enemy(r,600,400);
    r.updateTurrets(.1);assert.equal(r.bullets.length,0,turret+' behind '+kind);assert.equal(r.walls[0].heat,0);
  }
});
test('Turret chooses a visible alternative instead of a closer blocked zombie',()=>{
  const {r,p}=setup();r.build('turret',400,400,p.id);r.build('wall',500,400,p.id);
  enemy(r,550,400);enemy(r,400,650);r.updateTurrets(.1);
  assert.equal(r.bullets.length,1);assert.ok(Math.abs(r.bullets[0].a-Math.PI/2)<1e-8);
});
test('All turret projectiles pass iron fence and hit enemies',()=>{
  for(const turret of ['turret','sniperTurret','frostTurret']){
    const {r,p}=setup();r.build(turret,400,400,p.id);r.build('fence',500,400,p.id);const z=enemy(r,600,400);
    r.updateTurrets(.1);assert.equal(r.bullets.length,1);r.updateBullets(.3);assert.ok(z.hp<1000);
    assert.equal(r.walls[1].hp,C.BUILD.fence.hp);
  }
});
test('A wall built after firing intercepts fast bullets without friendly damage',()=>{
  const {r,p}=setup();bullet(r,400,400);r.build('wall',500,400,p.id);const z=enemy(r,650,400);
  r.updateBullets(.2);assert.equal(z.hp,1000);assert.equal(r.bullets.length,0);assert.equal(r.walls[0].hp,C.BUILD.wall.hp);
});
test('Piercing shot hits enemies before cover and stops before enemies behind it',()=>{
  const {r,p}=setup();r.build('reinforced',600,400,p.id);const front=enemy(r,500,400),back=enemy(r,700,400);
  bullet(r,400,400,0,2);r.updateBullets(.2);assert.equal(front.hp,980);assert.equal(back.hp,1000);assert.equal(r.bullets.length,0);
});
test('Diagonal crossing and zero horizontal velocity cannot tunnel through cover',()=>{
  for(const angle of [Math.PI/4,Math.PI/2]){
    const {r,p}=setup(),dx=Math.cos(angle),dy=Math.sin(angle);r.build('wall',400+dx*120,400+dy*120,p.id);
    const z=enemy(r,400+dx*250,400+dy*250);bullet(r,400,400,angle);r.updateBullets(.2);assert.equal(z.hp,1000);
  }
});
test('Player bullets still pass friendly walls',()=>{
  const {r,p}=setup();r.build('wall',500,400,p.id);const z=enemy(r,650,400);bullet(r,400,400,0,0,p.id);r.updateBullets(.2);assert.equal(z.hp,980);
});
test('Fence blocks movement, costs more than walls, upgrades, and lets acid through',()=>{
  const {r,p}=setup();assert.ok(C.BUILD.fence.cost>C.BUILD.wall.cost);assert.equal(C.BUILD.fence.solid,true);
  r.build('fence',500,400,p.id);const w=r.walls[0],z=enemy(r,450,400);
  assert.equal(r.moveZombie(z,480,400,.1),w);assert.equal(r.upgradeStructure(w.id,p.id),false);
  p.x=400;p.y=400;assert.equal(r.upgradeStructure(w.id,p.id),true);
  r.acids=[{x:450,y:400,vx:300,vy:0,dmg:20,life:2}];r.updateAcids(.2);
  assert.equal(r.acids.length,1);assert.equal(w.hp,w.maxHp);
});
console.log('RESULT: '+tests+' turret-cover tests passed');
}finally{clearInterval(tickTimer);}
