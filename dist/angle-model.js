import {screenToWorld} from './core.js?v=14';
const norm=a=>(a%360+360)%360;
let serial=0;
export class AngleModel {
  constructor(mode='straight'){this.mode=mode;this.total=mode==='straight'?180:360;this.rays=mode==='straight'?[this.ray(0,true),this.ray(180,true)]:[this.ray(0)];}
  ray(angle,isFixed=false){return{id:`ray-${++serial}`,angle,isFixed,createdAt:serial};}
  regions(){const sorted=[...this.rays].sort((a,b)=>a.angle-b.angle);return sorted.slice(0,this.mode==='straight'?-1:undefined).map((a,i)=>{const b=sorted[(i+1)%sorted.length];return{id:a.id,startRayId:a.id,endRayId:b.id,start:a.angle,currentValue:sorted.length===1?360:(b.angle-a.angle+360)%360};});}
  add(){if(this.rays.length>=8)return;const r=this.regions().reduce((a,b)=>a.currentValue>b.currentValue?a:b);this.rays.push(this.ray(norm(r.start+r.currentValue/2)));}
  remove(){const candidates=this.rays.filter(r=>!r.isFixed);if(this.mode==='circle'&&candidates.length===1)return;const newest=candidates.sort((a,b)=>b.createdAt-a.createdAt)[0];if(newest)this.rays=this.rays.filter(r=>r.id!==newest.id);}
  move(id,p){const ray=this.rays.find(r=>r.id===id);if(!ray||ray.isFixed||Math.hypot(p.x,p.y)<1)return;let a=Math.atan2(-p.y,p.x)*180/Math.PI;if(this.mode==='straight')a=Math.max(.1,Math.min(179.9,a<0?(p.x<0?180:0):a));else a=norm(a);for(const other of this.rays){if(other.id!==id&&Math.abs(((a-other.angle+540)%360)-180)<.05)a=norm(other.angle+.1);}ray.angle=a;}
}
export function displayValues(regions,total){const scaled=regions.map(r=>r.currentValue*10),units=scaled.map(Math.floor);let rest=Math.round(total*10)-units.reduce((s,n)=>s+n,0);const order=scaled.map((v,i)=>({i,remainder:v-units[i]})).sort((a,b)=>b.remainder-a.remainder);for(let i=0;i<rest;i++)units[order[i%order.length].i]++;return units.map(n=>(n/10).toFixed(1));}
export function pointerWorld(e,rect,view){return screenToWorld({x:e.clientX-rect.left,y:e.clientY-rect.top},view);}
export const TIERS=[['Find the Missing Angle','Cari Sudut Hilang','One unknown angle.','Satu sudut tidak diketahui.'],['Multiple Angles','Berbilang Sudut','Combine several known angles.','Gabungkan beberapa sudut diketahui.'],['Simple Algebra','Algebra Mudah','Work with x, 2x and 3x.','Gunakan x, 2x dan 3x.'],['Multi-Term Algebra','Algebra Berbilang Sebutan','Solve expressions such as x + 10.','Selesaikan ungkapan seperti x + 10.'],['Challenge','Cabaran','More expressions and varied diagrams.','Lebih banyak ungkapan dan pelbagai rajah.']];
// Uniform random integer composition: unlike repeated increments, this does not
// concentrate every part near the mean.
function split(total,count,min=15,rng=Math.random){if(count===1)return[total];const cuts=new Set(),slots=total-count*min+count-1;while(cuts.size<count-1)cuts.add(1+Math.floor(rng()*slots));const boundaries=[0,...[...cuts].sort((a,b)=>a-b),slots+1];return boundaries.slice(1).map((v,i)=>v-boundaries[i]-1+min);}
export function quizQuestion(mode,tier,rng=Math.random){
 if(!['straight','circle'].includes(mode)||!Number.isInteger(tier)||tier<1||tier>5)throw Error('Invalid topic or tier');
 const rand=(a,b)=>a+Math.floor(rng()*(b-a+1));
 const total=mode==='straight'?180:360,algebra=tier>=3,symbol=algebra?'x':rng()<.5?'x':'θ';let terms,answer;
 if(!algebra){const count=tier===1?(mode==='straight'?2:3):rand(3,5),unknown=rand(0,count-1);answer=rand(15,total-(count-1)*15);const known=split(total-answer,count-1,15,rng);terms=Array.from({length:count},(_,i)=>i===unknown?{a:1,b:0}:{a:0,b:known.shift()});}
 else {const coefficients=tier===3?[1,rand(2,3)]:tier===4?[1,2]:[1,2,3];const constants=tier===3?coefficients.map(()=>0):tier===4?[rand(1,4)*5,0]:[10,-5,15];const sumA=coefficients.reduce((a,b)=>a+b,0),sumB=constants.reduce((a,b)=>a+b,0);answer=rand(12,Math.floor((total-sumB-35)/sumA));terms=coefficients.map((a,i)=>({a,b:constants[i]}));const remaining=total-sumA*answer-sumB;terms.push(...split(remaining,mode==='circle'?2:1,15,rng).map(b=>({a:0,b})));}
 for(let i=terms.length-1;i>0;i--){const j=rand(0,i);[terms[i],terms[j]]=[terms[j],terms[i]];}const expr=t=>t.a?`${t.a===1?'':t.a}${symbol}${t.b?` ${t.b<0?'−':'+'} ${Math.abs(t.b)}`:''}`:String(t.b);
 const values=terms.map(t=>t.a*answer+t.b),labels=terms.map(t=>expr(t)+(t.a?'':'°')),sumA=terms.reduce((s,t)=>s+t.a,0),sumB=terms.reduce((s,t)=>s+t.b,0);
 const steps=[`${terms.map(expr).join(' + ')} = ${total}`,`${sumA===1?'':sumA}${symbol} + ${sumB} = ${total}`,`${sumA===1?'':sumA}${symbol} = ${total-sumB}`,`${symbol} = ${answer}`];
 return{mode,tier,total,algebra,symbol,answer,terms,values,labels,steps,rotation:rand(0,359)};
}
// Recursive descent: arithmetic only; no evaluation of JavaScript or quiz data.
export function calculate(source){const tokens=source.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').match(/\d*\.?\d+|[()+*/-]/g)||[];if(tokens.join('')!==source.replace(/\s/g,'').replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-'))throw Error('Invalid');let i=0;const atom=()=>{if(tokens[i]==='-'){i++;return-atom()}if(tokens[i]==='+'){i++;return atom()}if(tokens[i]==='('){i++;const v=add();if(tokens[i++]!==')')throw Error('Invalid');return v}const n=Number(tokens[i++]);if(!Number.isFinite(n))throw Error('Invalid');return n};const mul=()=>{let v=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=atom();v=op==='*'?v*b:v/b}return v};const add=()=>{let v=mul();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=mul();v=op==='+'?v+b:v-b}return v};const value=add();if(i!==tokens.length||!Number.isFinite(value))throw Error('Invalid');return Number(value.toPrecision(12));}
