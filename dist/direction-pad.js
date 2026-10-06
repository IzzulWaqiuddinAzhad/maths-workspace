// Shared tap / press-and-hold behaviour. One pointer owns each button;
// cancellation, focus loss and disposal must never leave a repeating action.
export function bindRepeatingButton(button, action, {delay=420, interval=110, enabled=()=>true,onRelease=()=>{},targetAt=null}={}) {
  let timeout=null,timer=null,pointer=null,current=button;
  const win=button.ownerDocument?.defaultView,doc=button.ownerDocument;
  const clear=()=>{clearTimeout(timeout);clearInterval(timer);timeout=timer=null;current?.removeAttribute?.('data-held');};
  const stop=()=>{clear();pointer=null;};
  const invoke=()=>{if(!current||current.disabled || !enabled()){stop();return;}action(current);};
  const repeat=()=>{current?.setAttribute?.('data-held','true');invoke();if(pointer!==null)timeout=setTimeout(()=>{timer=setInterval(invoke,interval);},delay);};
  const down=e=>{
    if(e.button!==0 || pointer!==null || !enabled())return;
    current=targetAt?targetAt(e):button;if(!current||current.disabled)return;
    e.preventDefault();pointer=e.pointerId;current.focus({preventScroll:true});button.setPointerCapture(e.pointerId);repeat();
  };
  const move=e=>{
    if(!targetAt||e.pointerId!==pointer)return;e.preventDefault();const next=targetAt(e);
    if(next===current)return;clear();current=next;if(current&&!current.disabled)repeat();
  };
  const up=e=>{if(e.pointerId===pointer){stop();if(e.type==='pointerup')onRelease();}};
  const click=e=>{if(e.detail===0 && pointer===null){current=targetAt?targetAt(e):button;if(current&&!current.disabled&&enabled()){invoke();onRelease();}}};
  const visibility=()=>{if(doc.hidden)stop();};
  const handlers=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['click',click]];
  for(const [type,handler] of handlers)button.addEventListener(type,handler);
  win?.addEventListener('blur',stop);win?.addEventListener('pagehide',stop);doc?.addEventListener('visibilitychange',visibility);
  return {stop,dispose(){
    stop();
    for(const [type,handler] of handlers)button.removeEventListener(type,handler);
    win?.removeEventListener('blur',stop);win?.removeEventListener('pagehide',stop);doc?.removeEventListener('visibilitychange',visibility);
  }};
}

// Capture the whole pad so sliding between arrows changes the held direction.
// Leaving the arrows pauses movement; release/cancel always ends the gesture.
export function bindDirectionPad(pad,action,options={}){
  const buttons=[...pad.querySelectorAll('[data-nudge]')];
  return bindRepeatingButton(pad,b=>action(b.dataset.nudge),{...options,targetAt:e=>{
    if(e.type==='click')return buttons.find(b=>b===e.target||b.contains(e.target))??null;
    return buttons.find(b=>{const r=b.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;})??null;
  }});
}
