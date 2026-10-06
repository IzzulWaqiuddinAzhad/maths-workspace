import { graphToScreen } from './transform-model.js?v=29';

export const COORDINATE_GUIDE_DURATION = 3400;
export const isOrigin = point => point && Math.abs(point.x)<1e-9 && Math.abs(point.y)<1e-9;
export const coordinateGuideDuration = (mode,point) => isOrigin(point)?900:mode === 'read' ? 4800 : COORDINATE_GUIDE_DURATION;
const clamp = x => Math.max(0, Math.min(1, x));
const progress = (t, a, b) => clamp((t-a)/(b-a));
const mix = (a, b, t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const fmt = n => String(Number(n.toFixed(2))).replace('-', '−');

// Timings affect presentation only. Every endpoint comes from the same point.
// Reading goes point → axes; plotting goes axes → their intersection.
export function coordinateGuideFrame(point, mode, elapsed) {
  const plot = mode === 'plot', t = Math.max(0, elapsed);
  const xAxis = {x:point.x,y:0}, yAxis = {x:0,y:point.y};
  if(isOrigin(point))return {origin:true,phase:'origin',done:t>=900,xAxis,yAxis,xLine:[point,point],yLine:[point,point],xProgress:0,yProgress:0,xFlight:0,yFlight:0,xRead:true,yRead:true,xEmphasis:false,yEmphasis:false,xAxisVisible:false,yAxisVisible:false,opacity:1-progress(t,650,900),showPoint:true,pulse:.5+.5*Math.sin(t*Math.PI/180)};
  if(!plot){
    const xProgress=progress(t,500,1200),yProgress=progress(t,2300,3000);
    return {
      phase:t<500?'point':t<2300?'x':t<4050?'y':'intersection',
      done:t>=coordinateGuideDuration(mode),xAxis,yAxis,
      xLine:[point,mix(point,xAxis,xProgress)],yLine:[point,mix(point,yAxis,yProgress)],
      xProgress,yProgress,xFlight:progress(t,1500,2100),yFlight:progress(t,3300,3900),
      xRead:t>=2100,yRead:t>=3900,
      xEmphasis:t>=1200&&t<2100,yEmphasis:t>=3000&&t<3900,
      xAxisVisible:t>=1200,yAxisVisible:t>=3000,
      opacity:1-progress(t,4250,4800),showPoint:true,
      pulse:t<500?.5+.5*Math.sin(t*Math.PI/180):0,
    };
  }
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

// The coordinate pair has stable slots: numbers travel into them, then remain.
// This renderer is also used after the temporary projection lines are removed.
export function coordinateReadoutLayout(ctx,{point,label,view,width,height,placement}){
  const c=graphToScreen(point,view),fontSize=placement?.fontSize??22;
  const prefix=placement?.omitLabel?'(' : `${label} (`;
  ctx.save();ctx.font=`600 ${fontSize}px Arial, sans-serif`;
  const parts=[prefix,fmt(point.x),', ',fmt(point.y),')'];
  const widths=parts.map((s,i)=>Math.max(i===1||i===3?fontSize*.7:0,ctx.measureText(s).width));ctx.restore();
  const total=widths.reduce((a,b)=>a+b,0),half=fontSize*.7;
  // Notebook callers place a suffix beside the existing printed letter. Other
  // callers retain the usual standalone label, above the projection lines.
  const x=placement?.x??(c.x+total+20<width?c.x+18:c.x-total-18);
  const y=placement?.y??c.y-fontSize*1.6;
  return {parts,widths,total,fontSize,left:placement?.preserveAnchor?x:Math.max(6,Math.min(width-total-6,x)),y:placement?.preserveAnchor?y:Math.max(half+4,Math.min(height-half-4,y))};
}
export function paintCoordinateReadout(ctx,options){
  const {dark,pointColour,xRead=true,yRead=true}=options;
  const {parts,widths,total,fontSize,left,y}=coordinateReadoutLayout(ctx,options),paper=dark?'#15181d':'#fff',ink=pointColour||(dark?'#edf0f5':'#20242c');
  ctx.save();ctx.font=`600 ${fontSize}px Arial, sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillStyle=paper;ctx.fillRect(left-3,y-fontSize*.65,total+6,fontSize*1.3);
  let x=left;const slots=[];
  parts.forEach((text,i)=>{
    if(i===1||i===3)slots.push({x:x+widths[i]/2,y});
    ctx.fillStyle=i===1?(dark?'#ffc47f':'#a95c14'):i===3?(dark?'#91beff':'#2468c4'):ink;
    if((i!==1||xRead)&&(i!==3||yRead))ctx.fillText(text,x,y);
    x+=widths[i];
  });
  ctx.restore();return {x:slots[0],y:slots[1]};
}

export function paintCoordinateGuide(ctx,{point,label,mode,elapsed,view,dark,width,height,pointColour,placement,transientReadout=false}) {
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
    return {x,y};
  };
  let xBadge,yBadge;
  if(frame.xAxisVisible??(frame.xEmphasis||frame.xRead))xBadge=badge(fmt(point.x),x.x,x.y+18,orange,frame.xEmphasis);
  if(frame.yAxisVisible??(frame.yEmphasis||frame.yRead))yBadge=badge(fmt(point.y),y.x-22,y.y,blue,frame.yEmphasis);
  if(frame.showPoint){
    ctx.beginPath();ctx.arc(c.x,c.y,9+frame.pulse*7,0,Math.PI*2);ctx.strokeStyle=pointColour||ink;ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(c.x,c.y,5,0,Math.PI*2);ctx.fillStyle=pointColour||ink;ctx.fill();
  }
  if(frame.showPoint&&mode==='plot'&&!placement&&!frame.origin){
    const text=frame.xRead?`${label} (${fmt(point.x)}, ${frame.yRead?fmt(point.y):'?'})`:label;
    badge(text,c.x,c.y-34,pointColour||ink,false);
  }
  ctx.restore();
  if(!frame.origin&&(mode==='read'||placement)){
    ctx.save();if(transientReadout)ctx.globalAlpha=frame.opacity;
    const slots=paintCoordinateReadout(ctx,{point,label,view,dark,width,height,pointColour,placement,xRead:frame.xRead,yRead:frame.yRead});
    ctx.save();
    for(const [amount,start,end,value,colour]of[[frame.xFlight,xBadge,slots.x,point.x,orange],[frame.yFlight,yBadge,slots.y,point.y,blue]]){
      if(start&&amount>0&&amount<1){const p=mix(start,end,amount);badge(fmt(value),p.x,p.y,colour,true);}
    }
    ctx.restore();ctx.restore();
  }
  return frame;
}

// A persistent centre cue contains no text and leaves the axes unobscured.
export function paintCoordinatePulse(ctx,{point,view,now=0,active=true,colour='#c23246'}){
  const p=graphToScreen(point,view),pulse=.5+.5*Math.sin(now/240);
  ctx.save();ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=2;
  if(active){ctx.globalAlpha=.3+.45*pulse;ctx.beginPath();ctx.arc(p.x,p.y,9+6*pulse,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();ctx.restore();
}
