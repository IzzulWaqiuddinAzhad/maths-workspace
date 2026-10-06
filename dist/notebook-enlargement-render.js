import {graphToScreen} from './transform-model.js?v=29';
import {paintCoordinatePulse} from './module-coordinate-guide.js?v=4';
import {enlargementGuideSegment} from './module-enlargement-render.js?v=6';
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
// Connect the chosen vertices first, then extend in both directions to the
// graph boundary. Each completed line remains while the next pair is chosen.
export function pairLineSegment(a,b,width,height,progress=1){
  const ends=enlargementGuideSegment(a,b,width,height);if(!ends.length)return [];
  const p=Math.max(0,Math.min(1,progress));
  return p<=.45?[a,mix(a,b,p/.45)]:[mix(a,ends[0],(p-.45)/.55),mix(b,ends[1],(p-.45)/.55)];
}
export function paintEnlargementFinding(ctx,{study:f,labels,view,width,height,now=0,active=false}){
  const screen=p=>graphToScreen(p,view);
  ctx.save();ctx.lineCap='round';ctx.lineWidth=3.8;ctx.strokeStyle='#697586';ctx.setLineDash([8,5]);
  for(const i of f.lines){
    const ends=pairLineSegment(screen(f.source[i]),screen(f.target[i]),width,height,f.drawingIndex===i?f.progress:1);if(!ends.length)continue;
    labels.collect({segments:[ends]});ctx.beginPath();ctx.moveTo(ends[0].x,ends[0].y);ctx.lineTo(ends[1].x,ends[1].y);ctx.stroke();
  }
  ctx.restore();
  if(f.index===null)return;
  f.objects.forEach((o,side)=>{
    const p=o.points[f.index],colour=side?'#276dc3':'#ac5d13';
    paintCoordinatePulse(ctx,{point:p,view,now,active,colour});
    labels.queue(p,o.labels?.[f.index]||`${o.name}${f.index+1}`,{colour});
  });
}
