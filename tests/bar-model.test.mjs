import test from 'node:test';
import assert from 'node:assert/strict';
import {rat,add,mul,eq,num,money,parseExpression,linear,solve,relationRows,equivalentRelations,verifyAnswer} from '../dist/bar-model/domain.js';
import {generateProblem,equationProblem,FAMILIES} from '../dist/bar-model/generator.js';
import {contextQuality} from '../dist/bar-model/context.js';
import {planScene,planTimeline,timelineAt} from '../dist/bar-model/scene.js';
import {exploreProblem} from '../dist/bar-model/explore.js';
import {studioDocument,validStudio,addBar,partitionBar,transferSegment} from '../dist/bar-model/store.js';
import {DocumentStore} from '../dist/core.js';
import {pointerToWorld} from '../dist/bar-model/coordinates.js';
import {DEFAULT_COUNTS,generateBarWorksheet,validateBarConfig} from '../dist/bar-model/worksheet.js';

const problem=(family,tier,parameters)=>generateProblem({family,tier,parameters,seed:'regression',language:'bm'});
const answer=(p,id,value)=>assert.ok(eq(p.values[id],value),`${p.family} ${id}: ${JSON.stringify(p.values[id])}`);

test('bar exact arithmetic, repeated quantity coefficients and safe linear parser',()=>{
 assert.deepEqual(add(rat('0.1'),rat('0.2')),rat('0.3'));
 assert.deepEqual(money('12.30'),rat(1230));
 assert.throws(()=>money('12.301'));
 const row=relationRows({type:'compose',wholeId:'t',partIds:['u','u']})[0];
 assert.ok(eq(row.terms.u,-2));
 assert.deepEqual(linear(parseExpression('3(x+2)')),{a:rat(3),b:rat(6)});
 for(const expression of ['x*x','1/x','alert(1)'])assert.throws(()=>linear(parseExpression(expression)));
});

test('all supplied numerical fixtures solve exactly',()=>{
 answer(problem('partWhole',1,{first:28,second:17}),'w',45);
 answer(problem('comparison',1,{smaller:48,difference:17}),'b',6500);
 const td=problem('comparison',4,{smaller:31,difference:12});answer(td,'a',31);answer(td,'b',43);
 answer(problem('change',1,{before:36,change:12}),'b',48);
 const transfer=problem('transfer',1,{first:46,second:28,amount:9});answer(transfer,'a1',37);answer(transfer,'b1',37);
 answer(problem('equalGroups',3,{groups:6,unit:8}),'u',8);
 answer(problem('equalGroups',2,{groups:8,unit:6}),'n',8);
 answer(problem('multiplicativeComparison',1,{groups:3,unit:18}),'t',54);
 answer(problem('fraction',1,{numerator:3,denominator:5,unit:16}),'p',48);
 answer(problem('percentage',1,{percent:25,original:8000}),'p',6000);
 const ratio=problem('ratio',1,{firstUnits:3,secondUnits:5,unit:5});answer(ratio,'a',15);answer(ratio,'b',25);
 answer(problem('rate',1,{knownCount:4,wantedCount:9,unitPrice:360}),'b',3240);
 answer(problem('average',3,{mean:74,scores:[68,72,75,80,75]}),'s4',75);
 for(const [source,value]of [['4x+13=3x+20',7],['x/2=8',16],['3(x+2)=21',5],['x+20=3x',10]])answer(equationProblem(source),'x',value);
});

test('1000 seeded questions per family: exact substitution, reproducibility, plausible contexts, finite diagrams',()=>{
 for(const [family] of FAMILIES)for(let i=0;i<1000;i++){
  const options={family,tier:i%5+1,seed:'bar-stress-'+i,language:i%2?'en':'bm'},p=generateProblem(options);
  assert.ok(verifyAnswer(p,p.answer));
  for(const relation of p.relations)for(const row of relationRows(relation)){
   const lhs=Object.entries(row.terms).reduce((v,[id,c])=>add(v,mul(c,p.values[id])),rat(0));
   assert.ok(eq(lhs,row.total),`${family} ${i}: substitution failed`);
  }
  assert.ok(p.context.checks.every(c=>contextQuality(c).accepted));
  assert.deepEqual(generateProblem(options),p);
  if(i<25){
   const plan=planTimeline(p),original=JSON.stringify(plan);
   for(const n of [0,.5,1,plan.steps.length-.2,plan.steps.length,0]){
    const scene=timelineAt(plan,n);
    assert.equal(new Set(scene.segments.map(s=>s.id)).size,scene.segments.length);
    for(const s of scene.segments)assert.ok([s.x,s.y,s.w,s.h].every(Number.isFinite)&&s.w>0&&s.h>0);
   }
   assert.equal(JSON.stringify(plan),original,'scrubbing mutated timeline');
   assert.deepEqual(timelineAt(plan,0),plan.initial);
  }
 }
});

test('reject implausible actors, fractional items, impossible sharing and malformed money',()=>{
 assert.equal(contextQuality({itemId:'umbrellas',actorType:'individualPupil',value:120}).accepted,false);
 assert.equal(contextQuality({itemId:'umbrellas',actorType:'retailShop',value:120}).accepted,true);
 assert.equal(contextQuality({itemId:'worksheets',actorType:'teacher',value:'2.5'}).accepted,false);
 assert.equal(contextQuality({itemId:'worksheets',actorType:'teacher',value:47,groups:6}).accepted,false);
 assert.equal(contextQuality({moneyValue:'3.456'}).accepted,false);
 assert.throws(()=>equationProblem('x+5=2'));
 assert.throws(()=>equationProblem('x=x'));
});

test('semantic models accept reordered equivalent relationships and reject reversed comparisons',()=>{
 const p=problem('comparison',4,{smaller:31,difference:12});
 assert.ok(equivalentRelations(p.relations,[...p.relations].reverse(),p.quantities));
 const wrong=structuredClone(p.relations);[wrong[0].largerId,wrong[0].smallerId]=[wrong[0].smallerId,wrong[0].largerId];
 assert.equal(equivalentRelations(p.relations,wrong,p.quantities),false);
 const original=equationProblem('4x+13=3x+20'),equivalent=equationProblem('2x=14');
 assert.ok(equivalentRelations(original.relations,equivalent.relations,original.quantities));
});

test('transfer keeps the same piece width and conserved total throughout animation',()=>{
 const p=problem('transfer',1,{first:46,second:28,amount:9}),plan=planTimeline(p);
 const width=plan.initial.segments.find(s=>s.id==='transfer-piece').w;
 for(let step=0;step<=plan.steps.length;step+=.125){const scene=timelineAt(plan,step);assert.equal(scene.segments.find(s=>s.id==='transfer-piece').w,width)}
 assert.ok(eq(add(p.values.a0,p.values.b0),add(p.values.a1,p.values.b1)));
 const final=plan.steps.find(s=>s.action==='transfer').toState;
 assert.equal(final.segments.find(s=>s.id==='transfer-piece').y,final.segments.find(s=>s.id==='target-original').y);
});

test('algebra removes equal constants on both sides and preserves half-unit labels',()=>{
 const p=equationProblem('4x+13=3x+20'),plan=planTimeline(p);
 const cancelled=plan.steps.filter(s=>s.action==='cancelEqual');
 for(const side of ['left','right']) assert.equal(cancelled[0].toState.segments.filter(s=>s.id.startsWith(side+'-x')&&s.opacity<.5).length,3);
 assert.equal(cancelled[1].toState.segments.find(s=>s.id==='right-remainder').constant,7);
 const half=problem('algebra',2,{answer:8});
 const final=planTimeline(half).final;
 assert.equal(final.segments.find(s=>s.id==='left-x-other-half').label,'8');
 assert.equal(final.segments.find(s=>s.id==='left-x-0').label,'8');
});

test('exploration invariants stay exact and changing difference changes diagram geometry',()=>{
 const a=exploreProblem('total',5).problem,b=exploreProblem('total',25).problem;
 for(const p of [a,b])assert.ok(eq(add(p.values.a,p.values.b),100));
 assert.notEqual(planScene(a,true).segments[0].w,planScene(b,true).segments[0].w);
 for(let i=0;i<6;i++){const p=exploreProblem('fraction',i).problem;assert.ok(eq(p.values.w,120));assert.ok(eq(p.values.p,60))}
});

test('bar construction uses one undoable transaction and save validation rejects malformed scenes',()=>{
 const store=new DocumentStore(studioDocument());let id;
 store.transact(d=>id=addBar(d.studio.scene,{value:rat(48)}));
 store.transact(d=>partitionBar(d.studio.scene,id,6));
 assert.equal(store.document.studio.scene.segments.length,6);store.undo();assert.equal(store.document.studio.scene.segments.length,1);store.redo();assert.equal(store.document.studio.scene.segments.length,6);
 assert.ok(validStudio(store.document));const bad=structuredClone(store.document);bad.studio.scene.labels=null;assert.equal(validStudio(bad),false);
 const scene=studioDocument().studio.scene;const a=addBar(scene,{value:rat('0.3')}),b=addBar(scene,{value:rat('0.1'),y:180});transferSegment(scene,a,b,'0.1');assert.ok(eq(scene.segments[0].value,'0.2'));
});

test('pointer coordinates respect SVG letterboxing, resized views and the canvas camera',()=>{
 const rect={left:20,top:40,width:1000,height:300},view={x:40,y:-20,zoom:2};
 // scale .75, horizontal inset 200: world(100,80)->viewport(240,140)
 const p=pointerToWorld({clientX:20+200+240*.75,clientY:40+140*.75},rect,view);
 assert.deepEqual(p,{x:100,y:80});
});

test('bar worksheets default to two questions and a worked example, one page per selected tier',()=>{
 assert.deepEqual(Object.values(DEFAULT_COUNTS),[2,2,2,2,2]);
 const c={tiers:[5,1],counts:DEFAULT_COUNTS,seed:'worksheet',title:'',language:'en',worked:true,partial:true};
 const m=generateBarWorksheet(c,'ratio');assert.equal(m.pages.length,2);assert.ok(m.pages.every(p=>p.questions.length===2&&p.example));assert.deepEqual(m.pages.map(p=>p.tier),[1,5]);
 assert.deepEqual(generateBarWorksheet(c,'ratio'),m);
 assert.ok(validateBarConfig({...c,counts:{...DEFAULT_COUNTS,1:4}}).length);
});

test('averaging moves excess pieces without changing combined bar length',()=>{
 const p=problem('average',1,{mean:74,scores:[68,72,75,78,77]}),plan=planTimeline(p);
 const before=plan.initial.segments.reduce((n,s)=>n+s.w,0);
 for(let t=0;t<plan.steps.length;t+=.125)assert.ok(Math.abs(timelineAt(plan,t).segments.reduce((n,s)=>n+s.w,0)-before)<1e-7);
 const final=plan.steps.find(s=>s.action==='partition').toState;
 for(const y of new Set(final.segments.map(s=>s.y)))assert.ok(Math.abs(final.segments.filter(s=>s.y===y).reduce((n,s)=>n+s.w,0)-74*4.8)<1e-7);
});

test('fractional algebra cancellation removes the same exact coefficient on each side',()=>{
 const p=equationProblem('1.5x+1=0.5x+3'),plan=planTimeline(p),cancel=plan.steps[0].toState;
 for(const side of ['left','right']){
  const removed=cancel.segments.filter(s=>s.id.startsWith(side+'-x')&&s.opacity<.5).reduce((n,s)=>add(n,s.coefficientValue),rat(0));
  assert.ok(eq(removed,'0.5'));
 }
 const third=equationProblem('x/3+1=2');assert.equal(planScene(third).segments[0].label,'1/3x');
 assert.equal(planTimeline(third).final.segments.find(s=>s.quantityId==='x'&&s.opacity>.5).label,'3');
 const sixth=equationProblem('x/3+1=x/6+2');assert.ok(eq(sixth.values.x,6));assert.equal(sixth.calculations[0].equation,'1/6x + 1 = 2');
 const units=planTimeline(equationProblem('2x+3=19')).final.segments.filter(s=>s.constant&&s.opacity>.5);assert.equal(units.length,2);assert.ok(units.every(s=>eq(s.constantValue,8)));
});

test('individual worksheet edits, reordering and saved question banks retain shared answers',async()=>{
 const {editQuestion,moveQuestion,readQuestionBank}=await import('../dist/bar-model/worksheet-editor.js');
 const model=generateBarWorksheet({tiers:[1],counts:DEFAULT_COUNTS,seed:'bank',title:'',language:'en',worked:true,partial:true},'partWhole');
 const edited=editQuestion(model,0,0,{first:28,second:17});assert.ok(eq(edited.pages[0].questions[0].problem.values.w,45));assert.deepEqual(edited.pages[0].questions[1],model.pages[0].questions[1]);
 const moved=moveQuestion(edited,0,0,1);assert.equal(moved.pages[0].questions[1].number,2);assert.ok(eq(moved.pages[0].questions[1].problem.values.w,45));
 assert.ok(eq(readQuestionBank(JSON.parse(JSON.stringify(moved))).pages[0].questions[1].problem.values.w,45));
 const contextual=structuredClone(moved);contextual.pages[0].questions[0].problem=generateProblem({family:'partWhole',tier:1,seed:'same-maths',contextSeed:'different-name'});
 assert.equal(readQuestionBank(contextual).pages[0].questions[0].problem.contextSeed,'different-name');
 assert.throws(()=>generateProblem({family:'percentage',parameters:{percent:13}}));
 assert.throws(()=>generateProblem({family:'algebra',tier:5,parameters:{coefficient:2}}));
 const money=generateProblem({family:'comparison',tier:1,parameters:{smaller:48.12,difference:3.41}});assert.ok(eq(money.values.b,5153));
});
