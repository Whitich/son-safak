/* Shared infected silhouettes for the battlefield and bestiary. */
(function(){
  'use strict';
  const G=window.GameCore,shade=window.CharacterArt.shade;
  function draw(ctx,type,angle=0,stride=0,time=0,rage=false){
    const def=G.ZOMBIES[type]||G.ZOMBIES.walker;
    const scale=def.r/16,skin=type==='boss'?'#a76b73':type==='berserker'?'#bb7785':type==='spitter'?'#8fa87a':'#91a17c';
    const cloth=shade(def.color,-65),pulse=Math.sin(time*.004),step=Math.sin(stride);
    const oval=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
    const poly=(points,c)=>{ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
    const line=(points,c,width)=>{ctx.strokeStyle=c;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
    const claw=(x,y,side)=>{for(let i=0;i<3;i++)line([[x,y+i*side*2],[x+4,y+side*(i*2+2)]],'#d0c69c',1.2);};
    ctx.save();
    oval(1,def.r*.48,def.r*.95,def.r*.35,'rgba(0,0,0,.14)');
    ctx.rotate(angle);ctx.scale(scale,scale);
    const crawl=type==='swarm',lean=type==='runner'?3:0;
    // Uneven trailing limbs and reaching claws give the infected a low silhouette.
    for(const side of [-1,1]){
      const gait=step*side*(crawl?5:3);
      line([[-7,side*6],[-17+gait,side*9],[-21+gait,side*7]],'#26342c',5);
      line([[-18+gait,side*9],[-22+gait,side*7]],'#6d7d60',2);
      const arm=type==='brute'&&side===1?10:5;
      line([[-1,side*10],[8+lean,side*(14+gait*.4)],[16+lean+gait*.4,side*12]],shade(skin,-25),arm);
      oval(15+lean+gait*.4,side*12,3.5,3,skin);claw(17+lean+gait*.4,side*12,side);
    }
    poly([[-15,-8],[-8,-14],[3,-12],[10,-5],[8,8],[1,13],[-9,11],[-14,5],[-10,2]],cloth);
    // Torn hems, exposed spine and a lopsided shoulder replace clean uniforms.
    poly([[-14,-6],[-19,-9],[-16,-1],[-20,3],[-12,6]],shade(cloth,25));
    oval(-2,-3,9,9,shade(skin,-15));
    line([[-9,-1],[-4,-2],[1,-1]],shade(skin,35),2);
    for(let i=0;i<3;i++)line([[-7+i*4,-4],[-5+i*4,2]],'#4c5c44',1);
    poly([[-10,5],[-4,3],[-1,9],[-5,12]],'#70494a');
    if(type==='runner'){
      poly([[-10,-11],[-5,-16],[5,-10],[0,-8]],'#bcac5d');
      line([[-15,6],[-5,8],[2,5]],'#d1c37a',2);
    }
    if(crawl){
      oval(-5,0,12,9,'#778d4a');
      for(const side of [-1,1])line([[-8,side*5],[-16,side*(15+step*2)],[-8,side*19]],'#adc27a',3);
      for(let i=0;i<3;i++)oval(-11+i*5,-2,2,3,'#bbcc84');
    }
    if(type==='armored'){
      poly([[-13,-10],[-4,-14],[5,-9],[3,9],[-9,12],[-15,3]],'#536d79');
      poly([[-10,-7],[-3,-10],[2,-6],[0,5],[-8,8]],'#8b9d9d');
      line([[-4,-9],[-7,-2],[-3,2],[-6,7]],'#253b44',2);
      for(const y of [-8,8])oval(-9,y,1.4,1.4,'#cbd0b8');
    }
    if(type==='brute'||type==='boss'){
      oval(-4,-5,13,11,skin);oval(1,10,9,7,shade(skin,-15));
      line([[-12,-6],[-2,-5],[4,-1]],'#624c48',2);
      for(let i=0;i<4;i++)line([[-10+i*4,-8],[-11+i*4,-3]],'#d0bd9a',1);
      for(const [x,y] of [[-10,-12],[-4,-14],[3,-11]])poly([[x-3,y+4],[x,y-6],[x+3,y+3]],'#d2c49d');
      if(type==='boss'){
        poly([[-16,4],[-23,9],[-14,10]],'#dfc6a4');
        line([[1,9],[10,16],[21,13]],'#854752',10);claw(23,13,1);
        oval(-6,0,5,4,'#6b3c4b');line([[-8,-2],[-4,2]],'#ed917d',2);
      }
    }
    if(type==='spitter'||type==='mortar'){
      for(const [x,y,r] of [[-8,-5,7],[-9,6,6],[-16,1,5]]){
        oval(x,y,r,r*(1+.04*pulse),'#5d7750');oval(x-1,y-1,r*.65,r*.65,type==='mortar'?'#d9a567':'#b6cd6c');
        oval(x-2,y-2,1.5,1.5,'#e2e3a7');
      }
      if(type==='mortar'){
        line([[-11,-5],[-15,-14],[-9,-19]],'#775548',7);
        oval(-9,-19,5,3,'#362d2d');oval(-9,-19,2.5,1.5,'#e3b875');
      }
    }
    if(type==='healer'){
      for(const [x,y,r] of [[-13,-6,5],[-7,-13,6],[-14,4,4]]){
        line([[x+3,y+5],[x,y]],'#a3be9b',2);oval(x,y,r,r*.65,'#66bca1');
        line([[x-r*.6,y],[x+r*.6,y]],'#b7ead0',1.4);
      }
      oval(-4,3,3,4,'#c1e3a7');
    }
    if(type==='sapper'){
      line([[-11,-10],[5,7]],'#554337',4);
      poly([[-11,-4],[-2,-7],[1,5],[-8,8]],'#bf8b4d');
      line([[-8,-3],[-6,5]],'#efc781',2);
      line([[8,13],[19,18]],'#665548',4);poly([[15,13],[23,12],[27,20],[18,23]],'#a4aaa0');
    }
    if(type==='berserker'){
      line([[-10,-7],[-1,-2],[3,8]],rage?'#ffac82':'#e39698',3);
      for(const side of [-1,1])poly([[7,side*13],[9,side*21],[13,side*13]],'#d5b8a0');
    }
    if(type==='disruptor'){
      for(const side of [-1,1]){
        line([[-10,side*6],[-13,side*16],[-6,side*20]],'#5d526c',4);
        oval(-6,side*20,3,3,'#c8a0e7');
        line([[-10,side*14],[-4,side*16]],'#d9bfee',1.5);
      }
      line([[-10,0],[-4,-2],[0,0]],'#c79fdf',3);
    }
    // Angular bald skull, sunken sockets, split jaw and small teeth.
    poly([[6,-8],[14,-9],[20,-4],[21,3],[16,9],[8,8],[4,2]],shade(skin,-30));
    poly([[8,-7],[15,-7],[19,-2],[17,5],[9,6],[6,0]],skin);
    line([[17,-4],[20,-2]],'#293129',3);line([[16,4],[19,3]],'#293129',3);
    oval(18,-3,1.4,1.1,type==='boss'?'#ffcc7a':def.color);oval(18,3,1.4,1.1,def.color);
    poly([[19,-1],[24,-2],[25,3],[20,5],[18,2]],'#3f2b30');
    for(let i=0;i<3;i++)line([[21+i*1.3,-.5],[21+i*1.3,1]],'#dccdb0',.9);
    if(type==='spitter'||type==='mortar'){
      line([[23,3],[27,6],[25,10]],'#bcd46b',2);oval(25,10,1.6,2,'#d0e57d');
    }
    ctx.restore();
  }
  window.ZombieArt={draw};
})();
