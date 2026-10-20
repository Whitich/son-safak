(function(){
  'use strict';
  const G=window.GameCore,cache=new Map();
  const path=(d,fill,stroke='#15262b',width=2)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round"/>';
  const rect=(x,y,w,h,c,r=3)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+c+'"/>';
  const circle=(x,y,r,c)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/>';
  function weapon(id){
    const d=G.WEAPONS[id],c=d.color,handgun=['pistol','revolver'].includes(id),long=['rifle','lmg','launcher'].includes(id);
    let art=path(handgun?'M62 42h20l-5 29H60z':'M35 42h25l-9 25H34z','#42534d');
    if(!handgun)art+=path('M12 27h29v19H25l-13 9z','#68776b')+rect(46,23,62,24,'#344952')+rect(48,26,53,5,'#8a9b98');
    else art+=rect(51,28,56,18,'#4e626b')+rect(55,29,49,4,'#a1b2ad');
    art+=rect(handgun?100:105,29,long?43:handgun?22:29,9,'#aebbb1')+rect(long?143:handgun?119:130,27,8,13,'#354a50');
    if(!handgun)art+=path(id==='lmg'?'M61 44h28v25H61z':'M65 45h14l-3 22H64z','#273a40');
    if(id==='revolver')art+=circle(83,39,11,'#71827f')+circle(83,39,5,'#263941');
    if(id==='shotgun')art+=rect(88,39,35,10,'#9d7955')+rect(94,40,3,8,'#d1aa75')+rect(108,40,3,8,'#d1aa75');
    if(id==='rifle')art+=rect(61,15,41,8,'#1b3038')+circle(98,19,6,c)+rect(74,20,6,7,'#758681');
    if(id==='smg')art+=path('M38 23V13h20v5H44v8','#81918b');
    if(id==='carbine')art+=path('M61 24V14h30v10h-6v-5H67v5','#90a29b');
    if(id==='lmg')art+=rect(57,44,35,27,'#6b7254')+rect(61,48,27,4,'#b7b68c');
    if(id==='launcher')art+=rect(70,26,61,29,'#74765c',9)+circle(125,40,14,'#202e35')+circle(125,40,8,'#b19665');
    if(['frost','laser','arc'].includes(id)){
      art+=rect(55,27,46,18,'#283341')+rect(61,30,32,10,c);
      if(id==='arc')art+=path('M110 23l17-8 13 9-13 8 13 9-14 9-17-8','none',c,4);
      if(id==='laser')art+=circle(132,34,9,'#6b3448')+circle(132,34,5,c)+rect(76,18,15,8,c);
      if(id==='frost')art+=path('M75 29v12m-6-10 12 8m-12 0 12-8','none','#d9ffff',2);
    }
    if(id==='flame')art+=rect(44,48,19,25,'#ad774c',7)+rect(47,45,13,6,'#e4c68d')+path('M136 22q17 15 2 25-13-7-2-25',c);
    return art+rect(handgun?57:48,35,handgun?8:13,3,c);
  }
  function structure(id,level=1){
    const d=G.BUILD[id];let art='';
    if(d.turret){
      art=path('M43 57l37-16 40 16-38 20z','#273b44')+path('M48 42l32-12 34 12v18L81 72 48 59z','#526877')+circle(81,42,17,'#283d46');
      const c=id==='frostTurret'?'#8fe8ff':id==='sniperTurret'?'#d4aeff':'#b7d4a3';
      art+=path('M81 34l49-20 6 12-48 23z','#a5b8b6')+circle(81,41,8,c);
      if(id==='sniperTurret')art+=path('M111 20l32-12 4 8-32 12z',c);
      if(id==='frostTurret')art+=rect(61,47,7,12,c)+rect(94,47,7,12,c);
    }else if(id==='mine')art=path('M42 48q36-30 77 0v13q-37 24-77 0z','#a08b5b')+rect(65,29,34,18,'#384c46')+circle(83,33,5,'#ef775e');
    else if(id==='spikes'){
      art=path('M17 54l94-29 34 17-94 30z','#495a5b');
      for(let i=0;i<7;i++)art+=path('M'+(31+i*13)+' '+(49-i*3)+'l-6-18 15 13z','#a9b8ac');
    }else if(d.mesh){
      art=rect(31,16,98,56,'#334c4c');
      for(let i=0;i<8;i++)art+=path('M'+(35+i*12)+' 21v44','none','#9ebbb3',2);
      for(let i=0;i<4;i++)art+=path('M35 '+(25+i*12)+'h88','none','#829e97',2);
      art+=rect(26,12,8,64,'#b0c1b5')+rect(126,12,8,64,'#b0c1b5');
    }else{
      art=path('M25 31l80-18 31 20-81 21z','#9caaa0')+path('M25 31l30 23v25L25 57z','#45565d')+path('M55 54l81-21v26L55 79z',id==='reinforced'?'#627783':'#687a70');
      if(id==='reinforced')art+=path('M63 55l64-15m-64 31 64-29','none','#bbc6bb',5);
      if(id==='gate')art+=path('M77 49v22m33-32v24','none','#b7dca6',5)+path('M86 56h16m-5-4 5 4-5 4','none','#d1e9b6',2);
      if(id==='wall')art+=path('M57 65l76-20M79 49v11m27-18v11m-15 3v12','none','#3d5457',2);
    }
    return art+(level>1?rect(119,58,30,19,'#d2bf83')+'<text x="134" y="72" text-anchor="middle" font-size="11" fill="#233837">'+level+'</text>':'');
  }
  function support(id){
    if(id==='medkit'||id==='teammed')return (id==='teammed'?rect(37,23,79,45,'#314a43'):'')+rect(44,32,82,42,'#789c76')+path('M64 32v-9h39v9','none','#b7c6ac',5)+rect(77,39,15,28,'#ecdfc0')+rect(69,48,31,10,'#ecdfc0');
    if(id==='ammo'||id==='teamammo'){let art=id==='teamammo'?rect(31,26,101,48,'#667952')+rect(31,36,101,5,'#a4af84'):'';for(let i=0;i<5;i++)art+=path('M'+(48+i*14)+' 65v-30l5-12 5 12v30z','#d5b273');return art;}
    return rect(43,42,76,28,'#7d8461')+rect(57,35,47,10,'#bac3a3')+path(id==='baserepair'?'M57 32V18l23-10 23 10v14M79 15v15M69 23h21':'M92 16l-10 6 1 11-25 24 7 7 26-25 11 1 7-10-13 1-6-7z','none','#c3d3c7',6);
  }
  function upgrade(id){
    const shapes={
      vitality:()=>path('M80 68L49 43q-15-26 9-29 15-1 22 12 10-18 26-11 22 9 5 31z','#c1767d')+path('M52 39h15l7-13 11 27 8-15h17','none','#f0dcc2',3),
      mobility:()=>path('M57 13h28v31l27 10v17H43V56l14-9z','#94aa85')+path('M35 23h16m-25 12h24m-18 11h16','none','#b3d4a0',3),
      power:()=>path('M66 68V30l14-19 14 19v38z','#dab778')+path('M98 17l14 8-11 8 13 8-15 11','none','#d6e7b1',3),
      handling:()=>rect(59,25,41,45,'#899a85')+path('M49 26q27-27 54-6l-2-13m2 13-14-1M111 56q-25 27-54 6l1 13m-1-13 14 1','none','#d0d9ad',4),
      recovery:()=>path('M80 9l32 13v22q-5 23-32 32-27-9-32-32V22z','#579f8d')+path('M80 24v33M64 40h32','none','#d2e7c5',8),
      fortification:()=>structure('reinforced',3),sentry:()=>structure('turret',3)
    };return shapes[id]();
  }
  function svg(category,id,level=1){
    const key=category+':'+id+':'+level;if(cache.has(key))return cache.get(key);
    const d=category==='weapons'?G.WEAPONS[id]:category==='build'?G.BUILD[id]:category==='support'?G.SHOP[id]:category==='upgrades'?G.UPGRADES[id]:G.BASE_LEVELS[level-1];
    let art=category==='weapons'?weapon(id):category==='build'?structure(id,level):category==='support'?support(id):category==='upgrades'?upgrade(id):'';
    if(category==='base'){
      art=path('M33 34l47-24 49 24-49 24z','#789687')+path('M33 34l47 24v23L33 57z','#344e50')+path('M80 58l49-24v23L80 81z','#4d6f68')+rect(69,27,24,24,'#9ac9b6');
      for(let i=0;i<level;i++)art+=rect(42+i*21,59-i*2,10,6,'#d8cb95');
      if(level>2)art+=path('M43 29V12h15v10m47 0V12h14v17','none','#b7c9b2',5);
    }
    const result='<svg class="productImage" viewBox="0 0 160 90" role="img" aria-label="'+d.name+' görseli"><ellipse cx="81" cy="77" rx="62" ry="5" fill="#06101666"/>'+art+'</svg>';
    cache.set(key,result);return result;
  }
  window.MarketArt={svg};
})();
