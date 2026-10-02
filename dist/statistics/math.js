// Reuse the workspace's exact, serializable rational arithmetic.
export { rat, add, sub, mul, div, eq, num, fmt } from '../bar-model/domain.js?v=20';
import { rat, add, div, num } from '../bar-model/domain.js?v=20';
export const quantity = value => rat(typeof value === 'object' ? value : String(value));
export const total = data => data.reduce((s, x) => add(s, quantity(x)), rat(0));
export const mean = data => div(total(data), data.length);
export function median(data) {
  const values = [...data].sort((a,b) => num(quantity(a))-num(quantity(b))), n=values.length;
  if (!n) throw Error('Empty data');
  return n%2 ? quantity(values[(n-1)/2]) : div(add(quantity(values[n/2-1]), quantity(values[n/2])),2);
}
export function frequencyMap(data) {
  const map=new Map(); data.forEach((value,index)=>{ const key=String(Number(value)); if(!map.has(key))map.set(key,{value:Number(value),ids:[],count:0}); const group=map.get(key);group.ids.push('o'+index);group.count++; });
  return [...map.values()].sort((a,b)=>a.value-b.value);
}
export function modes(data) { const groups=frequencyMap(data), max=Math.max(...groups.map(g=>g.count)); return max===1||(groups.length>1&&groups.every(g=>g.count===max)) ? [] : groups.filter(g=>g.count===max).map(g=>g.value); }
// BIJAK PPDMT 2026 v2.1 Q12–14: median of halves, omitting Q2 for odd n.
export function quartileHalves(n) { return {lower:Array.from({length:Math.floor(n/2)},(_,i)=>i),upper:Array.from({length:Math.floor(n/2)},(_,i)=>Math.ceil(n/2)+i)}; }
export function quartiles(data) { const a=[...data].sort((x,y)=>x-y), h=quartileHalves(a.length);return {q1:median(h.lower.map(i=>a[i])),q2:median(a),q3:median(h.upper.map(i=>a[i]))}; }
export function parseData(text) {
  const s=text.trim(); if(!s||/[^\d\s,.+\-]/.test(s)||/(^|,)\s*(,|$)/.test(s))throw Error('format');
  const tokens=s.split(/[\s,]+/);if(tokens.length<3||tokens.length>24)throw Error('length');
  if(tokens.some(t=>!/^\+?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(t)))throw Error('range');
  const data=tokens.map(Number);if(data.some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('range');return data;
}
export function mixed(value) { const q=quantity(value),n=BigInt(q.n),d=BigInt(q.d),a=n<0n?-n:n;return {sign:n<0n?'−':'',whole:String(a/d),n:String(a%d),d:String(d)}; }
export function decimal(value) { const n=num(quantity(value));return Number.isInteger(n)?String(n):Number(n.toFixed(4)).toString(); }
export function selectionSortSteps(data) {
  const a=data.map((value,i)=>({id:'o'+i,value})), steps=[];
  const emit=(kind,start,scan,min,prefix)=>steps.push({kind,start,scan,min,prefix,order:a.map(o=>o.id)});
  for(let start=0;start<a.length-1;start++) { let min=start;emit('start-pass',start,start,min,start);
    for(let i=start+1;i<a.length;i++) {emit('inspect',start,i,min,start);if(a[i].value<a[min].value){min=i;emit('new-minimum',start,i,min,start);}}
    const [item]=a.splice(min,1);a.splice(start,0,item);emit('place-minimum',start,start,start,start+1);
  }
  emit('complete',a.length,-1,-1,a.length);return steps;
}
export function locatorCheck(order,indices,locator,data) {
  const left=indices.filter(i=>2*i<locator),right=indices.filter(i=>2*i>locator),middle=indices.filter(i=>2*i===locator);
  const correct=left.length===right.length;
  let middleIndices=middle;
  if(!middle.length&&correct) middleIndices=[left.at(-1),right[0]];
  return {left,right,correct,middleIndices,value:correct?median(middleIndices.map(i=>data[Number(order[i].slice(1))])):null};
}
