import {parseData} from './math.js?v=11';
const def=(id,label,bm,recoverability,implemented=true)=>({id,label:{en:label,bm},recoverability,canBuildFromRawData:true,canRecoverRawData:recoverability==='lossless',implemented});
export const REPRESENTATIONS={
 'raw-data':def('raw-data','Raw data','Data asal','lossless'),
 'sorted-data':def('sorted-data','Sorted data','Data tersusun','lossless'),
 'grouped-values':def('grouped-values','Value stacks','Tindanan nilai','lossless'),
 'dot-plot':def('dot-plot','Dot plot','Plot titik','lossless'),
 'frequency-table':def('frequency-table','Frequency table','Jadual kekerapan','lossless'),
 'stem-and-leaf':def('stem-and-leaf','Stem-and-leaf','Batang-dan-daun','lossless',false),
 'quartile-view':def('quartile-view','Quartiles','Kuartil','lossless',false),
 'mean-share':def('mean-share','Equal shares','Bahagian sama','lossy',false),
 'box-plot':def('box-plot','Box plot','Plot kotak','partial',false),
 'grouped-frequency':def('grouped-frequency','Grouped frequencies','Kekerapan terkumpul','partial',false),
 histogram:def('histogram','Histogram','Histogram','partial',false),
 ogive:def('ogive','Ogive','Ogif','partial',false),
 'frequency-polygon':def('frequency-polygon','Frequency polygon','Poligon kekerapan','partial',false),
};
export const observations=data=>data.map((value,i)=>({id:'o'+i,value}));
export function encodeRepresentation(id,obs){const spec=REPRESENTATIONS[id];if(!spec?.implemented)throw Error('Representation not available');const groups=[];
 for(const o of obs){let g=groups.find(g=>g.value===o.value);if(!g){g={value:o.value,count:0,ids:[]};groups.push(g);}g.count++;g.ids.push(o.id);}
 return {id,observations:structuredClone(obs),groups:groups.sort((a,b)=>a.value-b.value)};
}
export function recoverRawData(rep){const spec=REPRESENTATIONS[rep.id];if(!spec?.canRecoverRawData)return {ok:false,reason:'Exact observations cannot be recovered from this representation.'};if(!spec.implemented)return {ok:false,reason:'This representation is planned, not implemented.'};
 let obs;if(['raw-data','sorted-data'].includes(rep.id)){obs=structuredClone(rep.observations||[]);}else{obs=[];for(const g of rep.groups||[]){if(!Number.isInteger(g.count)||g.count<0||g.count>24||!Number.isFinite(g.value)||g.ids&&g.ids.length!==g.count)throw Error('Invalid frequency');for(let i=0;i<g.count;i++)obs.push({id:g.ids?.[i]||'o'+obs.length,value:g.value});}}
 parseData(obs.map(o=>o.value).join(','));if(new Set(obs.map(o=>o.id)).size!==obs.length)throw Error('Duplicate observation identity');return {ok:true,observations:obs,data:obs.map(o=>o.value)};
}
export function transformRepresentation({from,to,observations:obs}){
 const a=REPRESENTATIONS[from],b=REPRESENTATIONS[to];if(!a?.canRecoverRawData||!a.implemented||!b?.implemented)return {ok:false,reason:'This transformation cannot recover exact observations.'};
 const steps=[];if(from!==to){if(from==='dot-plot'||from==='frequency-table')steps.push('grouped-values');if(to==='raw-data'||to==='sorted-data')steps.push(to);else {if(!steps.includes('grouped-values')&&from!=='grouped-values')steps.push('grouped-values');if(to!=='grouped-values')steps.push(to);}}
 return {ok:true,steps,observations:structuredClone(obs)};
}
