// Data-driven angle-sum explorations. Geometry (ray directions) is kept separate
// from the labels used by quiz questions so the same engine can teach and assess.
export const EXPLORATIONS={
  straight:{id:'straight-line-angle-sum',topic:'Lines and Angles',title:'Angles on a Straight Line',mode:'straightLine',fixedTotal:180,minRays:3,maxRays:7},
  circle:{id:'angles-around-point',topic:'Lines and Angles',title:'Angles Around a Point',mode:'fullCircle',fixedTotal:360,minRays:3,maxRays:8}
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
export function generateQuestion({mode='straight',difficulty=1}={}){
  const total=mode==='circle'?360:180, algebra=difficulty>=4;
  const count=algebra?3:Math.min(4,Math.max(2,difficulty+1));
  const symbol=Math.random()<.5?'x':'θ';
  let values,labels,answer,steps;
  if(algebra){
    const coefficient=Math.random()<.5?2:3, constant=mode==='circle'?60:60;
    answer=(total-constant)/(coefficient+1);
    if(!Number.isInteger(answer)||answer<15)answer=mode==='circle'?75:40;
    const fixed=total-answer*(coefficient+1), expr=[symbol,`${coefficient}${symbol}`,`${fixed}°`];
    values=[answer,coefficient*answer,fixed]; labels=expr;
    steps=[`${symbol} + ${coefficient}${symbol} + ${fixed} = ${total}`,`${coefficient+1}${symbol} + ${fixed} = ${total}`,`${coefficient+1}${symbol} = ${total-fixed}`,`${symbol} = ${answer}`];
  }else{
    const unknown=Math.floor(Math.random()*count), known=[];
    for(let i=0;i<count-1;i++)known.push(20+Math.floor(Math.random()*Math.max(15,(total-70)/(count-1))));
    const knownTotal=known.reduce((a,b)=>a+b,0); answer=total-knownTotal;
    if(answer<15){known[0]-=15-answer;answer=15}
    values=[];let k=0;for(let i=0;i<count;i++)values.push(i===unknown?answer:known[k++]);
    labels=values.map((v,i)=>i===unknown?symbol:`${v}°`);
    steps=[`${labels.join(' + ')} = ${total}`,`${symbol} = ${answer}`];
  }
  // Values are generated first; the compatible ray arrangement follows from them.
  // Keeping the first ray fixed also keeps each diagram label aligned to its region.
  const rays=values.slice(0,-1).reduce((out,v)=>{out.push(out.at(-1)+v);return out},[mode==='circle'?0:180]);
  return {mode,total,difficulty,algebra,symbol,values,labels,answer,steps,rays,unknownIndex:labels.findIndex(x=>x.includes(symbol))};
}
function polar(cx,cy,r,a){const q=a*Math.PI/180;return{x:cx+r*Math.cos(q),y:cy-r*Math.sin(q)}}
function labelAngle(a,b){return ((a+b)/2+360)%360}
export function mountAngleExplorer({trigger,language=()=> 'en'}={}){
  const dialog=document.createElement('dialog');dialog.id='angleExplorer';dialog.className='angle-explorer';document.body.append(dialog);
  let mode='straight',interior=[112],circleRays=[20,145,275],revealed=false,question=null,attempts=0,streak=0,dragIndex=null;
  const tr=(en,bm)=>language()==='bm'?bm:en;
  const total=()=>EXPLORATIONS[mode].fixedTotal;
  const regions=()=>mode==='straight'?straightRegions(interior):regionsFromRays(circleRays,total());
  const rays=()=>mode==='straight'?[180,...interior,0]:circleRays;
  function renderCanvas(canvas,labels=null){const c=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=box.width,h=box.height;canvas.width=w*dpr;canvas.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const cx=w/2,cy=h/2,r=Math.min(w,h)*.34,rs=rays(),regs=regions();c.lineWidth=2;c.strokeStyle='#2a3342';c.fillStyle='#edf3ff';if(mode==='straight'){const left=polar(cx,cy,r,180),right=polar(cx,cy,r,0);c.beginPath();c.moveTo(left.x,left.y);c.lineTo(right.x,right.y);c.stroke()}else{c.beginPath();c.arc(cx,cy,3,0,Math.PI*2);c.fill()}regs.forEach((reg,i)=>{const a=rs[i],b=i===rs.length-1?rs[0]+360:rs[i+1],mid=labelAngle(a,b);c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r*.42,-a*Math.PI/180,-b*Math.PI/180,true);c.closePath();c.fillStyle=i%2?'#e9effb':'#dce8ff';c.fill();const p=polar(cx,cy,r*.62,mid);c.fillStyle='#172033';c.font='600 15px Inter, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(labels?.[i]??`${reg.currentValue.toFixed(1)}°`,p.x,p.y)});rs.forEach((angle,i)=>{const end=polar(cx,cy,r,angle);c.strokeStyle='#26354e';c.lineWidth=(mode==='straight'&&(i===0||i===rs.length-1))?3:2;c.beginPath();c.moveTo(cx,cy);c.lineTo(end.x,end.y);c.stroke();if(!(mode==='straight'&&(i===0||i===rs.length-1))){c.fillStyle='#356dca';c.beginPath();c.arc(end.x,end.y,7,0,Math.PI*2);c.fill()}});c.fillStyle='#172033';c.beginPath();c.arc(cx,cy,4,0,Math.PI*2);c.fill()}
  function addRay(){if(mode==='straight'){if(interior.length>=EXPLORATIONS.straight.maxRays-2)return;const rs=regions();const largest=rs.reduce((best,x,i)=>x.currentValue>rs[best].currentValue?i:best,0);const a=largest===0?180:interior[largest-1],b=largest===interior.length?0:interior[largest];interior.push((a+b)/2);interior.sort((a,b)=>b-a)}else{if(circleRays.length>=EXPLORATIONS.circle.maxRays)return;const rs=regions(),largest=rs.reduce((best,x,i)=>x.currentValue>rs[best].currentValue?i:best,0),a=circleRays[largest],b=largest===circleRays.length-1?circleRays[0]+360:circleRays[largest+1];circleRays.push(((a+b)/2)%360);circleRays.sort((a,b)=>a-b)}revealed=false;render()}
  function makeQuiz(){question=generateQuestion({mode,difficulty:streak>=3?4:Math.min(3,1+Math.floor(streak/2))});attempts=0;revealed=false;if(mode==='straight'){let cursor=180;interior=question.values.slice(0,-1).map(v=>(cursor-=v)).sort((a,b)=>b-a)}else circleRays=question.rays.map(x=>((x%360)+360)%360).sort((a,b)=>a-b);render()}
  function submit(){if(!question)return;const input=dialog.querySelector('#angleAnswer'),value=Number(input.value);const note=dialog.querySelector('#quizFeedback');attempts++;if(Number.isFinite(value)&&Math.abs(value-question.answer)<.01){streak++;note.className='feedback correct';note.textContent=tr('Correct — ','Betul — ')+question.steps.at(-1);dialog.querySelector('#showWorking').hidden=false}else{streak=0;note.className='feedback';note.textContent=attempts>=2?`${tr('Worked relationship: ','Hubungan: ')}${question.steps.join(' → ')}`:tr(`Remember: these angles total ${question.total}°.`,`Ingat: jumlah sudut ini ialah ${question.total}°.`)}}
  function bindCanvas(canvas){canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,cx=r.width/2,cy=r.height/2,ang=(Math.atan2(cy-y,x-cx)*180/Math.PI+360)%360,all=rays();let closest=-1,best=16;all.forEach((a,i)=>{if(mode==='straight'&&(i===0||i===all.length-1))return;const d=Math.abs(((ang-a+540)%360)-180);if(d<best){best=d;closest=i}});if(closest>=0){dragIndex=closest;canvas.setPointerCapture(e.pointerId)}};canvas.onpointermove=e=>{if(dragIndex===null||question)return;const r=canvas.getBoundingClientRect(),ang=(Math.atan2(r.height/2-(e.clientY-r.top),e.clientX-r.width/2)*180/Math.PI+360)%360;if(mode==='straight'){const val=Math.max(1,Math.min(179,180-ang));interior[dragIndex-1]=val;interior.sort((a,b)=>b-a)}else{circleRays[dragIndex]=ang;circleRays.sort((a,b)=>a-b)}revealed=true;render()};canvas.onpointerup=()=>dragIndex=null}
  function render(){const exp=EXPLORATIONS[mode],r=regions(),quiz=!!question;dialog.innerHTML=`<button class="close explorer-close" aria-label="Close">×</button><div class="explorer-head"><div><span class="explorer-kicker">${tr('Lines and Angles','Garis dan Sudut')}</span><h2>${quiz?tr('Quiz Yourself','Uji Diri'):tr(exp.title,mode==='straight'?'Sudut pada Garis Lurus':'Sudut di Sekeliling Titik')}</h2></div><div class="explorer-tabs"><button data-mode="straight" class="${mode==='straight'?'active':''}">${tr('Straight line','Garis lurus')}</button><button data-mode="circle" class="${mode==='circle'?'active':''}">${tr('Around a point','Sekeliling titik')}</button></div></div><div class="explorer-grid"><section><canvas class="angle-stage" aria-label="Interactive angle diagram"></canvas><p class="angle-instruction">${quiz?tr(`Find ${question.symbol}.`,`Cari ${question.symbol}.`):tr('Drag a blue ray to explore.','Seret sinar biru untuk meneroka.')}</p></section><section class="explorer-side"><div class="total-card"><span>${tr('Angle relationship','Hubungan sudut')}</span><strong>${revealed?equation(r,total()):tr('Move a ray, then reveal the relationship.','Gerakkan sinar, kemudian dedahkan hubungan.')}</strong></div>${quiz?`<div class="quiz-card"><p>${question.algebra?tr('The labels are expressions. Find the value of the symbol.','Label ialah ungkapan. Cari nilai simbol.') :tr('Use the diagram and angle-sum relationship.','Gunakan rajah dan hubungan jumlah sudut.')}</p><label>${question.symbol} = <input id="angleAnswer" type="number" inputmode="decimal" step="any" autofocus></label><button class="primary" id="submitAngle">${tr('Submit','Hantar')}</button><p id="quizFeedback" class="feedback" aria-live="polite"></p><button id="showWorking" hidden>${tr('Show working','Tunjuk cara kerja')}</button><pre id="working" hidden>${question.steps.join('\n')}</pre><button id="nextQuestion">${tr('New question','Soalan baharu')}</button></div>`:`<div class="explorer-actions"><button class="primary" id="addRay">+ ${tr('Add Ray','Tambah sinar')}</button><button id="reveal">${tr('Reveal relationship','Dedahkan hubungan')}</button><button id="startQuiz">${tr('Quiz Yourself','Uji Diri')}</button></div><p class="explorer-note">${tr(`${r.length} adjacent angles always make ${total()}°.`,`${r.length} sudut bersebelahan sentiasa berjumlah ${total()}°.`)}</p>`}</section></div>`;const canvas=dialog.querySelector('canvas');renderCanvas(canvas,quiz?question.labels:null);bindCanvas(canvas);dialog.querySelector('.explorer-close').onclick=()=>dialog.close();dialog.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;question=null;revealed=false;render()});if(quiz){dialog.querySelector('#submitAngle').onclick=submit;dialog.querySelector('#angleAnswer').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};dialog.querySelector('#nextQuestion').onclick=makeQuiz;dialog.querySelector('#showWorking').onclick=()=>dialog.querySelector('#working').hidden=false}else{dialog.querySelector('#addRay').onclick=addRay;dialog.querySelector('#reveal').onclick=()=>{revealed=true;render()};dialog.querySelector('#startQuiz').onclick=makeQuiz}}
  trigger.onclick=()=>{question=null;revealed=false;dialog.showModal();render()};return {open:()=>trigger.click(),definitions:EXPLORATIONS};
}
