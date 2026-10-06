import {graphToScreen} from './transform-model.js?v=29';
import {paintCoordinatePulse} from './module-coordinate-guide.js?v=4';

// Use the notebook's shared label collector so paths and handwriting
// all participate in the same final lettering pass.
export function paintCentreFinding(ctx,{study,labels,view,now=0,active=false}){
  const screen=p=>graphToScreen(p,view),f=study;
  const line=(ps,colour,width=4.6,dash=[])=>{
    if(ps.length<2)return;const points=ps.map(screen);
    labels.collect({segments:points.slice(1).map((p,i)=>[points[i],p])});
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.setLineDash([]);
  };
  const dot=(point,colour,pulse=false)=>{
    const b=labels.graph.bounds;
    if(point.x<b.xmin||point.x>b.xmax||point.y<b.ymin||point.y>b.ymax){
      const edge=screen({x:Math.max(b.xmin+.3,Math.min(b.xmax-.3,point.x)),y:Math.max(b.ymin+.3,Math.min(b.ymax-.3,point.y))}),p=screen(point),angle=Math.atan2(p.y-edge.y,p.x-edge.x);
      ctx.beginPath();ctx.moveTo(edge.x,edge.y);ctx.lineTo(edge.x-12*Math.cos(angle-.5),edge.y-12*Math.sin(angle-.5));ctx.lineTo(edge.x-12*Math.cos(angle+.5),edge.y-12*Math.sin(angle+.5));ctx.closePath();ctx.fillStyle=colour;ctx.fill();return;
    }
    const p=screen(point);labels.points.push(p);
    if(pulse)paintCoordinatePulse(ctx,{point,view,now,active,colour});
    ctx.beginPath();ctx.arc(p.x,p.y,4.7,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();
  };
  if(f.index===null)return;
  f.paths.forEach((path,i)=>line(path,i%2?'#276dc3':'#ac5d13'));
  if(!f.distancesVisible)[f.a,f.b].forEach((p,i)=>{
    dot(p,i?'#276dc3':'#ac5d13',f.phase==='meet');
    labels.queue(p,`${f.objects[i?1-f.side:f.side].name}${f.index+1}`,{colour:i?'#276dc3':'#ac5d13'});
  });
  if(['meet','arms'].includes(f.phase)){
    if(f.cursor)dot(f.cursor,'#ac5d13',true);
    if(f.pairedCursor)dot(f.pairedCursor,'#276dc3',true);
  }
  if(f.met){dot(f.midpoint,'#803daa');labels.queue(f.midpoint,'M',{colour:'#803daa',leader:true});}
  if(f.phase==='check')for(const c of f.candidates){
    const b=labels.graph.bounds,p=c.point;
    if(p.x<b.xmin||p.x>b.xmax||p.y<b.ymin||p.y>b.ymax){
      // A candidate may lie outside the printed paper grid (e.g. Q35). Mark
      // its direction at the edge rather than drawing a false centre there.
      const edge={x:Math.max(b.xmin+.4,Math.min(b.xmax-.4,p.x)),y:Math.max(b.ymin+.4,Math.min(b.ymax-.4,p.y))};
      const a=screen(edge),q=screen(p),angle=Math.atan2(q.y-a.y,q.x-a.x);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x-12*Math.cos(angle-.5),a.y-12*Math.sin(angle-.5));ctx.lineTo(a.x-12*Math.cos(angle+.5),a.y-12*Math.sin(angle+.5));ctx.closePath();ctx.fillStyle='#803daa';ctx.fill();
      labels.queue(edge,c.name,{colour:'#803daa',leader:true});
    }else {dot(p,'#803daa',c.id===f.candidate);labels.queue(p,c.name,{colour:'#803daa',leader:true});}
  }
  if(f.chosen&&f.distancesVisible){
    const c=f.chosen.point,points=[f.source[f.compareIndex],f.target[f.compareIndex]],fractions=f.distanceFractions;
    points.forEach((p,i)=>{
      const colour=i?'#276dc3':'#ac5d13',t=fractions[i],end={x:c.x+(p.x-c.x)*t,y:c.y+(p.y-c.y)*t};
      if(t>0)line([c,end],colour,2.8);
      dot(p,colour,true);
      labels.queue(p,f.objects[i].labels?.[f.compareIndex]||`${f.objects[i].name}${f.compareIndex+1}`,{colour});
    });
  }
  if(f.testDegrees!==null){
    const points=f.trialPoints;line([...points,points[0]],'#16816d',3.5);
    ctx.fillStyle='#16816d18';ctx.fill();
    points.forEach(p=>dot(p,'#16816d'));
  }
}
