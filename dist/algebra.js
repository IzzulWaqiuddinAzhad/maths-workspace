// Bounded, non-executable expression parser for Cartesian equations and inequalities.
const functions={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp};
export function compileExpression(source){
 const s=source.replace(/\s/g,'').replaceAll('−','-').replaceAll('×','*').replaceAll('÷','/').replaceAll('π','pi').replaceAll('²','^2').replaceAll('³','^3');
 if(!s||s.length>250)throw Error('expression');const ts=s.match(/(?:\d*\.)?\d+(?:[eE][+-]?\d+)?|asin|acos|atan|sqrt|sin|cos|tan|abs|exp|log|ln|pi|[xye()+*/^,-]/g)||[];
 if(ts.join('')!==s)throw Error('expression');let i=0,depth=0;
 const atom=()=>{if(++depth>40)throw Error('expression');const t=ts[i++];let f;if(t==='('){f=sum();if(ts[i++]!==')')throw Error('expression');}else if(/^(?:\d*\.)?\d/.test(t||'')){const n=Number(t);f=()=>n;}else if(t==='x'||t==='y')f=(x,y)=>t==='x'?x:y;else if(t==='pi'||t==='e'){const n=t==='pi'?Math.PI:Math.E;f=()=>n;}else if(functions[t]){if(ts[i++]!=='(')throw Error('expression');const a=sum();if(ts[i++]!==')')throw Error('expression');f=(x,y)=>functions[t](a(x,y));}else throw Error('expression');depth--;return f;};
 const power=()=>{const a=atom();if(ts[i]!=='^')return a;i++;const b=unary();return(x,y)=>a(x,y)**b(x,y);};
 const unary=()=>{if(ts[i]==='-'||ts[i]==='+'){const negative=ts[i++]==='-',a=unary();return(x,y)=>(negative?-1:1)*a(x,y);}return power();};
 const product=()=>{let a=unary();while(i<ts.length){const t=ts[i],implicit=t==='('||/^[a-z]/.test(t);if(!['*','/'].includes(t)&&!implicit)break;if(!implicit)i++;const left=a,right=unary();a=t==='/'?(x,y)=>left(x,y)/right(x,y):(x,y)=>left(x,y)*right(x,y);}return a;};
 const sum=()=>{let a=product();while(ts[i]==='+'||ts[i]==='-'){const t=ts[i++],left=a,right=product();a=t==='+'?(x,y)=>left(x,y)+right(x,y):(x,y)=>left(x,y)-right(x,y);}return a;};
 const result=sum();if(i!==ts.length)throw Error('expression');result.variables=new Set(ts.filter(t=>t==='x'||t==='y'));return result;
}
export function compileRelation(source){
 let s=source.trim().replaceAll('≤','<=').replaceAll('≥','>=').replace(/^f\s*\(\s*x\s*\)\s*=/,'y=');const parts=s.split(/(<=|>=|=|<|>)/);if(parts.length===1)s='y='+s;const p=s.split(/(<=|>=|=|<|>)/);if(p.length!==3||!p[0]||!p[2])throw Error('relation');
 const left=compileExpression(p[0]),right=compileExpression(p[2]),op=p[1],axis=/^\s*[xy]\s*$/.test(p[0])?p[0].trim():null;
 const explicit=axis&&!right.variables.has(axis);
 return {op,axis:explicit?axis:null,at:right,difference:(x,y)=>left(x,y)-right(x,y),accept:v=>op==='<'?v<0:op==='<='?v<=0:op==='>'?v>0:op==='>='?v>=0:Math.abs(v)<1e-9};
}
const cache=new Map();
export function drawFunctions(ctx,o,metrics){
 const {unit,left,top,origin}=metrics,w=(o.xMax-o.xMin)*unit,h=(o.yMax-o.yMin)*unit;ctx.save();ctx.beginPath();ctx.rect(left,top,w,h);ctx.clip();
 for(const item of o.functions??[]){if(item.visible===false)continue;let relation=cache.get(item.source);if(!relation){try{relation=compileRelation(item.source);}catch{continue;}if(cache.size>100)cache.clear();cache.set(item.source,relation);}
 const {axis,op,at,difference,accept}=relation,colour=item.colour||'#2563eb';ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=2;ctx.setLineDash(op==='<'||op==='>'?[6,4]:[]);
 if(axis){const vertical=axis==='x',from=vertical?o.yMin:o.xMin,to=vertical?o.yMax:o.xMax,steps=Math.min(1600,Math.max(100,Math.ceil(vertical?h:w))),point=(t,v)=>vertical?{x:origin.x+v*unit,y:origin.y-t*unit}:{x:origin.x+t*unit,y:origin.y-v*unit};let previous=null;ctx.beginPath();for(let i=0;i<=steps;i++){const t=from+(to-from)*i/steps,v=vertical?at(0,t):at(t,0),p=point(t,v);if(!Number.isFinite(v)){previous=null;continue;}if(op!=='='){ctx.save();ctx.globalAlpha=.13;const low=op.startsWith('<');if(vertical){const x=Math.max(left,Math.min(left+w,p.x));ctx.fillRect(low?left:x,p.y-(h/steps),low?x-left:left+w-x,h/steps+1);}else{const y=Math.max(top,Math.min(top+h,p.y));ctx.fillRect(p.x,low?y:top,w/steps+1,low?top+h-y:y-top);}ctx.restore();}
 const mid=previous?(vertical?at(0,(previous.t+t)/2):at((previous.t+t)/2,0)):NaN,range=vertical?o.xMax-o.xMin:o.yMax-o.yMin;
 if(previous&&Number.isFinite(mid)&&Math.abs(mid-(previous.v+v)/2)<range*.2&&Math.abs(v-previous.v)<range*2){ctx.moveTo(previous.p.x,previous.p.y);ctx.lineTo(p.x,p.y);}previous={p,t,v};}ctx.stroke();
 }else{const nx=Math.min(120,Math.max(30,Math.ceil(w/5))),ny=Math.min(120,Math.max(30,Math.ceil(h/5))),dx=w/nx,dy=h/ny,values=Array.from({length:ny+1},(_,j)=>Array.from({length:nx+1},(_,i)=>difference(o.xMin+i*(o.xMax-o.xMin)/nx,o.yMax-j*(o.yMax-o.yMin)/ny)));ctx.beginPath();for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const ps=[{x:left+i*dx,y:top+j*dy},{x:left+(i+1)*dx,y:top+j*dy},{x:left+(i+1)*dx,y:top+(j+1)*dy},{x:left+i*dx,y:top+(j+1)*dy}],vs=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]];if(vs.some(v=>!Number.isFinite(v)))continue;if(op!=='='&&accept(vs.reduce((a,b)=>a+b)/4)){ctx.save();ctx.globalAlpha=.13;ctx.fillRect(ps[0].x,ps[0].y,dx+.5,dy+.5);ctx.restore();}const crossings=[];for(let k=0;k<4;k++){const n=(k+1)%4;if((vs[k]<=0)===(vs[n]<=0))continue;const t=vs[k]/(vs[k]-vs[n]);crossings.push({x:ps[k].x+(ps[n].x-ps[k].x)*t,y:ps[k].y+(ps[n].y-ps[k].y)*t});}for(let k=0;k+1<crossings.length;k+=2){ctx.moveTo(crossings[k].x,crossings[k].y);ctx.lineTo(crossings[k+1].x,crossings[k+1].y);}}ctx.stroke();}
 }ctx.restore();
}
