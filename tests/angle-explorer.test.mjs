import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLORATIONS,equation,generateQuestion,regionsFromRays,straightRegions} from '../dist/angle-explorer.js';

test('angle regions preserve their straight-line and full-turn totals',()=>{
  assert.deepEqual(straightRegions([130,62]).map(r=>r.currentValue),[50,68,62]);
  assert.equal(straightRegions([130,62]).reduce((s,r)=>s+r.currentValue,0),EXPLORATIONS.straight.fixedTotal);
  assert.equal(regionsFromRays([0,82,195],360).reduce((s,r)=>s+r.currentValue,0),EXPLORATIONS.circle.fixedTotal);
  assert.equal(equation([{currentValue:42.6},{currentValue:71.3},{currentValue:66.1}],180),'42.6° + 71.3° + 66.1° = 180°');
});

test('question generator creates valid numeric and algebraic angle-sum questions',()=>{
  for(const mode of ['straight','circle'])for(const difficulty of [1,2,3,4]){
    const q=generateQuestion({mode,difficulty});
    assert.equal(q.values.reduce((a,b)=>a+b,0),q.total);
    assert.ok(q.answer>0);
    assert.ok(q.values.every(v=>v>0));
    if(q.algebra)assert.ok(q.steps.at(-1).endsWith(`= ${q.answer}`));
  }
});
