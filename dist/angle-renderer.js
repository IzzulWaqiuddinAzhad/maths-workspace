export const RIGHT_ANGLE_TOLERANCE=.1;
export const isRightAngle=sweep=>Math.abs(Math.abs(sweep)*180/Math.PI-90)<=RIGHT_ANGLE_TOLERANCE;
export function angleMark(ctx,{p={x:0,y:0},start,sweep,radius=28,fill=null,rightAngleDisplay='marker-only'}){
 const right=isRightAngle(sweep);ctx.beginPath();
 if(right){const s=radius*.55,u={x:Math.cos(start)*s,y:Math.sin(start)*s},v={x:Math.cos(start+sweep)*s,y:Math.sin(start+sweep)*s};if(fill){ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+u.x,p.y+u.y);ctx.lineTo(p.x+u.x+v.x,p.y+u.y+v.y);ctx.lineTo(p.x+v.x,p.y+v.y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();}ctx.moveTo(p.x+u.x,p.y+u.y);ctx.lineTo(p.x+u.x+v.x,p.y+u.y+v.y);ctx.lineTo(p.x+v.x,p.y+v.y);}
 else {if(fill)ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,radius,start,start+sweep,sweep<0);if(fill)ctx.closePath();}
 if(fill&&!right){ctx.fillStyle=fill;ctx.fill()}ctx.stroke();return !right||rightAngleDisplay==='marker-and-value';
}
