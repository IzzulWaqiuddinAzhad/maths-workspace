import { reflectionLine } from './module-lesson.js?v=12';
import { graphToScreen } from './transform-model.js?v=29';
import { angleMark } from './angle-renderer.js';

// Return the two intersections with the printed (or expanded trial) grid.
export function reflectionSegment(choice, bounds) {
  if (!choice) return [];
  const { xmin, xmax, ymin, ymax } = bounds, {a,b,c}=reflectionLine(choice),candidates=[];
  if(Math.abs(b)>1e-9)for(const x of [xmin,xmax])candidates.push({x,y:-(a*x+c)/b});
  if(Math.abs(a)>1e-9)for(const y of [ymin,ymax])candidates.push({x:-(b*y+c)/a,y});
  const points=candidates.filter(p=>p.x>=xmin-1e-8&&p.x<=xmax+1e-8&&p.y>=ymin-1e-8&&p.y<=ymax+1e-8);
  const unique=points.filter((p,i)=>points.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-8)===i);
  return unique.length>=2?[unique[0],unique.at(-1)]:[];
}

// Canvas geometry participates in the existing renderer's label avoidance.
export function paintReflectionLesson(ctx, { lesson, view, bounds, dark, pulse = 0, handlesActive=true }) {
  const segments = [], points = [], obstacles = [];
  if (!lesson.choice) return { segments, points, obstacles };
  const screen = p => graphToScreen(p, view), ends = reflectionSegment(lesson.choice, bounds).map(screen);
  const amber = dark ? '#ffc47f' : '#9d550b', blue = dark ? '#91beff' : '#2468c4', paper = dark ? '#15181d' : '#fff';
  const line = (a, b, colour, dash = [], width = 2) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); segments.push([a, b]);
  };
  ctx.save();
  if(ends.length===2)line(ends[0], ends[1], amber, [9, 5], 3.5);
  if(handlesActive)for(const p of lesson.handles.map(screen)) {
    ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=amber;ctx.lineWidth=3;ctx.stroke();points.push(p);
  }
  const f = screen(lesson.foot), p = screen(lesson.question.given), target = screen(lesson.trialAnswer);
  if (lesson.guideVisible) {
    // Do not imply equal lengths during an unfinished flip.
    line(p, f, blue, [4, 4], 1.5);
    if (lesson.progress > 0) line(f, screen(lesson.pointAt()), blue, [4, 4], 1.5);
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d > 3) {
      const start = Math.atan2(p.y - f.y, p.x - f.x);
      ctx.strokeStyle = amber; ctx.lineWidth = 1.6;
      angleMark(ctx, { p: f, start, sweep: Math.PI / 2, radius: Math.min(22, d * .45) });
      if (lesson.progress === 1) {
        const ux = (p.x - f.x) / d, uy = (p.y - f.y) / d;
        for (const end of [p, target]) {
          const x = (end.x + f.x) / 2, y = (end.y + f.y) / 2;
          line({ x: x - uy * 5, y: y + ux * 5 }, { x: x + uy * 5, y: y - ux * 5 }, blue);
        }
      }
    }
  }
  if (lesson.choice.kind !== 'slanted') {
    const horizontal = lesson.choice.kind === 'horizontal';
    const crossing = screen(horizontal ? { x: 0, y: lesson.choice.k } : { x: lesson.choice.k, y: 0 });
    const origin = screen({ x: 0, y: 0 });
    line(origin, crossing, amber, [], 4);
    ctx.fillStyle = amber; ctx.beginPath(); ctx.arc(crossing.x, crossing.y, 5, 0, Math.PI * 2); ctx.fill(); points.push(crossing);
    if (pulse > 0) {
      ctx.globalAlpha = pulse * .65; ctx.strokeStyle = amber; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(crossing.x, crossing.y, 7 + (1 - pulse) * 15, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const value = String(lesson.choice.k).replace('-', '−');
    const x = crossing.x + (horizontal ? -17 : 0), y = crossing.y + (horizontal ? 0 : 17);
    ctx.font = '700 17px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = ctx.measureText(value).width + 8;
    ctx.fillStyle = paper; ctx.fillRect(x - width / 2, y - 12, width, 24);
    ctx.fillStyle = amber; ctx.fillText(value, x, y);
    obstacles.push({ x: x - width / 2, y: y - 12, w: width, h: 24 });
  }
  ctx.restore();
  return { segments, points, obstacles };
}
