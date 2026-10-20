'use strict';
const vm = require('vm');
const fs = require('fs');
const assert = require('assert/strict');
const G = require('./public/game-core');
const elements = new Map();
const gradient = {addColorStop(){}};
let depth=0,draws=0;
const ctx = new Proxy({save(){depth++},restore(){depth--},fill(){draws++},createRadialGradient(){return gradient}}, {get(o,k){return k in o ? o[k] : ()=>{}},set(o,k,v){o[k]=v;return true}});
function el(id){if(!elements.has(id)) elements.set(id,{value:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},addEventListener(){},getContext(){return ctx},appendChild(){},children:[],textContent:'',innerHTML:''});return elements.get(id)}
const sandbox={window:{GameCore:G},document:{getElementById:el,createElement:()=>el('temp')},innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>1000},addEventListener(){},localStorage:{getItem(){return ''},setItem(){}},requestAnimationFrame(){},setTimeout(){},console,location:{protocol:'http:',host:'localhost:3000'}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('./public/character-art.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('./public/client.js','utf8'),sandbox);
vm.runInContext(`myId=1; enterGame(); onSnapshot({t:'s',g:250,w:0,p:'prep',ti:12,bh:3000,bmh:3000,L:[],Z:[],B:[],A:[],P:[{i:1,x:1390,y:800,c:'#fff',n:'Test',s:'alive',w:'pistol',mz:14,rl:0,hp:100,mh:100,k:0}],ev:[]}); render(1000);`,sandbox);
assert.equal(depth,0,'Canvas save/restore must balance');
assert.ok(draws>5,'Player and arena should render');
vm.runInContext(`snapPrev=snapNext; render(1033); keys.add('Tab'); showScore=true; renderScore();`,sandbox);
assert.equal(depth,0);
assert.ok(elements.get('scoreboard').innerHTML.includes('Test'));
console.log('PASS | browser snapshot interpolation, character rendering, balanced canvas and scoreboard');

let shopWrites = 0;
let shopHtml = elements.get('shop').innerHTML;
Object.defineProperty(elements.get('shop'), 'innerHTML', {get(){return shopHtml},set(v){shopWrites++;shopHtml=v}});
vm.runInContext('openShop(); renderShop(); renderShop();',sandbox);
assert.equal(shopWrites,1,'Identical snapshots must preserve shop buttons during a click');
vm.runInContext('gold -= 50; renderShop();',sandbox);
assert.equal(shopWrites,2,'Shop must update after shared money changes');
console.log('PASS | shop buttons remain stable across snapshots and update when money changes');

vm.runInContext("placement='wall'; toggleShop();",sandbox);
assert.equal(vm.runInContext('placement',sandbox),null,'B must exit placement instead of reopening a ghost');
vm.runInContext("openShop(); placement='gate'; closeShop();",sandbox);
assert.equal(vm.runInContext('placement',sandbox),null,'Closing market must cancel construction');
vm.runInContext("for(const kind of Object.keys(G.BUILD))drawWall({kind,k:G.BUILD[kind].turret?1:0,x:500,y:500,w:G.BUILD[kind].w,h:G.BUILD[kind].h,hp:G.BUILD[kind].hp,mh:G.BUILD[kind].hp});",sandbox);
vm.runInContext("for(const t of Object.keys(G.ZOMBIES))drawZombie({i:1,t,x:100,y:100,hp:10,mh:100},1000);",sandbox);
assert.equal(depth,0);
console.log('PASS | closing construction, all new structure and enemy renderers');

vm.runInContext(`for(const outfits of G.APPEARANCE.outfits) for(const heads of G.APPEARANCE.heads) for(const bottoms of G.APPEARANCE.bottoms) for(const skins of G.APPEARANCE.skins) for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) for(const down of [false,true]) window.CharacterArt.draw(ctx,{outfits:outfits.id,heads:heads.id,bottoms:bottoms.id,colors:'ivory',headColors:'crimson',bottomColors:'teal',skins:skins.id},angle,1.2,1,down);`,Object.assign(sandbox,{ctx}));
assert.equal(depth,0,'All survivor outfits, headings and down poses balance canvas state');
console.log('PASS | all survivor outfits, headwear, skin tones, aim directions and down poses');

vm.runInContext("baseLevel=1;shopTab='weapons';renderShop();",sandbox);
assert.ok(shopHtml.includes('ÜS SEVİYESİ YETERSİZ · 3'));
vm.runInContext("baseLevel=3;completedNights=10;shopTab='base';renderShop();",sandbox);
assert.ok(shopHtml.includes('Son Hat')&&shopHtml.includes('data-buy="baselevel"'));
vm.runInContext("wallsLive=[{id:8,kind:'wall',x:pred.x+100,y:pred.y,lv:2,hp:200,mh:396}];shopTab='structures';renderShop();",sandbox);
assert.ok(shopHtml.includes('YAPI #8 · SEVİYE 2')&&shopHtml.includes('data-structure="8"'));
console.log('PASS | locked shop tiers, base progression and individual structure upgrade cards');
