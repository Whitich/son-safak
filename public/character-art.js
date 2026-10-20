/* Shared survivor art: a standing human silhouette seen from above at a slight angle. */
(function () {
  'use strict';
  const G = window.GameCore;
  function draw(ctx, appearance, aim, stride = 0, movement = 0, down = false) {
    const ap = G.sanitizeAppearance(appearance);
    const color = G.APPEARANCE.colors.find(v => v.id === ap.colors).value;
    const skin = G.APPEARANCE.skins.find(v => v.id === ap.skins).value;
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
      box(side < 0 ? -11 : 3,5+foot,8,16,'#253338',3);
      box(side < 0 ? -10 : 4,11+foot,6,5,ap.outfits==='heavy'?'#758286':'#3d4e4b',1);
      box(side < 0 ? -12 : 2,19+foot,11,7,'#111c22',2);
      box(side < 0 ? -11 : 3,20+foot,9,2,'#60716c',1);
    }
    ctx.translate(0,-bob);
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
      box(-12,-12,24,19,'#46585e',4);box(-9,-10,18,12,'#78898b',3);
      box(-7,-8,14,2,'#b1beb8',1);box(-11,2,9,5,'#283c40',1);box(2,2,9,5,'#283c40',1);
    } else if(ap.outfits==='hazmat') {
      box(-3,-13,6,20,'#e5cf69',1);box(-13,-5,26,3,'#e5cf69',1);
      oval(0,-2,4,4,'#34443c');box(-1,-5,2,6,'#e5cf69',0);
      box(11,-10,5,12,'#b1c8b0',2);
    } else {
      box(-10,-12,8,19,'#354b3b',2);box(2,-12,8,19,'#354b3b',2);
      box(-9,-3,6,7,'#718366',1);box(3,-3,6,7,'#718366',1);
      box(-9,-10,6,2,'#b0b99a',1);
    }
    // A raised head, ears, hair/neck and a face directed toward the crosshair.
    oval(0,-15,7,6,'#23332b');oval(-8,-20,2,3,skin);oval(8,-20,2,3,skin);
    oval(0,-21,9,10,skin);
    const fx=Math.cos(aim),fy=Math.sin(aim);
    oval(fx*6,-21+fy*5,3,2,skin);
    if(ap.heads==='helmet') {
      oval(0,-25,11,9,'#283d36');oval(-1,-27,10,7,color);
      box(-2,-33,4,11,'#a7b69b',1);box(-11,-22,22,3,'#233a34',1);
      box(7,-27,4,5,'#d2cd9a',1);
    } else if(ap.heads==='beret') {
      oval(-3,-28,12,6,'#6f3147');oval(-5,-30,9,4,'#a05266');
      box(-10,-24,19,3,'#342632',1);box(4,-29,4,4,'#eed083',1);
    } else {
      oval(0,-24,12,12,color);oval(fx*3,-21+fy*2,7,7,'#243a36');
      oval(fx*4,-20+fy*2,5,5,skin);box(-9,-15,5,7,color,2);box(4,-15,5,7,color,2);
    }
    if(ap.outfits==='hazmat') {box(-7,-22,14,5,'#8ce0cf',2);box(-4,-16,8,5,'#253c40',2);}
    // Two hands hold a clearly separated, directional rifle.
    ctx.save();ctx.translate(0,-3);ctx.rotate(aim);
    box(1,2,15,6,color,3);oval(15,5,3.5,3.5,skin);
    box(5,-4,23,7,'#111c24',2);box(13,-5,12,3,'#657a7c',1);
    box(26,-3,12,3,'#b0bcb3',1);box(10,2,5,7,'#263b3e',1);
    oval(22,3,3,3,skin);box(20,-6,4,2,'#b9caaf',0);
    ctx.restore();ctx.restore();
  }
  window.CharacterArt = {draw};
})();
