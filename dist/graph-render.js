import {renderObject,prepareImages} from './render.js?v=14';
import {renderSceneAnnotations} from './annotations.js?v=14';
import {corners,worldToLocal} from './geometry.js?v=14';
import {graphContents} from './graph-model.js?v=14';
function clipGraph(ctx,plane){const ps=corners(plane);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();}
export function renderGraphScene(ctx,objects,dark,refresh,environment){const planes=new Map(objects.filter(o=>o.type==='CartesianPlaneObject').map(o=>[o.id,o]));for(const o of objects){const plane=planes.get(o.graphId);ctx.save();if(plane)clipGraph(ctx,plane);renderObject(ctx,o,dark,refresh);ctx.restore();}
 renderSceneAnnotations(ctx,objects.filter(o=>!planes.has(o.graphId)),dark,environment);
 for(const plane of planes.values()){const children=objects.filter(o=>o.graphId===plane.id);if(!children.length)continue;ctx.save();clipGraph(ctx,plane);ctx.translate(plane.position.x,plane.position.y);ctx.rotate(plane.rotation);ctx.scale(plane.scale.x,plane.scale.y);
 const local=children.map(o=>({...o,position:worldToLocal(o.position,plane),rotation:o.rotation-plane.rotation,scale:{x:o.scale.x/plane.scale.x,y:o.scale.y/plane.scale.y}}));renderSceneAnnotations(ctx,local,dark);ctx.restore();}}
export async function createGraphPNG(plane,objects){const content=structuredClone(graphContents(objects,plane));for(const o of content)if(o.id!==plane.id)o.graphId=plane.id;
 // Decode images before using the same scene compositor as the workspace.
 await prepareImages(content);
 const margin=16,w=plane.width+2*margin,h=plane.height+2*margin,resolution=Math.min(4,4096/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.ceil(w*resolution);canvas.height=Math.ceil(h*resolution);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(resolution,resolution);ctx.translate(margin,margin);ctx.scale(1/plane.scale.x,1/plane.scale.y);ctx.rotate(-plane.rotation);ctx.translate(-plane.position.x,-plane.position.y);
 renderGraphScene(ctx,content,false,()=>{},undefined);
 return canvas;
}
export async function downloadGraphPNG(plane,objects){const canvas=await createGraphPNG(plane,objects);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cartesian-graph.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return {width:canvas.width,height:canvas.height};}
