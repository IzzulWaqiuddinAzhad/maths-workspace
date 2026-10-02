import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rat,eq,num,mean,median,modes,frequencyMap,quartiles,selectionSortSteps,parseData,locatorCheck,total} from '../dist/statistics/math.js';
import {meanState,nextMean,meanValues,ownerTotal,transferPiece,splitPiece,regroupPieces,assertMean,StatisticsWorkspace} from '../dist/statistics/model.js';
import {MODULE_PRESETS,generateSimilar,profile} from '../dist/statistics/questions.js';
const q=data=>({id:'custom',data,source:'custom',tags:[],generatorProfile:profile(data)});
test('mean sequence conserves every exact quantity, pauses for remainder and shares proper fractions',()=>{
 let m=meanState([3,4,5,6,9]);assert.ok(eq(m.total,27));const original=structuredClone(m);m=nextMean(m);assert.equal(m.phase,'pooled');assert.ok(meanValues(m).every(v=>eq(v,0)));
 for(let i=0;i<5;i++)m=nextMean(m);assert.ok(eq(ownerTotal(m,'pool'),2));m=nextMean(m);assert.equal(m.phase,'remainder');m=nextMean(m);assert.equal(m.phase,'combined');assert.equal(m.pieces.filter(p=>p.owner==='pool').length,1);
 m=nextMean(m);assert.equal(m.phase,'split');assert.ok(m.pieces.filter(p=>p.owner==='pool').every(p=>eq(p.value,rat(2,5))));m=nextMean(m);assert.equal(m.phase,'complete');assert.ok(meanValues(m).every(v=>eq(v,rat(27,5))));assert.deepEqual(original,meanState([3,4,5,6,9]));
});
test('manual transfer, decimal/tens splitting and regrouping preserve quantity and independent history',()=>{
 let m=meanState([12,8,10]);const ten=m.pieces.find(p=>eq(p.value,10));m=splitPiece(m,ten.id);const one=m.pieces.find(p=>p.owner==='c0'&&eq(p.value,1));m=regroupPieces(m,one.id);assert.ok(m.pieces.some(p=>p.owner==='c0'&&eq(p.value,10)));m=transferPiece(m,m.pieces.find(p=>p.owner==='c0').id,'c1');assertMean(m);assert.equal(m.phase,'manual');for(let i=0;i<50&&m.phase!=='complete';i++)m=nextMean(m);assert.ok(meanValues(m).every(x=>eq(x,10)));
 const w=new StatisticsWorkspace(q([2.1,2.3,2.2]));const before=w.snapshot();w.manipulate('move',w.state.pieces[0].id,'c1');w.undo();assert.deepEqual(w.snapshot(),before);w.next();w.reset();assert.deepEqual(w.workingData.map(num),[2.1,2.3,2.2]);assert.deepEqual(w.originalData,[2.1,2.3,2.2]);
});
test('selection sort scans candidates explicitly and retains observation IDs including duplicates',()=>{
 const data=[8,3,6,1,5],steps=selectionSortSteps(data);assert.deepEqual(steps.filter(s=>s.kind==='inspect'&&s.start===0).map(s=>s.scan),[1,2,3,4]);const end=steps.at(-1);assert.deepEqual(end.order.map(id=>data[+id.slice(1)]),[1,3,5,6,8]);assert.equal(new Set(end.order).size,5);assert.ok(eq(median(data),5));assert.equal(locatorCheck(end.order,[0,1,2,3,4],4,data).left.length,2);assert.equal(locatorCheck(end.order,[0,1,2,3,4],4,data).right.length,2);assert.equal(locatorCheck(end.order,[0,1,2,3,4],3,data).correct,false);
});
test('median even and quartiles use counting and the same exact sharing engine',()=>{
 const w=new StatisticsWorkspace(q([1,3,5,6,8,11,13,16]));w.setConcept('median');while(w.state.phase==='sorting')w.next();w.moveLocator(7);w.check();while(w.state.phase==='counting')w.next();assert.equal(w.state.check.leftCount,4);assert.equal(w.state.check.rightCount,4);assert.equal(w.state.phase,'sharing');assert.deepEqual(meanValues(w.state.sharing).map(num),[6,8]);while(w.state.sharing.phase!=='complete')w.next();assert.equal(w.state.phase,'sharing');assert.ok(meanValues(w.state.sharing).every(v=>eq(v,7)));w.next();assert.ok(eq(w.state.markers.q2.value,7));w.next();assert.equal(w.state.target,'q1');w.moveLocator(3);w.check();for(let i=0;i<100&&w.state.phase!=='result';i++)w.next();assert.ok(eq(w.state.markers.q1.value,4));
});
test('quartile convention matches BIJAK v2.1 answer scheme Q12, Q13, Q14',()=>{
 for(const [id,expected]of [[12,[70,78.5,88]],[13,[46,51,56]],[14,[15,21.5,27]]])assert.deepEqual(Object.values(quartiles(MODULE_PRESETS.find(p=>p.id==='bijak-'+id).data)).map(num),expected);
});
test('mode, dot plot and frequency table share exact observation membership',()=>{
 const data=[2,3,3,4,5,5,5,7],groups=frequencyMap(data);assert.deepEqual(groups.map(g=>[g.value,g.count]),[[2,1],[3,2],[4,1],[5,3],[7,1]]);assert.deepEqual(modes(data),[5]);assert.deepEqual(modes([1,1,3,3,4]),[1,3]);assert.deepEqual(modes([1,2,3]),[]);assert.deepEqual(modes([1,1,2,2]),[]);assert.deepEqual(modes([5,5,5]),[5]);
 const w=new StatisticsWorkspace(q(data));w.setConcept('mode');for(let i=0;i<data.length;i++)w.next();assert.equal(w.state.phase,'grouped');assert.equal(new Set(w.state.grouped).size,data.length);w.next();assert.equal(w.state.phase,'dots');w.next();assert.equal(w.state.phase,'table');assert.deepEqual(w.originalData,data);
});
test('custom data validation rejects malformed and oversized sets, supports zeros and decimals',()=>{
 assert.deepEqual(parseData('2.1, 2.3\n2.2 0'),[2.1,2.3,2.2,0]);for(const s of ['', '1,,2,3','1,2,3,','NaN,1,2','1e2,3,4','1,2','-1,2,3','101,2,3','1.234,2,3',Array(25).fill(1).join(',')])assert.throws(()=>parseData(s));
});
test('module presets and seeded similar drills preserve profile and exact mean completion',()=>{
 for(const p of MODULE_PRESETS){assert.equal(p.source,'module');for(let seed=1;seed<=100;seed++){const g=generateSimilar(p,seed);assert.deepEqual(g,generateSimilar(p,seed));assert.deepEqual(profile(g.data).repetitions,p.generatorProfile.repetitions);assert.equal(profile(g.data).meanKind,p.generatorProfile.meanKind);assert.ok(g.data.every(x=>x>=0&&x<=100));assert.equal(g.source,'generated');}
 let m=meanState(p.data);for(let i=0;i<120&&m.phase!=='complete';i++){m=nextMean(m);assertMean(m);}assert.equal(m.phase,'complete');assert.ok(meanValues(m).every(v=>eq(v,mean(p.data))));}
});

import {REPRESENTATIONS,observations,encodeRepresentation,recoverRawData,transformRepresentation} from '../dist/statistics/representations.js';
import {meanScene,blockMetrics,modeScene} from '../dist/statistics/scene.js';
test('dot and frequency reconstruction recover the multiset and stable individual IDs in both directions',()=>{
 const data=[2,3,3,4,5,5,5,7],obs=observations(data);
 for(const id of ['dot-plot','frequency-table']){const encoded=encodeRepresentation(id,obs),recovered=recoverRawData(encoded);assert.deepEqual(recovered.data,data);assert.deepEqual(recovered.observations,obs);assert.deepEqual(recoverRawData({id,groups:encoded.groups.map(({value,count})=>({value,count}))}).data,data);const route=transformRepresentation({from:id,to:'raw-data',observations:obs});assert.deepEqual(route.steps,['grouped-values','raw-data']);assert.deepEqual(route.observations,obs);}
 for(const id of ['box-plot','histogram','ogive','grouped-frequency','mean-share']){assert.equal(recoverRawData({id,observations:obs}).ok,false);assert.equal(transformRepresentation({from:id,to:'raw-data',observations:obs}).ok,false);}
 assert.throws(()=>recoverRawData({id:'dot-plot',groups:[{value:2,count:2.5}]}));assert.throws(()=>recoverRawData({id:'frequency-table',groups:[{value:2,count:25}]}));
});
test('graph-first questions and generated drills retain their original presentation without raw-data reveal',()=>{
 for(const id of ['bijak-6','bijak-19']){const q=MODULE_PRESETS.find(q=>q.id===id),w=new StatisticsWorkspace(q);assert.equal(w.concept,'representations');assert.equal(w.state.representation,q.startRepresentation);const ids=w.observations.map(o=>o.id);w.transform('raw-data');w.next();assert.equal(w.state.representation,'grouped-values');w.next();assert.equal(w.state.representation,'raw-data');assert.deepEqual(w.observations.map(o=>o.id),ids);w.undo();assert.equal(w.state.representation,'grouped-values');w.reset();assert.equal(w.state.representation,q.startRepresentation);assert.equal(generateSimilar(q,77).startRepresentation,q.startRepresentation);}
});
test('split mean views share block metrics and all rendered observations survive representation changes',()=>{
 const data=[3,4,5,6,9],a=meanState(data),b=nextMean(nextMean(a)),metrics=blockMetrics(data,b,600,false);const left=meanScene(a,data,800,600,{metrics}),right=meanScene(b,data,800,600,{metrics});assert.equal(left.nodes.find(n=>n.label==='1').h,right.nodes.find(n=>n.owner==='c0').h);
 for(const phase of ['grouped','dots','table']){const scene=modeScene(data,{phase,grouped:data.map((_,i)=>'o'+i)},800,600);assert.deepEqual(scene.nodes.map(n=>n.id),data.map((_,i)=>'o'+i));assert.ok(scene.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));}
});

test('large and decimal quantities remain exact with all blocks inside the mean scene',()=>{
 for(const data of [Array(24).fill(100),[0,0,0],[.01,.02,.02],[100,99,98]]){
  let m=meanState(data),steps=0;
  do {
   for(const compact of [false,true]){
    const height=480,width=Math.max(360,data.length*44+50),metrics=blockMetrics(data,m,height,compact),scene=meanScene(m,data,width,height,{metrics});
    assert.ok(scene.nodes.every(n=>n.x>=0&&n.y>=0&&n.x+n.w<=width&&n.y+n.h<=height),`Blocks fit: ${m.phase}`);
    const pool=scene.nodes.filter(n=>n.owner==='pool'),columns=scene.nodes.filter(n=>n.owner!=='pool');
    if(pool.length&&columns.length)assert.ok(Math.max(...pool.map(n=>n.y+n.h))<Math.min(...columns.map(n=>n.y)),'Pool and column quantities do not overlap');
   }
   if(m.phase==='complete')break;
   m=nextMean(m);assertMean(m);
  }while(++steps<110);
  assert.equal(m.phase,'complete');assert.ok(meanValues(m).every(v=>eq(v,mean(data))));
 }
});
test('quartile continuation computes Q3 and restore reinstates graph-first guard',()=>{
 const w=new StatisticsWorkspace(q([1,3,5,6,8,11,13,16]));w.setConcept('quartiles');while(w.state.phase==='sorting')w.next();
 for(const [target,locator,expected]of [['q2',7,7],['q1',3,4],['q3',11,12]]){
  assert.equal(w.state.target,target);w.moveLocator(locator-w.state.locator);w.check();let i=0;while(w.state.phase!=='result'&&i++<100)w.next();assert.ok(eq(w.state.markers[target].value,expected));if(target!=='q3')w.next();
 }
 assert.equal(w.canNext,false);
 const g=new StatisticsWorkspace(MODULE_PRESETS.find(p=>p.id==='bijak-6'));g.setConcept('mean');assert.equal(g.concept,'representations');g.transform('raw-data');g.next();g.next();g.setConcept('mean');assert.equal(g.concept,'mean');g.restoreOriginal();assert.equal(g.concept,'representations');assert.equal(g.reconstructed,false);g.undo();assert.equal(g.concept,'mean');
});
