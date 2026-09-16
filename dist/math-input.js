export function mathConfig(input){
 const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
 const mode=input.dataset.mathMode||'decimal';
 return {mode,min,max,allowDecimal:mode!=='integer',allowNegative:min<0,unit:input.dataset.mathUnit||''};
}
export function editMath(value,key,config){
 if(key==='C')return '';if(key==='Backspace'||key==='Delete')return value.slice(0,-1);
 if(key==='-'&&config.allowNegative)return value.startsWith('-')?value.slice(1):'-'+value;
 if(key==='.'&&config.allowDecimal&&!value.includes('.'))return value+(value===''||value==='-'?'0.':'.');
 return /^\d$/.test(key)&&value.length<18?value+key:value;
}
export function validateMath(value,config){
 if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))return false;
 const n=Number(value);return Number.isFinite(n)&&n>=config.min&&n<=config.max&&(config.allowDecimal||Number.isInteger(n))&&(config.allowNegative||n>=0);
}
export function installMathInputs(root=document){
 const panel=document.createElement('div');panel.id='mathKeypad';panel.className='math-keypad';panel.popover='manual';panel.setAttribute('role','group');
 let target=null,config=null,draft='',replace=true;
 const tr=(en,bm)=>document.documentElement.lang==='ms'?bm:en;
 function close(){if(!target)return;const previous=target;target=null;panel.hidePopover();panel.remove();previous.removeAttribute('aria-expanded');if(previous.isConnected)previous.focus({preventScroll:true});}
 function commit(){if(!target?.isConnected){close();return;}if(!validateMath(draft,config)){panel.querySelector('[role=status]').textContent=tr('Enter a valid value','Masukkan nilai yang sah')+` (${Number.isFinite(config.min)?config.min:'…'} – ${Number.isFinite(config.max)?config.max:'…'})`;return;}const input=target;input.value=String(Number(draft));close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 function act(key){if(key==='Escape'){close();return;}if(key==='Enter'){commit();return;}if(replace){draft='';replace=false;}draft=editMath(draft,key,config);panel.querySelector('output').textContent=(draft||'0')+(config.unit?' '+config.unit:'');}
 function open(input){if(target===input)return;close();target=input;config=mathConfig(input);draft=input.value;replace=true;panel.replaceChildren();panel.ariaLabel=tr('Mathematical value keypad','Pad kekunci nilai matematik');const title=document.createElement('strong');title.textContent=input.ariaLabel||tr('Value','Nilai');const output=document.createElement('output');output.textContent=draft+(config.unit?' '+config.unit:'');const status=document.createElement('div');status.setAttribute('role','status');const keys=document.createElement('div');keys.className='math-keypad-keys';for(const key of ['7','8','9','4','5','6','1','2','3','.','0','Backspace','-','C','Enter']){const b=document.createElement('button');b.type='button';b.textContent=({Backspace:'⌫',Enter:'✓'})[key]||key;b.ariaLabel=({Backspace:tr('Delete','Padam'),Enter:tr('Confirm','Sahkan'),C:tr('Clear','Kosongkan'),'-':tr('Change sign','Tukar tanda'),'.':tr('Decimal point','Titik perpuluhan')})[key]||key;b.disabled=(key==='.'&&!config.allowDecimal)||(key==='-'&&!config.allowNegative);if(b.disabled)b.style.visibility='hidden';b.onpointerdown=e=>e.preventDefault();b.onclick=()=>act(key);keys.append(b);}const cancel=document.createElement('button');cancel.type='button';cancel.textContent=tr('Cancel','Batal');cancel.onclick=close;panel.append(title,output,keys,status,cancel);(input.closest('dialog')||document.body).append(panel);panel.showPopover();input.setAttribute('aria-expanded','true');const rect=input.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,rect.left))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,rect.bottom+8))+'px';}
 function enhance(input){if(input.dataset.mathReady)return;if(input.type!=='number'&&!input.hasAttribute('data-math'))return;input.dataset.mathReady='true';input.dataset.math='';input.type='text';input.readOnly=true;input.inputMode='none';input.setAttribute('aria-haspopup','true');if(input.dataset.mathUnit){const unit=document.createElement('span');unit.className='math-unit';unit.textContent=input.dataset.mathUnit;unit.setAttribute('aria-hidden','true');input.after(unit);}input.addEventListener('click',()=>open(input));input.addEventListener('keydown',e=>{if(/^[0-9.\-]$/.test(e.key)||['Backspace','Delete','Enter','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Escape'&&!target)return;open(input);act(e.key);}});}
 function scan(node){if(node.nodeType!==1&&node!==document)return;if(node.matches?.('input'))enhance(node);node.querySelectorAll?.('input[type=number],input[data-math]').forEach(enhance);}
 scan(root);new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)scan(n);if(target&&!target.isConnected)close();}).observe(root===document?document.documentElement:root,{childList:true,subtree:true});
 panel.addEventListener('keydown',e=>{if(/^[0-9.\-]$/.test(e.key)||['Backspace','Delete','Enter','Escape'].includes(e.key)){e.preventDefault();act(e.key);}e.stopPropagation();});
 document.addEventListener('pointerdown',e=>{if(target&&!panel.contains(e.target)&&e.target!==target)close();},true);
 window.addEventListener('resize',()=>{if(target)close()});return {close};
}
