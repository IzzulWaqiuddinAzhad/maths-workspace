import { LabelLayout, edgeCandidates, paintLabel } from './label-layout.js?v=13';
const countLabels=new LabelLayout();
import { graphToScreen } from './transform-model.js?v=29';

// Screen y increases downwards: this hand travels 12 → 3 → 6 → 9.
export function clockHandAt(elapsed, radius = 1) {
  const angle = -Math.PI / 2 + ((elapsed % 6000) / 6000) * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function paintRotationLesson(ctx, { lesson, view, dark, clockTime = 0, width, height, overlays=[] }) {
  const segments = [], points = [], obstacles = [];
  if (!lesson.stage) return { segments, points, obstacles };
  const screen = p => graphToScreen(p, view), c = screen(lesson.question.centre);
  const red = dark ? '#ff8991' : '#c23246', blue = dark ? '#91beff' : '#2468c4';
  const ink = dark ? '#edf0f5' : '#20242c', paper = dark ? '#15181d' : '#fff';
  const source = screen(lesson.question.given), distance = Math.hypot(source.x-c.x, source.y-c.y);
  const corner = screen(lesson.corner);
  const shortLeg = Math.min(...[Math.hypot(corner.x-c.x,corner.y-c.y),Math.hypot(source.x-corner.x,source.y-corner.y)].filter(n=>n>1e-8));
  const clockRadius = Math.min(33, Math.max(12, Math.min(distance * .34, shortLeg * .65)));
  const line = (ps, colour, width = 3) => {
    const vertices = ps.map(screen);
    ctx.beginPath(); vertices.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
    for (let i=1; i<vertices.length; i++) segments.push([vertices[i-1],vertices[i]]);
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const orange=dark?'#f9bd77':'#a95c14', requests=[];
  const countSegment=(from,to,index,colour)=>{
    if(Math.hypot(to.x-from.x,to.y-from.y)<1e-8)return;
    line([from,to],colour,3.2);
    const a=screen(from),b=screen(to),dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);
    for(let i=1;i<len-1e-8;i++) {
      const p=screen({x:from.x+dx*i/len,y:from.y+dy*i/len});
      ctx.beginPath();ctx.moveTo(p.x+(dy?-3:0),p.y+(dx?-3:0));ctx.lineTo(p.x+(dy?3:0),p.y+(dx?3:0));ctx.stroke();
    }
    const n=index===lesson.buildIndex?lesson.displayedBuildCount():lesson.buildCounts[index];
    const candidates=edgeCandidates(a,b,index>=4?1:-1),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    // A fallback ring clears axis numerals when short arms are tightly packed at low zoom.
    candidates.push(...candidates.map(p=>({x:mid.x+(p.x-mid.x)*1.5,y:mid.y+(p.y-mid.y)*1.5})));
    requests.push({id:`count-${index}`,text:String(Math.abs(Number(n.toFixed(2)))),colour,candidates});
  };
  for(const [i,path] of lesson.constructionPaths.entries()) {
    countSegment(path.centre,path.corner,i,orange);
    countSegment(path.corner,path.end,i+4,blue);
  }
  if(!lesson.constructionComplete && lesson.stage) {
    const info=lesson.segmentInfo(),path=lesson.constructionPaths[info.arm],p=screen(info.part?path.end:path.corner);
    ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=lesson.segmentInfo().part?blue:orange;ctx.lineWidth=2;ctx.stroke();points.push(p);
  }
  countLabels.begin({bounds:width&&height?{x:8,y:8,w:width-16,h:height-62}:undefined,points:[c,source],segments,labelOverlapPenalty:2000});
  countLabels.placed.push(...overlays);
  if(lesson.clockVisible)countLabels.placed.push({x:c.x-clockRadius-7,y:c.y-clockRadius-7,w:clockRadius*2+14,h:clockRadius*2+14});
  for(const request of requests) {
    ctx.font='700 20px system-ui';const w=ctx.measureText(request.text).width;
    // Offer positions beyond the clock for short segments close to the centre.
    const candidates=lesson.clockVisible ? [...request.candidates,...request.candidates.map(p=>{
      const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)||1,r=Math.max(d,clockRadius+30);
      return {x:c.x+dx*r/d,y:c.y+dy*r/d};
    })] : request.candidates;
    const label=countLabels.place({...request,candidates,width:w+2,height:24});
    paintLabel(ctx,label,{ink:request.colour,background:paper});
    obstacles.push({x:label.x-w/2-4,y:label.y-14,w:w+8,h:28});
  }
  countLabels.end();
  if (lesson.angle !== 0) {
    line([lesson.question.centre, lesson.cornerAt(), lesson.pointAt()], blue, 3.5);
    const start = Math.atan2(source.y-c.y,source.x-c.x), sweep = -lesson.angle * Math.PI / 180;
    const radius = Math.min(distance * .8, Math.max(lesson.clockVisible ? clockRadius+12 : 18, Math.min(64,distance*.5)));
    if (radius > 3) {
      ctx.beginPath(); ctx.arc(c.x,c.y,radius,start,start+sweep,sweep<0); ctx.strokeStyle=blue; ctx.lineWidth=2;ctx.stroke();
      const end=start+sweep, tangent=end+(sweep<0?-1:1)*Math.PI/2;
      const x=c.x+Math.cos(end)*radius,y=c.y+Math.sin(end)*radius;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8*Math.cos(tangent-.45),y-8*Math.sin(tangent-.45));ctx.lineTo(x-8*Math.cos(tangent+.45),y-8*Math.sin(tangent+.45));ctx.closePath();ctx.fillStyle=blue;ctx.fill();
    }
  }
  // Clock is a screen-sized teaching overlay anchored to the graph centre.
  // It never changes lesson.progress, geometry, answers or document history.
  if (lesson.clockVisible) {
    const r=clockRadius;
    ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1.6;ctx.stroke();
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6-Math.PI/2, outer=r-3, inner=r-(i%3===0?7:5);
      ctx.beginPath();ctx.moveTo(c.x+Math.cos(a)*inner,c.y+Math.sin(a)*inner);ctx.lineTo(c.x+Math.cos(a)*outer,c.y+Math.sin(a)*outer);ctx.stroke();
    }
    if(r>=25) {
      ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ink;
      for(const [label,x,y] of [['12',0,-.59],['3',.65,0],['6',0,.64],['9',-.65,0]]) ctx.fillText(label,c.x+x*r,c.y+y*r);
    }
    // Slow hour hand and faster long hand both travel clockwise.
    for(const [elapsed,length,width,colour] of [[clockTime/12+5000,r*.36,2.5,ink],[clockTime,r*.72,2.2,blue]]) {
      const hand=clockHandAt(elapsed,length);
      ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x+hand.x,c.y+hand.y);ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();
    }
    obstacles.push({x:c.x-r-3,y:c.y-r-3,w:2*r+6,h:2*r+6});
  } else {
    ctx.beginPath();ctx.arc(c.x,c.y,6,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=red;ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(c.x-10,c.y);ctx.lineTo(c.x+10,c.y);ctx.moveTo(c.x,c.y-10);ctx.lineTo(c.x,c.y+10);ctx.stroke();
  }
  ctx.beginPath();ctx.arc(c.x,c.y,2.5,0,Math.PI*2);ctx.fillStyle=ink;ctx.fill(); points.push(c);
  ctx.restore();return {segments,points,obstacles};
}
