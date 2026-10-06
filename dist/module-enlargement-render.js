import { graphToScreen } from './transform-model.js?v=29';
import { LabelLayout, edgeCandidates, polarCandidates, paintLabel } from './label-layout.js?v=12';
const labels = new LabelLayout();

// Original and scaled square-count paths share the same centre and camera.
export function paintEnlargementLesson(ctx, {lesson, view, dark, width, height, overlays=[]}) {
  const segments=[],points=[],obstacles=[],requests=[];
  if (!lesson.stage) return {segments,points,obstacles};
  const screen=p=>graphToScreen(p,view), centre=lesson.question.centre, c=screen(centre);
  const orange=dark?'#f9bd77':'#a95c14', blue=dark?'#91beff':'#2468c4';
  const ink=dark?'#edf0f5':'#20242c', paper=dark?'#15181d':'#fff';
  const number=n=>String(Number(n.toFixed(2))).replace('-','−');
  const line=(vertices,colour,width=2,dash=[])=>{
    const ps=vertices.map(screen);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
    for(let i=1;i<ps.length;i++) segments.push([ps[i-1],ps[i]]);
  };
  const countPath=(factor,colour,scaled=false)=>{
    const p=lesson.pointAt(factor), corner={x:p.x,y:centre.y}, b=screen(corner), end=screen(p);
    line([centre,corner,p],colour,scaled?2.5:2,scaled?[]:[4,3]);
    // A tick per whole square makes the two components countable.
    for(const [from,to] of [[centre,corner],[corner,p]]) {
      const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);
      for(let i=1;i<len-1e-8;i++) {
        const v=screen({x:from.x+dx*i/len,y:from.y+dy*i/len});
        ctx.beginPath();ctx.moveTo(v.x+(dy? -3:0),v.y+(dx? -3:0));ctx.lineTo(v.x+(dy?3:0),v.y+(dx?3:0));ctx.strokeStyle=colour;ctx.lineWidth=1.5;ctx.stroke();
      }
    }
    if(Math.abs(p.x-centre.x)>1e-8) requests.push({id:`${scaled?'scaled':'original'}-x`,text:number(Math.abs(p.x-centre.x)),colour,candidates:edgeCandidates(c,b,scaled?1:-1)});
    if(Math.abs(p.y-centre.y)>1e-8) requests.push({id:`${scaled?'scaled':'original'}-y`,text:number(Math.abs(p.y-centre.y)),colour,candidates:edgeCandidates(b,end,scaled?-1:1)});
  };
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(lesson.stage>=2) {
    line([lesson.pointAt(Math.min(-.25,lesson.factor)),lesson.pointAt(Math.max(1.25,lesson.factor))],dark?'#929ba9':'#8c96a5',1.5,[5,5]);
  }
  if(lesson.ready) {
    countPath(1,orange);
    if(Math.abs(lesson.factor-1)>1e-8 && Math.abs(lesson.factor)>1e-8) countPath(lesson.factor,blue,true);
  }
  ctx.beginPath();ctx.arc(c.x,c.y,6,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=orange;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(c.x-10,c.y);ctx.lineTo(c.x+10,c.y);ctx.moveTo(c.x,c.y-10);ctx.lineTo(c.x,c.y+10);ctx.stroke();points.push(c);
  requests.unshift({id:'centre',text:`C (${number(centre.x)}, ${number(centre.y)})`,colour:ink,candidates:polarCandidates(c,2.6,55,{spread:.8,rings:4})});
  const bounds=lesson.bounds;
  labels.begin({bounds:width&&height?{x:8,y:8,w:width-16,h:height-76}:undefined,points:[c,screen(lesson.question.given),screen(lesson.pointAt())],
    segments:[...segments,[screen({x:bounds.xmin,y:0}),screen({x:bounds.xmax,y:0})],[screen({x:0,y:bounds.ymin}),screen({x:0,y:bounds.ymax})]]});
  labels.placed.push(...overlays);
  ctx.font='600 15px system-ui';
  for(const request of requests) {
    const width=ctx.measureText(request.text).width,label=labels.place({...request,width,height:18});
    paintLabel(ctx,label,{ink:request.colour,background:paper});
    obstacles.push({x:label.x-width/2-4,y:label.y-12,w:width+8,h:24});
  }
  labels.end();
  ctx.restore();return {segments,points,obstacles};
}
