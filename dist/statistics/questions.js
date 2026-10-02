import {mean,modes,frequencyMap,parseData,num,quartiles} from './math.js?v=11';
const moduleName='BIJAK SPM PPDMT 2026 · Sukatan Serakan · v2.1';
// Transcribed from the user's module. Page numbers refer to printed module pages.
const preset=(q,page,data,en,bm)=>({id:'bijak-'+q,title:{en,bm},source:'module',sourceRef:`${moduleName} · Q${q} · p${page}`,data,tags:['ungrouped','bijak-spm'],difficulty:'spm',startRepresentation:'raw-data',generatorProfile:profile(data)});
export const MODULE_PRESETS=[
 preset(1,1,[3,4,4,5,5,5,6,6,7],'Central tendency','Kecenderungan memusat'),
 preset(2,1,[12,8,10,9,11,8,14,8],'An even-sized dataset','Bilangan data genap'),
 preset(3,1,[4,7,5,6,7,8,6,7,5,5],'Books read · two modes','Buku dibaca · dua mod'),
 preset(4,1,[18,15,21,17,20,16,19,14],'Quiz scores · no mode','Markah kuiz · tiada mod'),
 preset(5,2,[1,2,2,3,3,3,4,5,5,6,6,6,6],'From values to dots','Daripada nilai kepada titik'),
 {...preset(6,2,[10,10,11,11,11,12,12,13,14,14,15,15],'Read a dot plot','Baca plot titik'),startRepresentation:'dot-plot'},
 preset(7,2,[2.1,2.3,2.2,2.1,2.4,2.3,2.3,2.5],'Decimal observations','Cerapan perpuluhan'),
 {...preset(12,3,[63,64,66,67,69,70,72,72,73,75,78,79,81,83,84,86,88,89,90,92,95,97],'Quartiles · 22 observations','Kuartil · 22 cerapan'),startRepresentation:'stem-and-leaf'},
 preset(13,4,[42,45,47,49,51,54,55,57,60],'Quartiles · odd count','Kuartil · bilangan ganjil'),
 preset(14,4,[12,14,15,18,20,23,24,27,29,31],'Quartiles · even count','Kuartil · bilangan genap'),
 preset(17,5,[6,2,4,8,5],'Five observations','Lima cerapan'),
 {...preset(19,5,[1,2,2,2,3,3,3,3,3,3,4,4,4,5],'Read frequencies','Baca kekerapan'),startRepresentation:'frequency-table'},
 preset(46,12,[35,36,37,37,38,39,60],'An extreme observation','Satu nilai ekstrem'),
];
export function profile(data) { return {count:data.length,repetitions:frequencyMap(data).map(g=>g.count),min:Math.min(...data),max:Math.max(...data),meanKind:Number.isInteger(num(mean(data)))?'integer':'fractional',precision:data.some(x=>!Number.isInteger(x))?1:0,modeCount:modes(data).length}; }
export function seeded(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
// Positive affine variants preserve repetition, relative spread, outliers and
// quartile structure. Integer offsets preserve integer/fractional mean type.
export function generateSimilar(question,seed=1) {
 const random=seeded(seed),base=question.generatorBase||question.data,p=question.generatorProfile||profile(base),lo=Math.min(...base),hi=Math.max(...base);
 const offsets=[];for(let k=-8;k<=8;k++)if(k&&lo+k>=0&&hi+k<=100)offsets.push(k);
 let data;
 if(offsets.length){const offset=offsets[Math.floor(random()*offsets.length)];data=base.map(x=>Number((x+offset).toFixed(2)));}
 else {data=base.map(x=>Number((100-x).toFixed(2)));}
 for(let i=data.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[data[i],data[j]]=[data[j],data[i]];}
 parseData(data.join(',')); const solved={mean:mean(data),quartiles:quartiles(data),modes:modes(data)};
 if(data.length!==p.count||solved.modes.length!==p.modeCount||Number.isInteger(num(solved.mean))!==(p.meanKind==='integer'))throw Error('Generator invariant failed');
 return {id:`similar-${question.id}-${seed}`,title:{en:'Similar drill',bm:'Latihan seiras'},source:'generated',startRepresentation:question.startRepresentation||'raw-data',sourceRef:question.sourceRef,seed,data,tags:question.tags,generatorProfile:p,generatorBase:base};
}

export const MODULE_FORMS = {raw:[1,2,3,4,5,7,9,11,13,14,17,18,46], 'dot-plot':[6,8,43], 'frequency-table':[19,55], 'stem-and-leaf':[10,12,44], 'box-plot':[15,16], 'grouped-frequency':[33,34,35,36,37,38,51,56,57], histogram:[39,52], 'frequency-polygon':[40,54], ogive:[41,53]};

// Small, varied entry point: five observations, without a module prerequisite.
export function simpleQuestion(seed=Date.now()>>>0){
 const random=seeded(seed),data=Array.from({length:5},()=>3+Math.floor(random()*11));
 if(Math.max(...data)-Math.min(...data)<4){data[0]=3;data[4]=12;}
 return {id:'practice-'+seed,source:'practice',seed,data,title:{en:'Quick practice',bm:'Latihan ringkas'},tags:['simple'],startRepresentation:'raw-data',generatorProfile:profile(data)};
}
