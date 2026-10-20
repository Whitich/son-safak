(function(){
  'use strict';
  const G=window.GameCore;let ground=null;
  function buildGround(){
    const canvas=document.createElement('canvas');canvas.width=G.WORLD.w;canvas.height=G.WORLD.h;
    const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height,b=G.BASE;
    c.fillStyle='#3c4640';c.fillRect(0,0,W,H);
    // Deterministic verge, paving and rubble: generated once, not each frame.
    for(let i=0;i<230;i++){
      const x=(i*733+91)%W,y=(i*397+63)%H;
      c.fillStyle=i%3===0?'#4c5a4255':'#29382f66';c.beginPath();c.ellipse(x,y,18+i%35,9+i%22,i,0,Math.PI*2);c.fill();
    }
    c.fillStyle='#303839';c.fillRect(0,b.y-118,W,236);c.fillRect(b.x-118,0,236,H);
    c.strokeStyle='#89918455';c.lineWidth=4;
    for(const side of [-1,1]){
      c.beginPath();c.moveTo(0,b.y+side*126);c.lineTo(W,b.y+side*126);c.stroke();
      c.beginPath();c.moveTo(b.x+side*126,0);c.lineTo(b.x+side*126,H);c.stroke();
    }
    c.strokeStyle='#c5b47966';c.lineWidth=3;c.setLineDash([25,34]);
    c.beginPath();c.moveTo(0,b.y);c.lineTo(W,b.y);c.moveTo(b.x,0);c.lineTo(b.x,H);c.stroke();c.setLineDash([]);
    for(let i=0;i<190;i++){
      const x=(i*521+51)%W,y=(i*331+87)%H;
      c.strokeStyle='#14232344';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+5,y+9);c.lineTo(x+17,y+7);c.stroke();
      c.fillStyle=i%4?'#d3c6a126':'#101c2055';c.fillRect(x+12,y+5,3+i%7,2+i%4);
    }
    for(let i=0;i<140;i++){
      const x=70+(i*647)%(W-140),y=65+(i*373)%(H-130);
      if(Math.abs(x-b.x)<145||Math.abs(y-b.y)<145)continue;
      c.strokeStyle='#82906a55';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y-9);c.moveTo(x,y);c.lineTo(x+2,y-12);c.moveTo(x,y);c.lineTo(x+7,y-6);c.stroke();
    }
    // Evacuation markings lead to a reinforced refuge rather than a magic ring.
    c.save();c.translate(b.x,b.y);
    c.fillStyle='#5b6258';c.beginPath();c.roundRect(-99,-88,198,182,12);c.fill();
    c.strokeStyle='#afa379';c.lineWidth=4;c.setLineDash([10,8]);c.strokeRect(-94,-83,188,172);c.setLineDash([]);
    for(let i=-1;i<=1;i++){c.fillStyle='#92967b';c.fillRect(-18+i*40,104,23,8);}
    c.fillStyle='#c7b77a99';c.font='bold 13px Segoe UI';c.textAlign='center';c.fillText('TAHLİYE / 07',0,139);
    for(const x of [-155,155]){c.save();c.translate(x,0);if(x>0)c.rotate(Math.PI);c.fillStyle='#bba76c88';c.beginPath();c.moveTo(-28,-6);c.lineTo(4,-6);c.lineTo(4,-16);c.lineTo(24,0);c.lineTo(4,16);c.lineTo(4,6);c.lineTo(-28,6);c.closePath();c.fill();c.restore();}
    c.restore();
    // Flattened road barriers and ruined foundations sit along the outer verge.
    for(let i=0;i<16;i++){
      const x=i%2===0?42:W-100,y=100+Math.floor(i/2)*190;
      c.fillStyle='#263432';c.fillRect(x,y,60,27);c.fillStyle='#6e7462';c.fillRect(x+5,y+4,51,8);
      c.strokeStyle='#a9955d66';c.lineWidth=5;c.beginPath();c.moveTo(x+10,y+7);c.lineTo(x+22,y+18);c.moveTo(x+35,y+7);c.lineTo(x+47,y+18);c.stroke();
    }
    for(let i=0;i<18;i++){
      const x=90+(i*617)%(W-180),y=i%2?H-44:40;
      c.fillStyle='#263b30';c.beginPath();c.ellipse(x,y,34,17,i,0,Math.PI*2);c.fill();
      c.fillStyle='#566344';c.beginPath();c.ellipse(x-9,y-4,20,10,i,0,Math.PI*2);c.fill();
    }
    ground=canvas;
  }
  function drawGround(ctx){if(!ground)buildGround();ctx.drawImage(ground,0,0);}
  function drawRefuge(ctx,level,hpRatio,time,night){
    const b=G.BASE;ctx.save();ctx.translate(b.x,b.y);
    ctx.fillStyle='#101d2380';ctx.beginPath();ctx.ellipse(7,24,69,42,0,0,Math.PI*2);ctx.fill();
    const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
    poly([[-59,-29],[-43,-47],[40,-47],[62,-28],[62,34],[43,54],[-43,54],[-62,33]],'#283c42');
    poly([[-59,-38],[-40,-55],[40,-55],[59,-36],[59,21],[40,39],[-41,39],[-59,21]],'#68766b');
    ctx.strokeStyle='#a6ad96';ctx.lineWidth=3;ctx.strokeRect(-42,-37,84,61);
    ctx.fillStyle='#4a5c56';ctx.fillRect(-34,-29,68,44);
    for(let i=-27;i<=27;i+=13){ctx.fillStyle='#718279';ctx.fillRect(i,-25,5,35);}
    // Blast door, lit shelter windows, ventilation and evacuation signage.
    ctx.fillStyle='#111f25';ctx.fillRect(-20,38,40,20);ctx.fillStyle='#8d9987';ctx.fillRect(-17,39,15,17);ctx.fillRect(2,39,15,17);
    ctx.fillStyle='#c8bd86';ctx.fillRect(-15,45,5,3);ctx.fillRect(10,45,5,3);
    for(const x of [-44,37]){ctx.fillStyle=hpRatio<.3?'#a28b62':'#e1c993';ctx.fillRect(x,39,9,10);ctx.fillStyle='#34463f';ctx.beginPath();ctx.arc(x+4,43,2,0,Math.PI*2);ctx.fill();ctx.fillRect(x+2,45,4,4);}
    ctx.fillStyle='#233c3c';ctx.fillRect(-27,-9,54,14);ctx.fillStyle='#e5e3c6';ctx.font='bold 10px Segoe UI';ctx.textAlign='center';ctx.fillText('SIĞINAK 07',0,1);
    ctx.fillStyle='#abb3a0';ctx.fillRect(-49,-22,10,26);ctx.fillStyle='#354a4e';ctx.fillRect(-47,-19,6,20);
    if(level>=2){ctx.fillStyle='#344b55';ctx.fillRect(24,-38,24,24);ctx.strokeStyle='#91b2ae';ctx.lineWidth=1;for(let i=0;i<3;i++)ctx.strokeRect(26+i*7,-36,5,20);}
    if(level>=3){ctx.strokeStyle='#c7ccb5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-24,-31);ctx.lineTo(-24,-62);ctx.lineTo(-12,-67);ctx.stroke();ctx.fillStyle='#d7d4b5';ctx.beginPath();ctx.ellipse(-19,-59,13,5,-.4,0,Math.PI*2);ctx.fill();}
    if(level>=4){ctx.strokeStyle='#b0bca6';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-54,24);ctx.lineTo(-39,37);ctx.moveTo(54,24);ctx.lineTo(39,37);ctx.stroke();}
    if(hpRatio<.7){ctx.strokeStyle='#172c30';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-34,-24);ctx.lineTo(-16,-12);ctx.lineTo(-23,-3);ctx.lineTo(-9,9);ctx.moveTo(38,5);ctx.lineTo(25,18);ctx.lineTo(34,28);ctx.stroke();}
    for(const side of [-1,1]){
      const on=hpRatio>.3||Math.sin(time*.012+side)>-.2;
      ctx.fillStyle=on?'#f2ce8e':'#665b46';ctx.fillRect(side*47-5,25,10,6);
      if(night>.05&&on){ctx.fillStyle='rgba(244,203,133,'+night*.1+')';ctx.beginPath();ctx.ellipse(side*52,43,27,18,0,0,Math.PI*2);ctx.fill();}
    }
    ctx.fillStyle=hpRatio<.3?(Math.sin(time*.01)>0?'#ef8b6d':'#763e38'):'#b4c5a1';ctx.fillRect(44,-35,7,7);
    if(hpRatio<.45)for(let i=0;i<5;i++){
      const t=((time/1200+i*.21)%1),x=36+Math.sin(i*2+t)*9;
      ctx.fillStyle='rgba(34,39,40,'+(1-t)*.25+')';ctx.beginPath();ctx.ellipse(x,-29-t*52,5+t*12,7+t*13,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawLamps(ctx,night){
    const b=G.BASE;
    for(const [dx,dy] of [[-220,-145],[220,-145],[-220,145],[220,145]]){
      const x=b.x+dx,y=b.y+dy;ctx.fillStyle='#34464a';ctx.fillRect(x-3,y-14,6,17);ctx.fillStyle='#d6c69a';ctx.fillRect(x-7,y-17,14,5);
      if(night>.05){const glow=ctx.createRadialGradient(x,y,2,x,y,80);glow.addColorStop(0,'rgba(246,202,128,'+night*.13+')');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(x-80,y-80,160,160);}
    }
  }
  window.EnvironmentArt={drawGround,drawRefuge,drawLamps};
})();
