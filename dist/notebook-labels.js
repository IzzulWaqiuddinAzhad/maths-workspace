import {LabelLayout} from './label-layout.js?v=14';
import {PRINTED_LABELS,PRINTED_OBJECT_LABELS} from './notebook-assets/label-anchors.js?v=2';
import {coordinateReadoutLayout,paintCoordinateReadout,paintCoordinateGuide,isOrigin} from './module-coordinate-guide.js?v=4';
import {graphToScreen} from './transform-model.js?v=29';
import {localToWorld,corners} from './geometry.js?v=14';

// One screen-space layout for printed labels, created images and coordinate
// reveals. Geometry is collected first, so labels can avoid every visible layer.
export class NotebookLabels {
  constructor(ctx,graph,viewport,annotations=[]){
    this.ctx=ctx;this.graph=graph;Object.assign(this,viewport);
    this.requests=new Map();this.printed=[];this.segments=[];this.points=[];this.boxes=[];
    const screen=p=>graphToScreen(p,this.view),b=graph.bounds;
    this.segments.push([screen({x:b.xmin,y:0}),screen({x:b.xmax,y:0})],[screen({x:0,y:b.ymin}),screen({x:0,y:b.ymax})]);
    // Reserve axis numerals as well as the thin axis strokes.
    for(let x=Math.ceil(b.xmin);x<=b.xmax;x++)if(x%2===0){const p=screen({x,y:0});this.boxes.push({x:p.x-13,y:p.y+5,w:26,h:24});}
    for(let y=Math.ceil(b.ymin);y<=b.ymax;y++)if(y%2===0){const p=screen({x:0,y});this.boxes.push({x:p.x-35,y:p.y-12,w:29,h:24});}
    for(const o of graph.session.base){
      const ps=o.points.map(screen);this.points.push(...ps);
      if(ps.length>1)for(let i=0;i<ps.length;i++)this.segments.push([ps[i],ps[(i+1)%ps.length]]);
    }
    const scale=40/graph.unit;
    for(const o of graph.session.base)for(const [i,a]of (PRINTED_LABELS[o.id]??[]).entries()){
      const point=o.points[i];if(!point)continue;
      const anchor={x:a.x*scale,y:(a.y-a.size*.35)*scale,fontSize:a.size*scale,text:a.text};
      const id=`printed:${anchor.x}:${anchor.y}`;if(this.requests.has(id))continue;
      this.printed.push({point,anchor,id});
      this.queue(point,a.text,{id,anchor,colour:'#20242c',pointMarker:false});
    }
    for(const o of graph.session.base){
      const a=PRINTED_OBJECT_LABELS[o.id];if(!a)continue;
      const point={x:a.point[0],y:a.point[1]},anchor={x:a.x*scale,y:(a.y-a.size*.35)*scale,fontSize:a.size*scale,text:a.text},id=`printed-object:${o.id}`;
      this.printed.push({point,anchor,id});this.queue(point,a.text,{id,anchor,colour:'#20242c',pointMarker:false});
    }
    const local=p=>({x:(p.x-graph.x)*scale,y:(p.y-graph.y)*scale});
    for(const o of annotations){
      const ps=(o.points?.length?o.points.map(p=>localToWorld(p,o)):corners(o)).map(local);
      if(!ps.length)continue;
      const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);
      if(Math.max(...xs)<0||Math.min(...xs)>this.width||Math.max(...ys)<0||Math.min(...ys)>this.height)continue;
      if(!o.points?.length)this.boxes.push({x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)});
      else for(let i=1;i<ps.length;i++)this.segments.push([ps[i-1],ps[i]]);
    }
  }
  collect({segments=[],points=[],obstacles=[]}={}){this.segments.push(...segments);this.points.push(...points);this.boxes.push(...obstacles);}
  queue(point,label,options={}){
    const printed=this.printed.find(p=>Math.hypot(p.point.x-point.x,p.point.y-point.y)<1e-8&&p.anchor.text.split('/').includes(label));
    const id=options.id??printed?.id??`${label}:${point.x.toFixed(6)}:${point.y.toFixed(6)}`;
    const old=this.requests.get(id),anchor=options.anchor??printed?.anchor??old?.anchor;
    this.requests.set(id,{...old,point,label:anchor?.text??label,colour:'#2468c4',...options,id,anchor,coordinates:!!(options.coordinates||old?.coordinates)});
  }
  maskPrinted(){
    const ctx=this.ctx;ctx.save();ctx.fillStyle='#fff';
    for(const {anchor:a}of this.printed){
      ctx.font=`700 ${a.fontSize}px Arial, sans-serif`;
      // The source letter is redrawn once with its pair. Mask before drawing
      // construction lines, so moving the letter never erases the construction.
      ctx.fillRect(a.x-2,a.y-a.fontSize*.78,ctx.measureText(a.text).width+4,a.fontSize*1.2);
    }
    ctx.restore();
  }
  place(){
    const ctx=this.ctx,layout=this.graph.pointLabels??=new LabelLayout();
    // Reserve projections throughout a readout's lifetime; finishing the
    // animation therefore cannot make its coordinates jump to another side.
    for(const r of this.requests.values()){
      const p=graphToScreen(r.point,this.view);if(r.pointMarker!==false)this.points.push(p);
      if(r.coordinates||r.guide)this.segments.push([p,graphToScreen({x:r.point.x,y:0},this.view)],[p,graphToScreen({x:0,y:r.point.y},this.view)]);
    }
    layout.begin({bounds:{x:3,y:3,w:this.width-6,h:this.height-82},segments:this.segments,points:this.points,segmentOverlapPenalty:10000,labelOverlapPenalty:10000});
    layout.placed.push(...this.boxes);
    const result=[];
    // Fixed printed identities first, then created images, then centre cues.
    for(const r of this.requests.values()){
      const fontSize=r.anchor?.fontSize??22,coords=(r.coordinates||r.guide)&&!isOrigin(r.point);
      const measured=coordinateReadoutLayout(ctx,{...this,point:r.point,label:r.label,placement:{fontSize}});
      ctx.save();ctx.font=`600 ${fontSize}px Arial, sans-serif`;
      const w=coords?measured.total:ctx.measureText(r.label).width;ctx.restore();
      const p=graphToScreen(r.point,this.view),ideal=r.anchor?{x:r.anchor.x+w/2,y:r.anchor.y}:r.pointMarker===false?p:{x:p.x+w/2+18,y:p.y-36};
      const candidates=[ideal];
      // Keep the entire pair together, with clear alternatives on all sides.
      for(const gap of [22,40,62,88,120,160,210])for(const [dx,dy]of [[1,-1],[-1,-1],[1,1],[-1,1],[0,-1],[0,1],[1,0],[-1,0]])
        candidates.push({x:p.x+dx*(w/2+gap),y:p.y+dy*(fontSize*.7+gap)});
      const placed=layout.place({id:r.id,text:r.label,width:w+8,height:fontSize*1.4+4,candidates});
      const placement={x:placed.x-w/2,y:placed.y,fontSize,preserveAnchor:true};
      result.push({...r,placement,box:{x:placement.x-4,y:placement.y-fontSize*.7-2,w:w+8,h:fontSize*1.4+4}});
    }
    layout.end();return result;
  }
  paint(now){
    const ctx=this.ctx,result=this.place();
    for(const r of result){
      const options={point:r.point,label:r.label,view:this.view,width:this.width,height:this.height,pointColour:r.colour,placement:r.placement};
      if(r.leader){
        const p=graphToScreen(r.point,this.view),b=r.box,end={x:Math.max(b.x,Math.min(b.x+b.w,p.x)),y:Math.max(b.y,Math.min(b.y+b.h,p.y))};
        if(Math.hypot(end.x-p.x,end.y-p.y)>58){ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(end.x,end.y);ctx.strokeStyle=r.colour+'90';ctx.lineWidth=1.2;ctx.setLineDash([3,4]);ctx.stroke();ctx.restore();}
      }
      if(r.guide){paintCoordinateGuide(ctx,{...r.guide,...options,elapsed:now-r.guide.start,transientReadout:r.guide.key==='centre'});continue;}
      if(r.coordinates&&!isOrigin(r.point)){paintCoordinateReadout(ctx,options);continue;}
      ctx.save();ctx.font=`600 ${r.placement.fontSize}px Arial, sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.strokeStyle='#fff';ctx.strokeText(r.label,r.placement.x,r.placement.y);ctx.fillStyle=r.colour;ctx.fillText(r.label,r.placement.x,r.placement.y);ctx.restore();
    }
    return result;
  }
}
