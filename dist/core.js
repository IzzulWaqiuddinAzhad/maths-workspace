export const VERSION=1;
export const TYPES=['InkStroke','VectorPath','ShapeObject','CartesianPlaneObject','TextObject','ImageObject','GuideObject'];
export function createObject(type,properties={}){if(!TYPES.includes(type))throw Error('Unknown object type');return {...properties,id:crypto.randomUUID(),type,position:properties.position??{x:0,y:0},rotation:properties.rotation??0,scale:properties.scale??{x:1,y:1},strokeColour:properties.strokeColour??'#202124',strokeWidth:properties.strokeWidth??2,fill:properties.fill??null,opacity:properties.opacity??1,locked:properties.locked??false,zIndex:properties.zIndex??0};}
export function newDocument(){return {schemaVersion:VERSION,id:crypto.randomUUID(),title:'Untitled notebook',objects:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
export function validateDocument(d){
  const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e9;
  if(!d||d.schemaVersion!==VERSION||typeof d.id!=='string'||typeof d.title!=='string'||d.title.length>100||!Array.isArray(d.objects)||d.objects.length>20000)return false;
  const ids=new Set();return d.objects.every(o=>{
    if(!o||typeof o.id!=='string'||ids.has(o.id)||!TYPES.includes(o.type)||!finite(o.position?.x)||!finite(o.position?.y)||!finite(o.rotation)||!finite(o.scale?.x)||!finite(o.scale?.y)||Math.abs(o.scale.x)<.0001||Math.abs(o.scale.y)<.0001)return false;
    ids.add(o.id);
    if(!finite(o.strokeWidth)||o.strokeWidth<0||typeof o.strokeColour!=='string'||!finite(o.opacity)||o.opacity<0||o.opacity>1)return false;
    if(o.points&&(!Array.isArray(o.points)||o.points.length>200000||!o.points.every(p=>finite(p.x)&&finite(p.y)&&(p.pressure===undefined||finite(p.pressure)))))return false;
    if(o.type==='InkStroke'&&(!o.points||!o.points.length))return false;
    if(o.width!==undefined&&(!finite(o.width)||o.width<0))return false;
    if(o.height!==undefined&&(!finite(o.height)||o.height<0))return false;
    if(o.type==='TextObject'&&(typeof o.text!=='string'||o.text.length>100000||!finite(o.fontSize)||o.fontSize<1||typeof o.fontFamily!=='string'))return false;
    if(o.type==='ImageObject'&&(typeof o.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(o.src)))return false;
    if(o.type==='CartesianPlaneObject'&&(![o.xMin,o.xMax,o.yMin,o.yMax,o.interval].every(finite)||o.interval<=0||o.xMax-o.xMin<1||o.xMax-o.xMin>200||o.yMax-o.yMin<1||o.yMax-o.yMin>200))return false;
    return true;
  });
}
export class DocumentStore{constructor(doc=newDocument()){this.document=structuredClone(doc);this.past=[];this.future=[];this.listeners=new Set()}subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}emit(){this.listeners.forEach(fn=>fn(this.document))}transact(change){const before=structuredClone(this.document);const next=structuredClone(before);change(next);if(JSON.stringify(before)===JSON.stringify(next))return false;this.past.push(before);if(this.past.length>100)this.past.shift();this.future=[];next.updatedAt=new Date().toISOString();this.document=next;this.emit();return true}undo(){if(!this.past.length)return;this.future.push(this.document);this.document=this.past.pop();this.emit()}redo(){if(!this.future.length)return;this.past.push(this.document);this.document=this.future.pop();this.emit()}}
export function screenToWorld(p,v){return {x:(p.x-v.x)/v.zoom,y:(p.y-v.y)/v.zoom}}
export function worldToScreen(p,v){return {x:p.x*v.zoom+v.x,y:p.y*v.zoom+v.y}}
export function zoomAt(v,p,factor){const w=screenToWorld(p,v);const zoom=Math.min(8,Math.max(.1,v.zoom*factor));return {x:p.x-w.x*zoom,y:p.y-w.y*zoom,zoom}}
export function validView(v){return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.zoom)&&v.zoom>=.1&&v.zoom<=8}
