import { graphToScreen } from './transform-model.js?v=29';

export const COORDINATE_GUIDE_DURATION = 3400;
const clamp = x => Math.max(0, Math.min(1, x));
const progress = (t, a, b) => clamp((t-a)/(b-a));
const mix = (a, b, t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const fmt = n => String(n).replace('-', '−');

// Timings affect presentation only. Every endpoint comes from the same point.
// Reading goes point → axes; plotting goes axes → their intersection.
export function coordinateGuideFrame(point, mode, elapsed) {
  const plot = mode === 'plot', t = Math.max(0, elapsed);
  const xAxis = {x:point.x,y:0}, yAxis = {x:0,y:point.y};
  const xProgress = progress(t, plot?650:350, 1250);
  const yProgress = progress(t, plot?1950:1550, 2500);
  const xStart = plot?xAxis:point, yStart = plot?yAxis:point;
  const phase = t<350?'point':t<1550?'x':t<2650?'y':'intersection';
  return {
    phase, done:t>=COORDINATE_GUIDE_DURATION,
    xAxis, yAxis,
    xLine:[xStart,mix(xStart,plot?point:xAxis,xProgress)],
    yLine:[yStart,mix(yStart,plot?point:yAxis,yProgress)],
    xProgress,yProgress,
    xFlight:progress(t,150,650), yFlight:progress(t,1450,1950),
    xRead:t>=1250,yRead:t>=2500,
    xEmphasis:t>=150&&t<1550,yEmphasis:t>=1450&&t<2650,
    opacity:1-progress(t,2850,3400),
    showPoint:!plot||t>=2500,
    pulse:(phase==='point'||phase==='intersection') ? .5+.5*Math.sin(t*Math.PI/450) : 0,
  };
}

export function paintCoordinateGuide(ctx,{point,label,mode,elapsed,view,dark,width,height,pointColour}) {
  const frame=coordinateGuideFrame(point,mode,elapsed),screen=p=>graphToScreen(p,view);
  const c=screen(point),x=screen(frame.xAxis),y=screen(frame.yAxis);
  const paper=dark?'#15181d':'#fff',ink=dark?'#edf0f5':'#20242c';
  const orange=dark?'#ffc47f':'#a95c14',blue=dark?'#91beff':'#2468c4';
  ctx.save();ctx.globalAlpha=frame.opacity;ctx.lineCap='round';
  const line=(points,colour,amount)=>{
    if(!amount)return;
    const [a,b]=points.map(screen);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=colour;ctx.lineWidth=2.6;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
  };
  line(frame.xLine,orange,frame.xProgress);line(frame.yLine,blue,frame.yProgress);
  const badge=(text,x,y,colour,emphasis)=>{
    ctx.font=`${emphasis?700:600} 22px system-ui`;const w=ctx.measureText(text).width+14;
    x=Math.max(w/2+5,Math.min(width-w/2-5,x));y=Math.max(18,Math.min(height-28,y));
    ctx.fillStyle=paper;ctx.fillRect(x-w/2,y-15,w,30);ctx.strokeStyle=colour;
    if(emphasis){ctx.lineWidth=1.5;ctx.strokeRect(x-w/2,y-15,w,30);}
    ctx.fillStyle=colour;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
  };
  if(frame.xEmphasis||frame.xRead)badge(fmt(point.x),x.x,x.y+18,orange,frame.xEmphasis);
  if(frame.yEmphasis||frame.yRead)badge(fmt(point.y),y.x-22,y.y,blue,frame.yEmphasis);
  if(frame.showPoint){
    ctx.beginPath();ctx.arc(c.x,c.y,9+frame.pulse*7,0,Math.PI*2);ctx.strokeStyle=pointColour||ink;ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(c.x,c.y,5,0,Math.PI*2);ctx.fillStyle=pointColour||ink;ctx.fill();
  }
  if(frame.showPoint){
    const text=frame.xRead?`${label} (${fmt(point.x)}, ${frame.yRead?fmt(point.y):'?'})`:label;
    badge(text,c.x,c.y-34,pointColour||ink,false);
  }
  ctx.restore();return frame;
}
