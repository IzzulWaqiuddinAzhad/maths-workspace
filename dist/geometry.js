import {createObject} from './core.js?v=14';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return distance(p,{x:a.x+t*dx,y:a.y+t*dy})}
export function localToWorld(p,o){const x=p.x*o.scale.x,y=p.y*o.scale.y,c=Math.cos(o.rotation),s=Math.sin(o.rotation);return {x:o.position.x+x*c-y*s,y:o.position.y+x*s+y*c}}
export function worldToLocal(p,o){const x=p.x-o.position.x,y=p.y-o.position.y,c=Math.cos(o.rotation),s=Math.sin(o.rotation);return {x:(x*c+y*s)/o.scale.x,y:(-x*s+y*c)/o.scale.y}}
export function boundsPoints(ps){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
export function bounds(o){if(o.points?.length)return boundsPoints(o.points);return {x:0,y:0,w:o.width??100,h:o.height??100}}
export function corners(o){const b=bounds(o);return [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>localToWorld(p,o))}
export function regularPoints(n,w,h){return Array.from({length:n},(_,i)=>({x:w/2+Math.cos(i*2*Math.PI/n-Math.PI/2)*w/2,y:h/2+Math.sin(i*2*Math.PI/n-Math.PI/2)*h/2}))}
export function makeShape(kind,a,b,opts={}){let w=b.x-a.x,h=b.y-a.y;const o=createObject(kind==='curve'||kind==='polyline'?'VectorPath':'ShapeObject',{...opts,kind,position:{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y)},width:Math.abs(w),height:Math.abs(h)});w=o.width;h=o.height;
if(['line','arrow','curve','polyline'].includes(kind)){o.position={...a};o.points=[{x:0,y:0},{x:b.x-a.x,y:b.y-a.y}];if(kind==='arrow')o.endStyle='arrow';if(kind==='curve'){o.points.splice(1,0,{x:(b.x-a.x)/2,y:(b.y-a.y)/2-70,nodeType:'smooth'});o.curved=true}return o}
if(kind==='circle'||kind==='square'){const size=Math.max(w,h);o.width=size;o.height=size}
if(opts.circleMode==='radius'&&kind==='circle'){const r=distance(a,b);o.position={x:a.x-r,y:a.y-r};o.width=o.height=r*2}
const maps={triangle:[[.5,0],[1,1],[0,1]],rectangle:[[0,0],[1,0],[1,1],[0,1]],square:[[0,0],[1,0],[1,1],[0,1]],parallelogram:[[.25,0],[1,0],[.75,1],[0,1]],rhombus:[[.5,0],[1,.5],[.5,1],[0,.5]],kite:[[.5,0],[1,.35],[.5,1],[0,.35]],trapezium:[[.25,0],[.75,0],[1,1],[0,1]]};if(maps[kind])o.points=maps[kind].map(([x,y])=>({x:x*o.width,y:y*o.height}));if(kind==='regular')o.points=regularPoints(opts.sides??5,w,h);return o}
export function pointInPolygon(p,ps){let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
export function hitObject(p,o,tolerance=6){const q=worldToLocal(p,o),tol=tolerance/Math.max(.1,Math.min(Math.abs(o.scale.x),Math.abs(o.scale.y)));if(o.type==='GuideObject')return Math.abs(q.y)<35&&Math.abs(q.x)<10000;if(o.points?.length){const ps=o.points;if(o.type!=='InkStroke'&&o.type!=='VectorPath'&&!['line','arrow'].includes(o.kind)&&pointInPolygon(q,ps))return true;return ps.some((a,i)=>segmentDistance(q,a,ps[i+1]??a)<tol+o.strokeWidth/2)}const b=bounds(o);return q.x>=b.x-tol&&q.x<=b.x+b.w+tol&&q.y>=b.y-tol&&q.y<=b.y+b.h+tol}
export function eraseInk(objects,a,b,r,mode){return objects.flatMap(o=>{if(o.type!=='InkStroke'||o.locked)return[o];const ps=o.points;if(!ps?.length)return[o];let sampled=[];for(let i=0;i<ps.length;i++){if(i){const p=ps[i-1],q=ps[i],steps=Math.ceil(distance(localToWorld(p,o),localToWorld(q,o))/Math.max(1,r/2));for(let j=1;j<steps;j++){const t=j/steps;sampled.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,pressure:(p.pressure??.5)+((q.pressure??.5)-(p.pressure??.5))*t})}}sampled.push(ps[i])}const hits=sampled.map(p=>segmentDistance(localToWorld(p,o),a,b)<=r+o.strokeWidth*Math.max(Math.abs(o.scale.x),Math.abs(o.scale.y))/2);if(!hits.some(Boolean))return[o];if(mode==='stroke')return[];const fragments=[];let part=[];sampled.forEach((p,i)=>{if(hits[i]){if(part.length)fragments.push(part);part=[]}else part.push(p)});if(part.length)fragments.push(part);return fragments.map(points=>({...o,id:crypto.randomUUID(),points}))})}
export function simplify(ps,epsilon=5){if(ps.length<=2)return ps;let max=0,index=0;for(let i=1;i<ps.length-1;i++){const d=segmentDistance(ps[i],ps[0],ps.at(-1));if(d>max){max=d;index=i}}if(max<=epsilon)return [ps[0],ps.at(-1)];return [...simplify(ps.slice(0,index+1),epsilon).slice(0,-1),...simplify(ps.slice(index),epsilon)]}
// Uniform spacing makes recognition independent of pointer speed and coalesced sample density.
export function recognize(input,opts={}){
 if(input.length<3)return null;const b=boundsPoints(input),diag=Math.hypot(b.w,b.h);if(diag<15)return null;
 const lengths=[0];for(let i=1;i<input.length;i++)lengths.push(lengths.at(-1)+distance(input[i-1],input[i]));const total=lengths.at(-1);if(total<15)return null;
 let j=1;const ps=Array.from({length:96},(_,i)=>{const at=total*i/95;while(j<lengths.length-1&&lengths[j]<at)j++;const t=(at-lengths[j-1])/(lengths[j]-lengths[j-1]||1);return{x:input[j-1].x+(input[j].x-input[j-1].x)*t,y:input[j-1].y+(input[j].y-input[j-1].y)*t};});
 const a=ps[0],z=ps.at(-1),chord=distance(a,z);
 if(chord>diag*.65&&total/chord<1.25&&ps.every(p=>segmentDistance(p,a,z)<diag*.045))return makeShape('line',a,z,opts);
 const closed=chord<diag*.2&&total>diag*1.8;
 if(closed){
 const loop=[...ps.slice(0,-1),a],nodes=simplify(loop,diag*.035).slice(0,-1);
 for(let changed=true;changed&&nodes.length>3;){changed=false;for(let i=0;i<nodes.length;i++){if(segmentDistance(nodes[i],nodes[(i+nodes.length-1)%nodes.length],nodes[(i+1)%nodes.length])<diag*.025){nodes.splice(i,1);changed=true;break;}}}
 const error=nodes.length>=3?ps.reduce((sum,p)=>sum+Math.min(...nodes.map((q,i)=>segmentDistance(p,q,nodes[(i+1)%nodes.length]))),0)/ps.length:Infinity;
 // Prefer explicit corners over an ellipse: box perimeters can otherwise look circular.
 if(nodes.length>=3&&nodes.length<=4&&error<diag*.016)return createObject('ShapeObject',{...opts,kind:nodes.length===3?'triangle':'polygon',position:{x:0,y:0},points:nodes});
 const mean=ps.reduce((c,p)=>({x:c.x+p.x/ps.length,y:c.y+p.y/ps.length}),{x:0,y:0});let xx=0,yy=0,xy=0;for(const p of ps){const x=p.x-mean.x,y=p.y-mean.y;xx+=x*x;yy+=y*y;xy+=x*y;}const rotation=.5*Math.atan2(2*xy,xx-yy),c=Math.cos(rotation),sn=Math.sin(rotation),local=ps.map(p=>({x:(p.x-mean.x)*c+(p.y-mean.y)*sn,y:-(p.x-mean.x)*sn+(p.y-mean.y)*c})),bb=boundsPoints(local),cx=bb.x+bb.w/2,cy=bb.y+bb.h/2;
 const residual=local.reduce((sum,p)=>sum+Math.abs(Math.hypot((p.x-cx)/(bb.w/2||1),(p.y-cy)/(bb.h/2||1))-1),0)/ps.length;
 if(residual<.09&&bb.w>diag*.12&&bb.h>diag*.12){const circle=Math.abs(bb.w-bb.h)/Math.max(bb.w,bb.h)<.14,w=circle?(bb.w+bb.h)/2:bb.w,h=circle?w:bb.h;return createObject('ShapeObject',{...opts,kind:circle?'circle':'ellipse',rotation,position:{x:mean.x+(cx-w/2)*c-(cy-h/2)*sn,y:mean.y+(cx-w/2)*sn+(cy-h/2)*c},width:w,height:h});}
 if(nodes.length>=3&&nodes.length<=8&&error<diag*.022)return createObject('ShapeObject',{...opts,kind:'polygon',position:{x:0,y:0},points:nodes});return null;
 }
 const nodes=simplify(ps,diag*.03);if(nodes.length>16||total>diag*4)return null;
 const sharp=nodes.slice(1,-1).some((p,i)=>{const at=ps.reduce((best,q,j)=>distance(q,p)<distance(ps[best],p)?j:best,0),u=ps[Math.max(0,at-3)],v=ps[Math.min(ps.length-1,at+3)],dot=((p.x-u.x)*(v.x-p.x)+(p.y-u.y)*(v.y-p.y))/(distance(u,p)*distance(p,v)||1);return Math.acos(Math.max(-1,Math.min(1,dot)))>.65;});
 const curved=!sharp&&nodes.length>2,points=curved?simplify(ps,diag*.012).map(p=>({...p,nodeType:'smooth'})):nodes;
 return createObject('VectorPath',{...opts,kind:curved?'curve':'polyline',curved,position:{x:0,y:0},points});
}
export function planeMetrics(o){const unit=Math.min(Math.max(1,o.width-40)/(o.xMax-o.xMin),Math.max(1,o.height-40)/(o.yMax-o.yMin));const left=(o.width-(o.xMax-o.xMin)*unit)/2,top=(o.height-(o.yMax-o.yMin)*unit)/2;return {unit,left,top,origin:{x:left-o.xMin*unit,y:top+o.yMax*unit}}}
export function snapPoint(p,objects,tolerance=10){let best=null,d=tolerance;for(const o of objects){if(o.type==='InkStroke'||o.type==='GuideObject')continue;let targets=o.points??[{x:o.width/2,y:o.height/2},...Object.values({a:{x:0,y:0},b:{x:o.width,y:0},c:{x:o.width,y:o.height},d:{x:0,y:o.height}})];if(o.type==='CartesianPlaneObject'){const m=planeMetrics(o),q=worldToLocal(p,o),step=m.unit*(o.interval??1);targets=[m.origin,{x:m.origin.x+Math.round((q.x-m.origin.x)/step)*step,y:m.origin.y+Math.round((q.y-m.origin.y)/step)*step}]}for(const q of targets){const w=localToWorld(q,o),n=distance(p,w);if(n<d){best=w;d=n}}}return best}
