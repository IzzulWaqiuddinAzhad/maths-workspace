import {PRINTED_LABELS} from './notebook-assets/label-anchors.js';
import {paintRotationLesson} from './module-rotation-render.js?v=10';
import {paintReflectionLesson} from './module-reflection-render.js?v=7';
import {paintEnlargementLesson,enlargementGuideSegment} from './module-enlargement-render.js?v=5';
import {paintCoordinateGuide,paintCoordinateReadout,isOrigin} from './module-coordinate-guide.js?v=3';
import {graphToScreen,rotationGuide} from './transform-model.js?v=29';

export const readKey=(kind,index=0)=>index?`${kind}-${index}`:kind;
export function vertexLabel(session,index,image=false){
  if(session.source.points.length===1)return image?session.lesson.answerLabel:session.lesson.givenLabel;
  const label=session.source.labels?.[index]||`${session.source.name}${index+1}`;
  return label+(image?'′':'');
}
export function graphViewport(g){
  return {width:(g.bounds.xmax-g.bounds.xmin)*40,height:(g.bounds.ymax-g.bounds.ymin)*40+76,view:{x:-g.bounds.xmin*40,y:g.bounds.ymax*40,zoom:1}};
}
// Append only the pair to the letter already printed in the module SVG.
export function notebookReadoutPlacement(ctx,g,s,kind,index=0){
  if(kind!=='source'||s.source.image)return undefined;
  let anchors=PRINTED_LABELS[s.source.id],anchor=anchors?.[index];
  if(!anchor){
    const point=s.source.points[index],name=vertexLabel(s,index);
    for(const object of s.base){
      const i=object.points.findIndex((p,j)=>p.x===point.x&&p.y===point.y&&object.labels?.[j]===name);
      if(i>=0&&PRINTED_LABELS[object.id]?.[i]){anchor=PRINTED_LABELS[object.id][i];break;}
    }
  }
  if(!anchor)return undefined;
  const scale=40/g.unit,fontSize=anchor.size*scale;
  ctx.save();ctx.font=`700 ${fontSize}px Arial, sans-serif`;
  const x=anchor.x*scale+ctx.measureText(anchor.text).width+fontSize*.18;
  ctx.restore();return {omitLabel:true,preserveAnchor:true,fontSize,x,y:anchor.y*scale-fontSize*.35};
}
export function paintNotebookGraph(ctx,g,{now=0,active=false,guide=null,historical=false}={}){
  const s=g.session,l=s.lesson,{width,height,view}=graphViewport(g),screen=p=>graphToScreen(p,view);
  if(!historical)for(const layer of s.presentations)paintNotebookGraph(ctx,{...g,session:layer},{now,historical:true});
  const placement=(kind,index=0)=>notebookReadoutPlacement(ctx,g,s,kind,index);
  ctx.save();ctx.beginPath();ctx.rect(g.x-20,g.y-20,g.width+40,g.height+44);ctx.clip();ctx.translate(g.x,g.y);ctx.scale(g.unit/40,g.unit/40);
  const line=(points,colour='#2468c4',dash=[])=>{
    ctx.beginPath();points.map(screen).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=colour;ctx.lineWidth=2.7;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  };
  const label=(text,p,colour='#2468c4')=>{
    ctx.font='600 22px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(text).width;
    const x=Math.max(w/2+4,Math.min(width-w/2-4,p.x)),y=Math.max(20,Math.min(height-24,p.y));
    ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.strokeText(text,x,y);ctx.fillStyle=colour;ctx.fillText(text,x,y);
  };
  const dot=(p,colour='#2468c4')=>{const a=screen(p);ctx.beginPath();ctx.arc(a.x,a.y,5,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();};
  const shape=(points,name,colour='#2468c4')=>{
    if(points.length===1){dot(points[0],colour);if(name)label(name,{x:screen(points[0]).x+18,y:screen(points[0]).y+28},colour);return;}
    line([...points,points[0]],colour);ctx.fillStyle=colour+'18';ctx.fill();
    if(name){const p=points.reduce((a,b)=>({x:a.x+b.x/points.length,y:a.y+b.y/points.length}),{x:0,y:0});label(name,screen(p),colour);}
  };
  if(!historical)for(const o of s.kept){
    const sourceRead=o.id===s.selected&&(l.readPoints.source||guide?.key==='source');
    const currentImage=s.imageReady&&o.name===l.answerLabel&&JSON.stringify(o.points)===JSON.stringify(s.imagePoints);
    shape(o.points,sourceRead||currentImage?null:o.name,'#536f9e');
  }
  if(active&&s.polygon)line([...s.source.points,s.source.points[0]],'#8754bd',[5,4]);
  if(s.mode==='rotation'){
    if(s.usesConstruction)paintRotationLesson(ctx,{traceWidth:4.6,lesson:l,view,dark:false,width,height,clockTime:now,countLabels:g.layout,cursorPulse:active&&l.stage&&!l.constructionComplete?.5+.5*Math.sin(now/170):0});
    else{
      const guide=rotationGuide(s.source.points,l.question.centre,l.angle);
      if(guide){line([l.question.centre,guide.source],'#a95c14',[5,4]);line([l.question.centre,guide.image]);const c=screen(l.question.centre);ctx.beginPath();ctx.arc(c.x,c.y,36,-guide.start,-guide.start-guide.sweep,guide.sweep>0);ctx.strokeStyle='#2468c4';ctx.stroke();}
      dot(l.question.centre,'#c23246');
    }
  }else if(s.mode==='reflection')paintReflectionLesson(ctx,{lesson:l,view,bounds:g.bounds,dark:false,handlesActive:active,pulse:Math.max(0,1-(now-(g.mirrorChanged||0))/900)});
  else if(s.mode==='enlargement'){
    if(!s.polygon)paintEnlargementLesson(ctx,{lesson:l,view,dark:false,width,height});
    else{
      const c=screen(l.question.centre);ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle='#697586';ctx.lineWidth=2;
      for(const p of s.source.points){const ends=enlargementGuideSegment(c,screen(p),width,height-76);if(ends.length){ctx.beginPath();ctx.moveTo(ends[0].x,ends[0].y);ctx.lineTo(ends[1].x,ends[1].y);ctx.stroke();}}
      ctx.restore();dot(l.question.centre,'#a95c14');
    }
  }else if(s.imageReady){
    const a=s.source.points[0],b=s.imagePoints[0],corner={x:b.x,y:a.y};line([a,corner,b],'#a95c14',[5,4]);
    const pa=screen(a),pc=screen(corner),pb=screen(b),v=l.vector;
    if(v.x)label(`${Math.abs(v.x)} ${v.x<0?'←':'→'}`,{x:(pa.x+pc.x)/2,y:pc.y+22},'#a95c14');
    if(v.y)label(`${Math.abs(v.y)} ${v.y<0?'↓':'↑'}`,{x:pb.x+30,y:(pc.y+pb.y)/2},'#a95c14');
  }
  if(s.imageReady)shape(s.imagePoints,s.polygon?l.answerLabel:null);
  if(historical){
    s.source.points.forEach((p,i)=>{if(l.readPoints[readKey('source',i)]&&!isOrigin(p))paintCoordinateReadout(ctx,{point:p,label:vertexLabel(s,i),view,width,height,pointColour:'#20242c',placement:placement('source',i)});});
    if(s.imageReady&&!s.kept.some(o=>o.name===l.answerLabel&&JSON.stringify(o.points)===JSON.stringify(s.imagePoints)))s.imagePoints.forEach((p,i)=>{
      if(l.readPoints[readKey('image',i)]&&!isOrigin(p))paintCoordinateReadout(ctx,{point:p,label:vertexLabel(s,i,true),view,width,height,pointColour:'#2468c4'});
      else if(!s.polygon)label(vertexLabel(s,i,true),{x:screen(p).x+22,y:screen(p).y-32});
    });
    if(l.readPoints.centre&&l.question.centre&&!isOrigin(l.question.centre))paintCoordinateReadout(ctx,{point:l.question.centre,label:'Centre',view,width,height,pointColour:'#c23246'});
    ctx.restore();return;
  }
  const reading=guide?.key;
  const image=s.imageReady?s.imagePoints:[];
  s.source.points.forEach((p,i)=>{
    const sourceKey=readKey('source',i),imageKey=readKey('image',i),coincident=image[i]&&Math.hypot(p.x-image[i].x,p.y-image[i].y)<1e-7;
    const draw=(point,name,colour,place)=>!isOrigin(point)&&paintCoordinateReadout(ctx,{point,label:name,view,dark:false,width,height,pointColour:colour,placement:place});
    if(l.readPoints[sourceKey]&&reading!==sourceKey)draw(p,vertexLabel(s,i),'#20242c',placement('source',i));
    if(image[i]){
      if(reading!==imageKey&&!(coincident&&reading===sourceKey)&&l.readPoints[imageKey])draw(image[i],vertexLabel(s,i,true),'#2468c4');
      else if(!s.polygon&&!l.readPoints[imageKey]&&reading!==imageKey)label(vertexLabel(s,i,true),{x:screen(image[i]).x+22,y:screen(image[i]).y+28});
    }
  });
  if(l.readPoints.centre&&guide?.key!=='centre'&&l.question.centre&&!isOrigin(l.question.centre))paintCoordinateReadout(ctx,{point:l.question.centre,label:'Centre',view,dark:false,width,height,pointColour:'#c23246'});
  if(guide)paintCoordinateGuide(ctx,{...guide,placement:placement(guide.key.split('-')[0],+(guide.key.split('-')[1]||0))??{},elapsed:now-guide.start,view,dark:false,width,height,pointColour:guide.mode==='plot'?'#c23246':'#2468c4'});
  ctx.restore();
}
