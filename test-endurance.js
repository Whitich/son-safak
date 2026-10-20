'use strict';
// Reproducible endgame benchmark: all upgrades, 10 tier-4 turrets and 40 tier-4
// steel walls, but no player shooting, repairs or rebuilding. Not a predicted
// survival score for an active player.
const assert=require('assert/strict'),C=require('./public/game-core');
const {Room,tickTimer}=require('./server');
const random=Math.random;
try{
  for(const initialSeed of [17,42,91]){
    let seed=initialSeed;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const r=new Room('AFK'),p=r.addPlayer({readyState:1,send(){}},'AFK','#fff');r.start();
    r.baseLevel=4;r.gold=1e7;r.base.hp=r.base.maxHp=C.BASE_LEVELS[3].hp;
    p.x=r.base.x;p.y=r.base.y;
    for(const [key,d] of Object.entries(C.UPGRADES))r.upgrades[key]=d.max;
    p.maxHp=p.hp=C.PLAYER.hp+25*r.upgrades.vitality;
    for(let i=0;i<10;i++){const a=i*Math.PI*2/10;assert.ok(r.build(i%4===0?'frostTurret':'sniperTurret',r.base.x+Math.cos(a)*220,r.base.y+Math.sin(a)*220,p.id));}
    for(let i=0;i<40;i++){const a=i*Math.PI*2/40;assert.ok(r.build('reinforced',r.base.x+Math.cos(a)*500,r.base.y+Math.sin(a)*500,p.id));}
    for(const w of r.walls){w.level=4;const s=C.structureStats(w.kind,4,r.upgrades.fortification);w.hp=w.maxHp=s.hp;if(C.BUILD[w.kind].turret)w.range=s.range;}
    let steps=0,peak=0;
    while(r.state==='playing'&&r.wave<=35&&steps<150000){if(r.phase==='prep')r.timer=0;r.update(.1);peak=Math.max(peak,r.zombies.length);r.events=[];steps++;}
    console.log(JSON.stringify({seed:initialSeed,completed:r.completed,defeatedOn:r.wave,state:r.state,peakEnemies:peak,simulationSeconds:steps/10}));
    assert.equal(r.state,'over','A fully upgraded passive fortress must eventually lose');
    assert.ok(r.wave<=35,'Endgame must not allow unattended survival forever');
  }
}finally{Math.random=random;clearInterval(tickTimer);}

