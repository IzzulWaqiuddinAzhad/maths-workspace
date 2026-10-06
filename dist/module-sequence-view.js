// The overview is a view of revealed lesson state, never a second answer engine.
// Stable nodes let letters travel from the composition to their actual arrows.
export function createSequenceOverview(host, {onBusyChange=()=>{},onCoordinateReveal=()=>{}}={}) {
  let key=null,previous=null,running=[],generation=0,busy=false;
  const setBusy=value=>{if(busy!==value){busy=value;queueMicrotask(onBusyChange);}};
  const cancel=()=>{generation++;for(const a of running)a.cancel();running=[];setBusy(false);};
  const run=jobs=>{
    if(!jobs.length)return;
    cancel();const token=generation;setBusy(true);
    running=jobs.map(([node,frames,options])=>node.animate(frames,{easing:'cubic-bezier(.22,.68,.2,1)',fill:'backwards',...options}));
    Promise.all(running.map(a=>a.finished.catch(()=>{}))).then(()=>{if(token===generation){running=[];setBusy(false);}});
  };
  const update=({sequence,language='en',reducedMotion=false,describe})=>{
    const tr=(en,bm)=>language==='bm'?bm:en;
    if(!sequence){cancel();host.hidden=true;key=null;previous=null;return;}
    const q=sequence.question,nextKey=q.id+language;
    host.hidden=!sequence.started;
    if(key!==nextKey){
      cancel();key=nextKey;previous=null;
      const labels=[q.label,q.label+'′',q.label+'″'];
      const point=i=>`<div class="overview-point ${i===1?'intermediate':i===2?'mapping-image':''}" data-point="${i}"><span class="overview-point-name">${labels[i]}</span><strong class="overview-coordinate"></strong><small>${[tr('Original','Objek asal'),tr('Intermediate image','Imej perantaraan'),tr('Final image','Imej akhir')][i]}</small></div>`;
      const arrow=i=>`<div class="overview-transformation" data-step="${i}"><div class="overview-description"></div><div class="overview-arrow"><svg viewBox="0 0 160 24" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 12H156M146 3L156 12L146 21"/></svg><b class="overview-letter">${q.steps[i].symbol}</b></div></div>`;
      host.innerHTML=`<div class="overview-composition" aria-label="${q.composition}">${q.composition==='K²'?'<span class="composition-power">K² = </span>':''}<span data-source="1">${q.steps[1].symbol}</span><span data-source="0">${q.steps[0].symbol}</span></div><div class="overview-chain">${point(0)}${arrow(0)}${point(1)}${arrow(1)}${point(2)}</div><p class="sr-only" role="status" aria-live="polite"></p>`;
    }
    const stage=sequence.introStage,ready=stage>=2,values=sequence.overviewPoints;
    const snapshot={stage,values:values.map(p=>p?`${p.x},${p.y}`:null)};
    host.dataset.stage=stage;host.classList.toggle('overview-explained',ready);
    const format=p=>p?`(${String(p.x).replace('-','−')}, ${String(p.y).replace('-','−')})`:'( ?, ? )';
    if(previous&&values.some((p,i)=>i>0&&p&&!previous.values[i]))onCoordinateReveal();
    const jobs=[];
    for(let i=0;i<3;i++){
      const node=host.querySelector(`[data-point="${i}"] .overview-coordinate`);
      node.textContent=format(values[i]);node.classList.toggle('unknown',!values[i]);
      if(values[i]&&i>0&&previous&&!previous.values[i]&&!reducedMotion)jobs.push([node,[{opacity:0,transform:'translateY(15px) scale(.82)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:700}]);
    }
    for(let i=0;i<2;i++){
      const step=host.querySelector(`[data-step="${i}"]`),description=step.querySelector('.overview-description'),letter=step.querySelector('.overview-letter');
      description.textContent=ready?describe(q.steps[i]):'';
      letter.style.visibility=ready?'visible':'hidden';
      step.classList.toggle('current',sequence.teachingReady&&sequence.index===i);
      if(stage===1&&previous?.stage!==1&&!reducedMotion)jobs.push([step.querySelector('path'),[{strokeDashoffset:1},{strokeDashoffset:0}],{duration:850,delay:i*200}]);
      if(stage===2&&previous?.stage===1&&!reducedMotion){
        const from=host.querySelector(`[data-source="${i}"]`).getBoundingClientRect(),to=letter.getBoundingClientRect();
        jobs.push([letter,[{transform:`translate(${from.x+from.width/2-to.x-to.width/2}px,${from.y+from.height/2-to.y-to.height/2}px) scale(1.45)`,opacity:1},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:1100,delay:i*450}]);
        jobs.push([description,[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,delay:900+i*450}]);
      }
    }
    const source=q.composition==='K²'?'K²':q.composition;
    host.querySelector('[role="status"]').textContent=sequence.started?`${source}. ${values.map((p,i)=>`${q.label}${i===1?'′':i===2?'″':''} ${p?format(p):tr('not revealed','belum didedahkan')}`).join(' → ')}${ready?' '+q.steps.map(describe).join('; '):''}`:'';
    const rewound=previous&&stage<previous.stage;
    previous=snapshot;
    if(reducedMotion||rewound||!sequence.started)cancel();
    else run(jobs);
  };
  return {update,cancel,get busy(){return busy;}};
}
