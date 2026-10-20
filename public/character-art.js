/* Shared survivor art: a standing human silhouette seen from above at a slight angle. */
(function () {
  'use strict';
  const G = window.GameCore;
  function shade(color,amount){return '#'+color.slice(1).match(/../g).map(v=>Math.round(Math.max(0,Math.min(255,parseInt(v,16)+amount))).toString(16).padStart(2,'0')).join('');}
  function palette(appearance){const ap=G.sanitizeAppearance(appearance),find=key=>G.APPEARANCE[key].find(v=>v.id===ap[key]).value;return {ap,upper:find('colors'),head:find('headColors'),lower:find('bottomColors'),skin:find('skins')};}
  function draw(ctx, appearance, aim, stride = 0, movement = 0, down = false) {
    const {ap,upper:color,head,lower,skin}=palette(appearance);
    const box = (x,y,w,h,c,r=2) => {ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
    const oval = (x,y,rx,ry,c) => {ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
    ctx.save();
    // Small, translucent contact shadow; no opaque puddle under the survivor.
    oval(2,15,16,6,'rgba(0,0,0,.10)');
    oval(1,16,10,3,'rgba(0,0,0,.12)');
    if(down){ctx.rotate(-1.15);ctx.scale(1,.72);}
    const step = Math.sin(stride) * 5.5 * movement;
    const bob = Math.abs(Math.sin(stride)) * 1.2 * movement;
    // Separate trouser legs, knee pads and boots remain visible below the jacket.
    for(const side of [-1,1]) {
      const foot = step * side;
      const bare=['shorts','skirt','pleated'].includes(ap.bottoms);
      box(side < 0 ? -11 : 3,5+foot,8,16,bare?skin:lower,3);
      if(ap.bottoms==='cargo'){box(side < 0 ? -12 : 4,9+foot,8,6,shade(lower,22),1);}
      if(ap.bottoms==='jeans'){box(side < 0 ? -10 : 4,7+foot,1,13,shade(lower,45),0);}
      box(side < 0 ? -12 : 2,19+foot,11,7,'#111c22',2);
      box(side < 0 ? -11 : 3,20+foot,9,2,'#60716c',1);
    }
    ctx.translate(0,-bob);
    if(ap.bottoms==='shorts') {box(-12,5,11,8,lower);box(1,5,11,8,lower);}
    if(ap.bottoms==='skirt'||ap.bottoms==='pleated'){
      ctx.fillStyle=lower;ctx.beginPath();ctx.moveTo(-11,3);ctx.lineTo(11,3);ctx.lineTo(17,17);ctx.lineTo(-17,17);ctx.closePath();ctx.fill();
      box(-16,15,32,2,shade(lower,-22),0);
      if(ap.bottoms==='pleated')for(let i=-10;i<=10;i+=5)box(i,7,2,9,shade(lower,30),0);
    }
    box(-14,-14,28,27,'#172626',7);
    box(-13,-15,26,25,color,6);
    // Sleeves have shoulder seams and cuffs, instead of a circular body.
    for(const side of [-1,1]) {
      box(side < 0 ? -19 : 11,-12,9,20,color,4);
      box(side < 0 ? -19 : 11,1,9,4,'#31443e',1);
      oval(side*14,7,4,4,skin);
      box(side < 0 ? -17 : 12,-10,5,3,'#d9e0c577',1);
    }
    box(-13,7,26,4,'#26352e',1);box(-2,7,4,4,'#b8b390',1);
    if(ap.outfits==='heavy') {
      box(-12,-12,24,19,shade(color,-35),4);box(-9,-10,18,12,shade(color,20),3);
      box(-7,-8,14,2,'#b1beb8',1);box(-11,2,9,5,'#283c40',1);box(2,2,9,5,'#283c40',1);
    } else if(ap.outfits==='hazmat') {
      box(-3,-13,6,20,'#e5cf69',1);box(-13,-5,26,3,'#e5cf69',1);
      oval(0,-2,4,4,'#34443c');box(-1,-5,2,6,'#e5cf69',0);
      box(11,-10,5,12,'#b1c8b0',2);
    } else if(ap.outfits==='hoodie') {
      box(-9,0,18,6,shade(color,-22),3);box(-4,-12,1,9,'#e4dfc2',0);box(3,-12,1,9,'#e4dfc2',0);
    } else if(ap.outfits==='coat') {
      box(-14,-8,12,24,shade(color,-10),2);box(2,-8,12,24,shade(color,-10),2);
      box(-10,-13,8,5,shade(color,25));box(2,-13,8,5,shade(color,25));
      for(let i=-5;i<=8;i+=6)oval(0,i,1,1,'#d8c599');
    } else {
      box(-10,-12,8,19,shade(color,-35),2);box(2,-12,8,19,shade(color,-35),2);
      box(-9,-3,6,7,shade(color,12),1);box(3,-3,6,7,shade(color,12),1);
      box(-9,-10,6,2,'#b0b99a',1);
      if(ap.outfits==='medic'){box(-7,-12,14,13,'#e1e5d2',2);box(-2,-10,4,9,'#b44853',0);box(-5,-7,10,3,'#b44853',0);}
    }
    // A raised head, ears, hair/neck and a face directed toward the crosshair.
    oval(0,-15,7,6,'#23332b');oval(-8,-20,2,3,skin);oval(8,-20,2,3,skin);
    oval(0,-21,9,10,skin);
    const fx=Math.cos(aim),fy=Math.sin(aim);
    oval(fx*6,-21+fy*5,3,2,skin);
    if(ap.heads==='helmet') {
      oval(0,-25,11,9,shade(head,-40));oval(-1,-27,10,7,head);
      box(-2,-33,4,11,'#a7b69b',1);box(-11,-22,22,3,'#233a34',1);
      box(7,-27,4,5,'#d2cd9a',1);
    } else if(ap.heads==='beret') {
      oval(-3,-28,12,6,head);oval(-5,-30,9,4,shade(head,25));
      box(-10,-24,19,3,'#342632',1);box(4,-29,4,4,'#eed083',1);
    } else if(ap.heads==='hood') {
      oval(0,-24,12,12,head);oval(fx*3,-21+fy*2,7,7,shade(head,-45));
      oval(fx*4,-20+fy*2,5,5,skin);box(-9,-15,5,7,head,2);box(4,-15,5,7,head,2);
    } else if(ap.heads==='cap') {
      oval(0,-27,10,7,head);box(-2,-29,4,4,shade(head,40));
      oval(fx*10,-23+fy*5,8,3,shade(head,-20));
    } else if(ap.heads==='beanie') {
      oval(0,-28,10,9,head);box(-10,-24,20,5,shade(head,-25));oval(0,-37,4,3,shade(head,20));
      for(let i=-6;i<=6;i+=4)box(i,-33,1,8,shade(head,25),0);
    } else if(ap.heads==='cowboy') {
      oval(0,-25,17,5,shade(head,-15));box(-10,-35,20,11,head,4);box(-10,-28,20,3,shade(head,-50),0);
    } else {
      oval(-1,-28,9,5,'#3f302d');
      if(ap.heads==='headphones'){
        ctx.strokeStyle=head;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-25,11,Math.PI,Math.PI*2);ctx.stroke();
        box(-13,-25,5,10,head);box(8,-25,5,10,head);
      }
    }
    if(ap.outfits==='hazmat') {box(-7,-22,14,5,'#8ce0cf',2);box(-4,-16,8,5,'#253c40',2);}
    // The two body hands are drawn above; the weapon never adds extra hands.
    ctx.save();ctx.translate(0,-3);ctx.rotate(aim);
    box(5,-4,23,7,'#111c24',2);box(13,-5,12,3,'#657a7c',1);
    box(26,-3,12,3,'#b0bcb3',1);box(10,2,5,7,'#263b3e',1);
    box(20,-6,4,2,'#b9caaf',0);
    ctx.restore();ctx.restore();
  }
  window.CharacterArt = {draw,palette,shade};
})();
