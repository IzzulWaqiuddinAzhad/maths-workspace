import {mountCalculator} from './calculator-ui.js?v=12';
let instance;
export function calculatorPanel(language=()=>document.documentElement.lang==='ms'?'bm':'en'){
 if(instance)return instance;
 const panel=document.createElement('aside');panel.id='floatingCalculator';panel.popover='manual';panel.setAttribute('role','region');panel.className='calculator-floating';
 const header=document.createElement('div');header.className='calculator-grip';header.tabIndex=0;
 const body=document.createElement('div');panel.append(header,body);document.body.append(panel);
 let visible=false,opener=null,position=null,drag=null;
 try{position=JSON.parse(sessionStorage.getItem('calculator-position'))}catch{}
 function place(){const w=panel.offsetWidth,h=panel.offsetHeight;let x=position?.x??innerWidth-w-12,y=position?.y??12;x=Math.max(4,Math.min(x,innerWidth-w-4));y=Math.max(4,Math.min(y,innerHeight-Math.min(h,innerHeight-8)-4));panel.style.left=x+'px';panel.style.top=y+'px';}
 function dockQuiz(){if(panel.closest('dialog')&&innerWidth>=1100){const left=position&&position.x+panel.offsetWidth/2<innerWidth/2;position={x:left?12:innerWidth-panel.offsetWidth-12,y:position?.y??12};place();}}
 function sync(){document.querySelectorAll('[data-calculator-toggle]').forEach(b=>{b.setAttribute('aria-pressed',String(visible));b.classList.toggle('active',visible)});const dialog=document.querySelector('#angleExplorer');dialog?.classList.toggle('with-calculator',visible&&panel.closest('dialog')!==null);dialog?.classList.toggle('calculator-left',visible&&panel.getBoundingClientRect().x<innerWidth/2-panel.offsetWidth/2);}
 function hide(){if(visible)panel.hidePopover();visible=false;sync();opener?.isConnected&&opener.focus();}
 const calculator=mountCalculator(body,{language,onClose:hide});
 function detach(){hide();document.body.append(panel);}
 function toggle(source,parent=document.body){if(visible){hide();return;}opener=source;parent.append(panel);calculator.refresh();header.textContent=language()==='bm'?'Kalkulator · Seret untuk alih':'Calculator · Drag to move';header.ariaLabel=language()==='bm'?'Alih kalkulator dengan kekunci anak panah':'Move calculator with arrow keys';panel.ariaLabel=language()==='bm'?'Kalkulator':'Calculator';panel.showPopover();visible=true;place();dockQuiz();sync();calculator.focus();}
 header.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const r=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.x,y:e.clientY-r.y};header.setPointerCapture(e.pointerId);};
 header.onpointermove=e=>{if(drag?.id!==e.pointerId)return;position={x:e.clientX-drag.x,y:e.clientY-drag.y};place();};
 const finish=()=>{if(!drag)return;drag=null;const r=panel.getBoundingClientRect();position={x:r.x,y:r.y};dockQuiz();sync();sessionStorage.setItem('calculator-position',JSON.stringify(position));};header.onpointerup=finish;header.onpointercancel=finish;
 header.onkeydown=e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(d){e.preventDefault();const r=panel.getBoundingClientRect();position={x:r.x+d[0],y:r.y+d[1]};place();sessionStorage.setItem('calculator-position',JSON.stringify(position));}};
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();hide();}});for(const type of ['pointerdown','pointermove','pointerup','wheel'])panel.addEventListener(type,e=>e.stopPropagation());
 window.addEventListener('resize',()=>{if(visible)place()});new ResizeObserver(()=>{if(visible)place()}).observe(panel);
 instance={toggle,hide,detach,get visible(){return visible}};return instance;
}
