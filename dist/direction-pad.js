// Shared tap / press-and-hold behaviour. One pointer owns each button;
// cancellation, focus loss and disposal must never leave a repeating action.
export function bindRepeatingButton(button, action, {delay=420, interval=110, enabled=()=>true}={}) {
  let timeout=null,timer=null,pointer=null;
  const win=button.ownerDocument?.defaultView,doc=button.ownerDocument;
  const stop=()=>{clearTimeout(timeout);clearInterval(timer);timeout=timer=null;pointer=null;};
  const invoke=()=>{if(button.disabled || !enabled()){stop();return;}action();};
  const down=e=>{
    if(e.button!==0 || pointer!==null || button.disabled || !enabled())return;
    e.preventDefault();pointer=e.pointerId;button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);
    invoke();timeout=setTimeout(()=>{timer=setInterval(invoke,interval);},delay);
  };
  const up=e=>{if(e.pointerId===pointer)stop();};
  const click=e=>{if(e.detail===0 && pointer===null)invoke();};
  const visibility=()=>{if(doc.hidden)stop();};
  for(const [type,handler] of [['pointerdown',down],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['click',click]])button.addEventListener(type,handler);
  win?.addEventListener('blur',stop);win?.addEventListener('pagehide',stop);doc?.addEventListener('visibilitychange',visibility);
  return {stop,dispose(){
    stop();
    for(const [type,handler] of [['pointerdown',down],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['click',click]])button.removeEventListener(type,handler);
    win?.removeEventListener('blur',stop);win?.removeEventListener('pagehide',stop);doc?.removeEventListener('visibilitychange',visibility);
  }};
}
