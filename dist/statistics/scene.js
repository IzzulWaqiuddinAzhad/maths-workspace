import {num,mixed,decimal,frequencyMap,modes,quantity} from './math.js?v=8';
import {meanState,meanValues,ownerTotal} from './model.js?v=8';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function fractionText(value,x,y,size=24){const m=mixed(value);if(m.n==='0')return `<text x="${x}" y="${y}" style="font-size:${size}px" text-anchor="middle">${m.sign}${m.whole}</text>`;
 const whole=m.whole==='0'?'':m.sign+m.whole,offset=whole?size*.55:0,fx=x+offset;return `<g style="font-size:${size}px" text-anchor="middle">${whole?`<text x="${x-size*.35}" y="${y}">${whole}</text>`:''}<text x="${fx}" y="${y-size*.4}" style="font-size:${size*.65}px">${m.n}</text><path d="M${fx-size*.4} ${y-size*.22}h${size*.8}" stroke="currentColor"/><text x="${fx}" y="${y+size*.38}" style="font-size:${size*.65}px">${m.d}</text></g>`;
}
const text=(x,y,s,cls='')=>`<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${esc(s)}</text>`;
// Wrap explanatory SVG captions to keep both languages inside narrow scenes.
function note(x,y,message,width,cls='st-note'){
 const limit=Math.max(16,Math.floor((width-36)/15)),lines=[''];
 for(const word of message.split(' ')){const i=lines.length-1;if(lines[i]&&(lines[i]+' '+word).length>limit)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}
 return `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?30:0}">${esc(line)}</tspan>`).join('')}</text>`;
}
export function blockMetrics(data,m,height,compact){
 const values=meanValues(m).map(num),max=Math.max(1,...data,...values),weight=v=>num(v)>=10?num(v)/10:num(v)*.55;
 const currentWeights=Array.from({length:m.count},(_,i)=>m.pieces.filter(p=>p.owner==='c'+i).reduce((sum,p)=>sum+weight(p.value),0));
 const originalWeights=data.map(v=>Math.floor(v/10)+(v%10)*.55),maxWeight=Math.max(1,...currentWeights,...originalWeights);
 const tenHeight=Math.min(44,(height-270)/(maxWeight*1.06)),unit=Math.min(40,(height-270)/(max*1.06));
 return {compact,unit,height:value=>compact?weight(value)*tenHeight:num(value)*unit};
}
export function meanScene(m,data,width,height,{metrics,selected,held,original=false,interactive=true,tr=(a)=>a}={}){
 const nodes=[],slots=[],labels=[],n=m.count,colW=(width-50)/n,base=height-74,ys=Array(n).fill(base),w=Math.min(68,colW-12), pool=m.pieces.filter(p=>p.owner==='pool');
 const unit=metrics||blockMetrics(data,m,height,Math.max(...data)>20);
 for(let i=0;i<n;i++){slots.push({owner:'c'+i,x:25+i*colW,y:135,w:colW,h:height-145});labels.push(`<path d="M${25+i*colW+4} ${base+3}h${colW-8}" class="st-baseline"/>`+fractionText(meanValues(m)[i],25+(i+.5)*colW,base+40,27));}
 const poolW=Math.max(30,Math.min(66,(width-40)/Math.max(1,pool.length)-5));
 const poolCols=Math.max(1,Math.floor((width-50)/(poolW+5))),poolRows=Math.ceil(pool.length/poolCols),poolH=Math.min(32,Math.max(2,80/Math.max(1,poolRows)-2));
 for(const p of m.pieces){const v=num(p.value),isPool=p.owner==='pool',i=+p.owner.slice(1);if(p.owner==='hand')continue;let x,y,h;
  if(isPool){const j=pool.indexOf(p);h=poolH;x=25+(j%poolCols)*(poolW+5);y=55+Math.floor(j/poolCols)*(poolH+2);}
  else {h=unit.height(p.value);ys[i]-=h+Math.min(2,h*.06);x=25+(i+.5)*colW-w/2;y=ys[i];}
  if(!isPool&&v%1&&h<22)labels.push(fractionText(p.value,x+w/2,y-20,25));
  nodes.push({id:p.id,parent:p.parent,x,y,w:isPool?poolW:w,h,value:p.value,owner:p.owner,label:h<18?'':decimal(p.value),classes:`st-piece ${v>=10?'st-ten':''} ${selected===p.id?'st-picked':''}`,interactive:!original&&interactive});
 }
 slots.push({owner:'pool',x:15,y:10,w:width-30,h:120});
 if(!original&&m.phase!=='original')labels.push(text(width/2,28,tr('Pool','Jumlah')+': '+decimal(ownerTotal(m,'pool')),'st-pool-label'));
 if(!original&&['complete','formalised'].includes(m.phase))labels.push(text(width/2,125,tr('Equal shares · total unchanged','Bahagian sama · jumlah kekal'),'st-result'));
 if(!original&&m.phase==='remainder')labels.push(text(width/2,155,tr('Not enough for one more whole layer','Tidak cukup untuk satu lagi lapisan penuh'),'st-note'));
 if(!original&&m.phase==='combined')labels.push(text(width/2,155,tr('One remaining quantity','Satu kuantiti baki'),'st-note'));
 if(!original&&m.phase==='split')labels.push(text(width/2,155,tr('One equal piece for every observation','Satu bahagian sama untuk setiap cerapan'),'st-note'));
 return {nodes,slots,labels:labels.join('')};
}
export function rawScene(data,width,height,{order=data.map((_,i)=>'o'+i),state=null,indices=null,tr=a=>a}={}){
 const tile=Math.min(66,(width-60)/data.length-8),gap=(width-60)/data.length,y=height*.46,nodes=[],labels=[],active=indices||data.map((_,i)=>i);
 order.forEach((id,i)=>{const v=data[+id.slice(1)],scan=state?.scan===i,min=state?.min===i,done=i<(state?.prefix||0),pulse=state?.check?.pulse===i;nodes.push({id,x:30+(i+.5)*gap-tile/2,y,w:tile,h:62,value:quantity(v),label:String(v),classes:`st-observation ${scan?'st-scan':''} ${min?'st-min':''} ${done?'st-sorted':''} ${!active.includes(i)?'st-muted':''} ${pulse?'st-pulse':''}`});labels.push(text(30+(i+.5)*gap,y+92,String(i+1),'st-index'));});
 if(state&&state.phase!=='sorting'){
  const lx=30+(state.locator/2+.5)*gap;labels.push(`<path d="M${lx} ${y-55}v${155}" class="st-locator"/>`+text(lx,y-65,state.target.toUpperCase(),'st-locator-label'));
  for(const [key,mark]of Object.entries(state.markers)){if(key===state.target)continue;const x=30+(mark.locator/2+.5)*gap;labels.push(`<path d="M${x} ${y-28}v110" class="st-marker"/>`+text(x,y-40,key.toUpperCase(),'st-marker-label'));}
  if(state.check){labels.push(text(width*.25,y-118,`${state.check.leftCount} ${tr('data','data')}`,'st-count'),text(width*.75,y-118,`${state.check.rightCount} ${tr('data','data')}`,'st-count'));}
  if(state.phase==='result'){labels.push(text(width/2,y+150,state.target.toUpperCase()+' =','st-result')+fractionText(state.markers[state.target].value,width/2+70,y+150,32));}
 }else if(state){const message=({ 'start-pass':tr('Start the unsorted section','Mulakan bahagian belum tersusun'),inspect:tr('Inspect','Periksa'),'new-minimum':tr('New smallest candidate','Calon terkecil baharu'),'place-minimum':tr('Place the smallest next','Letakkan yang terkecil seterusnya')})[state.kind]||tr('Find the smallest remaining value','Cari nilai terkecil yang belum tersusun');labels.push(note(width/2,90,message,width));
 labels.push(text(width/2,height-55,tr('Outline: inspecting   ·   Underline: smallest   ·   ✓: sorted','Bingkai: diperiksa   ·   Garis bawah: terkecil   ·   ✓: tersusun'),'st-legend'));}
 return {nodes,slots:[],labels:labels.join('')};
}
export function modeScene(data,state,width,height,tr=a=>a){const groups=frequencyMap(data),nodes=[],labels=[],base=height-100,step=Math.min(62,(height-210)/Math.max(...groups.map(g=>g.count))),isDots=state.phase==='dots',isTable=state.phase==='table',gap=(width-90)/groups.length,min=groups[0].value,max=groups.at(-1).value,rawGap=(width-70)/data.length;
 const grouped=new Set(state.grouped),groupX=g=>isDots&&max!==min?45+(g.value-min)/(max-min)*(width-90):45+(groups.indexOf(g)+.5)*gap;
 data.forEach((v,i)=>{const id='o'+i,g=groups.find(g=>g.value===v),rank=g.ids.indexOf(id),stacked=grouped.has(id),x=stacked?(isTable?groupX(g)+(rank%Math.max(1,Math.floor(gap/17))-(Math.min(g.count,Math.max(1,Math.floor(gap/17)))-1)/2)*17:groupX(g)):35+(i+.5)*rawGap,y=stacked?(isTable?height*.48+87+Math.floor(rank/Math.max(1,Math.floor(gap/17)))*17:base-rank*step):height*.28,w=stacked?(isDots?18:isTable?12:Math.min(60,gap-10)):Math.min(60,rawGap-6),h=isDots?18:isTable?12:48;nodes.push({id,x:x-w/2,y:y-h,w,h,value:quantity(v),label:isDots||isTable?'':String(v),classes:`st-observation ${isDots||isTable?'st-dot':''} ${state.pulse===id?'st-pulse':''}`});});
 if(['grouped','dots','table'].includes(state.phase)){
  if(isTable){const y=height*.48;labels.push(`<path d="M30 ${y-40}H${width-20} M30 ${y+12}H${width-20}" class="st-baseline"/>`,text(20,y-7,'x'),text(20,y+52,'f'));groups.forEach(g=>labels.push(text(groupX(g),y-7,g.value),text(groupX(g),y+52,g.count,'st-count')));}
  else {labels.push(`<path d="M25 ${base+14}H${width-25}" class="st-baseline"/>`);groups.forEach(g=>labels.push(text(groupX(g),base+50,g.value)));}
  labels.push(note(width/2,80,isDots?tr('Each dot is one observation','Setiap titik ialah satu cerapan'):isTable?tr('Same observations · recorded as frequencies','Cerapan sama · dicatat sebagai kekerapan'):tr('Count each repeated value','Kira setiap nilai berulang'),width));
 }
 if(state.phase==='stacking'){const id=state.pulse,value=data[+id.slice(1)],count=state.grouped.filter(id=>data[+id.slice(1)]===value).length;labels.push(text(width/2,80,`${value} → ${count} ${tr('data','data')}`,'st-count'));}
 if(state.reveal){const values=modes(data);labels.push(text(width/2,height-24,values.length?tr('Mode','Mod')+' = '+values.join(', '):tr('No unique mode','Tiada mod unik'),'st-result'));}
 return {nodes,slots:[],labels:labels.join('')};
}
// Persistent keyed SVG objects: sorting, stacking and dots move the same node.
export function createScene(svg,onPiece,tr=a=>a){
 svg.innerHTML='<g class="st-back"></g><g class="st-nodes"></g><g class="st-ghost"></g>';
 const back=svg.querySelector('.st-back'),layer=svg.querySelector('.st-nodes'),ghost=svg.querySelector('.st-ghost'),nodes=new Map(),positions=new Map();let disposed=false;
 const ns='http://www.w3.org/2000/svg';
 function render(scene,width,height){svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.minWidth=width+'px';svg.style.minHeight=height+'px';back.innerHTML=scene.labels;const ids=new Set(scene.nodes.map(n=>n.id));
 for(const [id,g]of nodes)if(!ids.has(id)){g.remove();nodes.delete(id);}
 for(const n of scene.nodes){let g=nodes.get(n.id),fresh=!g;if(!g){g=document.createElementNS(ns,'g');g.dataset.piece=n.id;layer.append(g);nodes.set(n.id,g);}
 g.setAttribute('class',n.classes);g.dataset.owner=n.owner||'';g.setAttribute('aria-label',n.classes.includes('st-piece')?tr('Block','Blok')+' '+decimal(n.value):n.label?tr('Observation','Cerapan')+' '+n.label:tr('One observation','Satu cerapan'));
 if(n.interactive){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onPiece(n.id);}};}else {g.removeAttribute('tabindex');g.removeAttribute('role');g.onkeydown=null;}
 let tile=g.querySelector('.st-tile');if(!tile){tile=document.createElementNS(ns,'g');tile.setAttribute('class','st-tile');tile.innerHTML='<rect/><g class="st-piece-label"></g>';g.append(tile);}
 const rect=tile.querySelector('rect');rect.setAttribute('width',n.w);rect.setAttribute('height',n.h);rect.style.width=n.w+'px';rect.style.height=n.h+'px';rect.style.rx=(n.classes.includes('st-dot')?n.w/2:3)+'px';
 tile.querySelector('.st-piece-label').innerHTML=`${n.classes.includes('st-ten')?`<path d="M4 4h${n.w-8} M4 7h${n.w-8}" class="st-ten-lines"/>`:''}${n.label?(n.value&&num(n.value)%1!==0?fractionText(n.value,n.w/2,n.h/2+4,Math.min(18,n.w*.36,n.h*.68)):`<text x="${n.w/2}" y="${n.h/2+Math.min(8,n.h*.24)}" text-anchor="middle" style="font-size:${Math.min(n.classes.includes('st-piece')?23:28,n.h*.7)}px">${esc(n.label)}</text>`):''}${n.classes.includes('st-min')?`<path d="M5 ${n.h+5}h${n.w-10}" class="st-min-line"/>`:''}${n.classes.includes('st-sorted')?text(n.w/2,-9,'✓','st-index'):''}`;

 const transform=`translate(${n.x}px, ${n.y}px)`;
 if(fresh&&n.parent&&positions.has(n.parent)){const p=positions.get(n.parent);g.style.transform=`translate(${p.x}px,${p.y}px)`;requestAnimationFrame(()=>{if(!disposed)g.style.transform=transform;});}else g.style.transform=transform;
 positions.set(n.id,n);
 }
 return scene.slots;
 }
 return {render,positions,ghost,dispose(){disposed=true;nodes.clear();positions.clear();}};
}
