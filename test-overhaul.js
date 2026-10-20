'use strict';
const assert=require('assert/strict');
const {Room,tickTimer}=require('./server');
const C=require('./public/game-core');
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS | '+name)};
const ws=()=>({readyState:1,send(){}});
function setup(n=1){const r=new Room('LAB');const p=Array.from({length:n},()=>r.addPlayer(ws(),'Test','#fff'));r.start();r.baseLevel=4;r.gold=100000;p.forEach(x=>{x.x=100;x.y=100});return {r,p:p[0],players:p}}
function zombie(r,type,x,y){r.wave=Math.max(1,r.wave);r.queue=[type];r.spawnZombie();const z=r.zombies.at(-1);Object.assign(z,{x,y,atk:0});return z}
try{
test('Silah satın almak önceki silahı ve şarjörünü korur; kuşanmak ücretsiz mermi vermez',()=>{
 const {r,p}=setup();p.ammo=3;r.buy('smg',p.id);p.ammo=7;r.equip(p,'pistol');assert.equal(p.ammo,3);r.equip(p,'smg');assert.equal(p.ammo,7);assert.deepEqual(p.owned,['pistol','smg']);
 const gold=r.gold;r.buy('smg',p.id);assert.equal(p.ammo,7);assert.equal(r.gold,gold);
});
test('Mermiler duvarın üzerinden geçer ve kareler arasındaki hızlı hedefi vurur',()=>{
 const {r,p}=setup();r.build('wall',400,200,p.id);const z=zombie(r,'walker',450,200);p.x=340;p.y=200;p.a=0;
 r.shoot(p,{...C.WEAPONS.pistol,speed:2000,spread:0,damage:20});r.updateBullets(.1);assert.equal(z.hp,35);assert.equal(r.walls[0].hp,C.BUILD.wall.hp);
});
test('Kapı oyuncuya açık, zombiye kapalı; barikat oyuncuyu durdurur',()=>{
 const {r,p}=setup();r.build('gate',400,200,p.id);assert.equal(r.solidForPlayer(400,200,16),false);
 const z=zombie(r,'walker',460,200);assert.equal(r.moveZombie(z,400,200,.1),r.walls[0]);r.build('wall',600,200,p.id);assert.equal(r.solidForPlayer(600,200,16),true);
});
test('Oyuncunun üzerine yapı konulamaz ve ölü karakter inşa edemez',()=>{
 const {r,p}=setup();assert.equal(r.build('wall',p.x,p.y,p.id),false);p.state='dead';assert.equal(r.build('wall',400,400,p.id),false);
});
test('Sökme yakınlık ister ve yalnızca sağlığa göre %40 iade eder',()=>{
 const {r,p}=setup();r.build('wall',400,200,p.id);assert.equal(r.salvage(400,200,p.id),false);p.x=400;p.y=260;r.walls[0].hp=C.BUILD.wall.hp/2;const gold=r.gold;assert.ok(r.salvage(400,200,p.id));assert.equal(r.gold,gold+Math.floor(C.BUILD.wall.cost*.4*.5));assert.equal(r.walls.length,0);
});
test('Tam duvarı onarmak yeni duvarın maliyetinden ucuzdur',()=>{
 assert.ok(Math.ceil(C.BUILD.wall.hp/C.SHOP.wallrepair.heal)*C.SHOP.wallrepair.cost<C.BUILD.wall.cost);
});
test('Zırhlı hasarı azaltır; Magnum zırhı deler',()=>{
 const {r,p}=setup();const z=zombie(r,'armored',400,400);const hp=z.hp;r.hitZombie(z,40,p.id);assert.ok(Math.abs(z.hp-(hp-22))<.001);r.hitZombie(z,40,p.id,true);assert.ok(Math.abs(z.hp-(hp-62))<.001);
});
test('Kriyo vuruşu yavaşlatır ve süre bittiğinde normal hıza döner',()=>{
 const {r,p}=setup();const z=zombie(r,'walker',400,400);r.hitZombie(z,1,p.id,false,2.5);assert.equal(z.slowT,2.5);r.updateZombies(.5);assert.equal(z.slowT,2);r.updateZombies(2);assert.equal(z.slowT,0);
});
test('Şifacı yakınındaki yaralı zombiyi iyileştirir',()=>{
 const {r}=setup();zombie(r,'healer',400,400);const z=zombie(r,'walker',430,400);z.hp=10;r.updateZombies(.1);assert.ok(z.hp>10);
});
test('Bomba alan hasarı birden çok hedefi etkiler ve dostu yaralamaz',()=>{
 const {r,p}=setup();const a=zombie(r,'walker',400,400),b=zombie(r,'walker',450,400);p.x=400;p.y=400;const hp=p.hp;r.blast(400,400,100,100,p.id);assert.ok(a.hp<=0&&b.hp<=0);assert.equal(p.hp,hp);assert.equal(p.kills,2);
});
test('Dikenli tel hasar verir; mayın bir kez patlar',()=>{
 const {r,p}=setup();r.build('spikes',400,400,p.id);const z=zombie(r,'walker',400,400);const hp=z.hp;r.updateZombies(.1);assert.ok(z.hp<hp&&z.slowT>0);
 r.build('mine',700,400,p.id);const a=zombie(r,'walker',700,400);r.updateZombies(.1);assert.ok(a.hp<=0);assert.equal(r.walls.filter(w=>w.kind==='mine').length,0);
});
test('Her taret kendi menzili ve etkisini kullanır',()=>{
 const {r,p}=setup();r.build('sniperTurret',400,400,p.id);zombie(r,'walker',950,400);r.updateTurrets(.1);assert.ok(r.bullets.some(b=>b.armorPierce&&b.dmg===C.BUILD.sniperTurret.damage));
});
test('Geliştirmeler kademelidir, üst sınırı vardır ve gece sonunda korunur',()=>{
 const {r,p}=setup();for(let i=0;i<4;i++)assert.ok(r.buy('vitality',p.id));assert.equal(p.maxHp,200);assert.equal(r.buy('vitality',p.id),false);r.buy('handling',p.id);r.startReload(p);assert.ok(p.reloadT<C.WEAPONS.pistol.reload);
 r.phase='wave';r.queue=[];r.zombies=[];p.hp=5;r.update(.1);assert.equal(p.hp,200);assert.equal(p.upgrades.vitality,4);
});
test('Gece ilerledikçe yeni davranışlar, can, hasar ve toplam tehdit artar',()=>{
 assert.ok(Object.keys(C.ZOMBIES).length>=10);assert.ok(C.waveComp(8).includes('healer'));assert.ok(C.waveComp(8).includes('berserker'));assert.ok(C.waveComp(8).includes('sapper'));assert.ok(C.waveComp(10).includes('boss'));
 assert.ok(C.waveComp(8).length>C.waveComp(2).length);assert.ok(C.scaleZombie('walker',8,1).hp>C.scaleZombie('walker',2,1).hp);assert.ok(C.scaleZombie('walker',8,1).dmg>C.scaleZombie('walker',2,1).dmg);
 assert.ok(C.BASE.r<80);assert.equal(C.WEAPON_ORDER.length,12);
});
console.log('SONUÇ: '+count+' oynanış ve denge testi geçti');
}finally{clearInterval(tickTimer)}

