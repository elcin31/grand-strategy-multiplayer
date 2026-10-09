import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextFrameDeadline,FRAME_BUCKETS,frameBucket,frameQuantile,CameraWorkGate} from '../src/performance/framePacing';
test('camera preserves target cadence at 60/90/120Hz and discards stall catch-up',()=>{
  for(const hz of [60,90,120])for(const target of [30,60]){
    let deadline=0,updates=0;
    for(let frame=1;frame<=hz*20;frame++){
      const now=frame*1000/hz;if(now>=deadline-.5){updates++;deadline=nextFrameDeadline(now,deadline,target);}
    }
    assert.ok(Math.abs(updates-target*20)<=1,`${hz}/${target}: ${updates}`);
  }
  const reset=nextFrameDeadline(1000,100,60);assert.ok(reset>1000&&reset<1017);
});
test('bounded frame histograms expose short stutters rather than hiding them in mean FPS',()=>{
  const h=Array(FRAME_BUCKETS.length+1).fill(0);
  for(const ms of [...Array(95).fill(16),50,75,100,500,6000])h[frameBucket(ms)]++;
  assert.equal(frameQuantile(h,.5),16);assert.equal(frameQuantile(h,.95),16);assert.equal(frameQuantile(h,.99),500);assert.equal(frameQuantile(h,1),null);
  assert.equal(frameQuantile(Array(h.length).fill(0),.99),null);
});
test('autosave waits for gesture settling; overlapping gestures and local tick starvation are bounded',()=>{
  const g=new CameraWorkGate();assert.equal(g.defer(0,750),false);
  g.activity(true,100);g.activity(true,110);g.activity(false,200);
  assert.equal(g.defer(1000,750),true);assert.equal(g.defer(1700,300,100),false);
  g.activity(false,1800);assert.equal(g.defer(2000,750),true);assert.equal(g.defer(2600,750),false);
});
