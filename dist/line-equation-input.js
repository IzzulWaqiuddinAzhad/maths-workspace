// Shared, non-editable equation field for mirror lines. Buttons and physical
// keyboards use the same editor; focusing the div never opens an OS keyboard.
export function editLineEquation({value,cursor},key){
  key=({'⌫':'Backspace','←':'ArrowLeft','→':'ArrowRight','−':'-','×':'*','÷':'/'})[key]??key;
  if(key==='C')return {value:'',cursor:0};
  if(key==='Backspace'&&cursor){value=value.slice(0,cursor-1)+value.slice(cursor);cursor--;}
  else if(key==='Delete')value=value.slice(0,cursor)+value.slice(cursor+1);
  else if(key==='ArrowLeft')cursor=Math.max(0,cursor-1);
  else if(key==='ArrowRight')cursor=Math.min(value.length,cursor+1);
  else if(/^[0-9xy=()+*/.\-]$/.test(key)&&value.length<120){value=value.slice(0,cursor)+key+value.slice(cursor);cursor++;}
  return {value,cursor};
}
export function bindLineEquationInput(element,keys,onCommit){
  let state={value:'',cursor:0};
  function paint(){const caret=document.createElement('span');caret.textContent='│';caret.className='tf-caret';element.replaceChildren(document.createTextNode(state.value.slice(0,state.cursor)),caret,document.createTextNode(state.value.slice(state.cursor)));element.setAttribute('aria-valuetext',state.value);}
  function key(key){if(key==='Enter'){onCommit(state.value);return;}state=editLineEquation(state,key);paint();element.focus({preventScroll:true});}
  for(const label of ['x','y','=','(',')','7','8','9','+','−','4','5','6','×','÷','1','2','3','←','→','C','0','.','⌫']){const b=document.createElement('button');b.type='button';b.textContent=label;b.onpointerdown=e=>e.preventDefault();b.onclick=()=>key(label);keys.append(b);}
  element.onkeydown=e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^[0-9xy=()+*/.\-]$/.test(e.key)||['Backspace','Delete','ArrowLeft','ArrowRight','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();key(e.key);}};
  paint();return {getValue:()=>state.value,setValue(value){state={value:String(value).slice(0,120),cursor:Math.min(String(value).length,120)};paint();}};
}
