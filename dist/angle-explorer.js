// Data-driven angle-sum explorations. Geometry (ray directions) is kept separate
// from the labels used by quiz questions so the same engine can teach and assess.
export const EXPLORATIONS={
  straight:{id:'straight-line-angle-sum',topic:'Lines and Angles',title:'Angles on a Straight Line',mode:'straightLine',fixedTotal:180,minRays:2,maxRays:8},
  circle:{id:'angles-around-point',topic:'Lines and Angles',title:'Angles Around a Point',mode:'fullCircle',fixedTotal:360,minRays:1,maxRays:8}
};
export function regionsFromRays(rays,total=360){
  const ordered=[...rays].map((angle,id)=>({angle:((angle%360)+360)%360,id})).sort((a,b)=>a.angle-b.angle);
  return ordered.map((ray,i)=>({id:`region-${ray.id}`,startRayId:ray.id,endRayId:ordered[(i+1)%ordered.length].id,currentValue:((ordered[(i+1)%ordered.length].angle-ray.angle+360)%360)||total}));
}
export function straightRegions(interior){
  const rays=[180,...interior.sort((a,b)=>b-a),0];
  return rays.slice(0,-1).map((angle,i)=>({id:`region-${i}`,startRayId:i,endRayId:i+1,currentValue:rays[i]-rays[i+1]}));
}
export function equation(regions,total,precision=1){return `${regions.map(r=>`${Number(r.currentValue.toFixed(precision))}°`).join(' + ')} = ${total}°`}
export {mountAngleExplorer} from './angle-ui.js?v=7';
import {quizQuestion} from './angle-model.js?v=7';
export function generateQuestion({mode='straight',difficulty=1,tier}={}){return quizQuestion(mode,tier??(difficulty>=4?3:difficulty));}
