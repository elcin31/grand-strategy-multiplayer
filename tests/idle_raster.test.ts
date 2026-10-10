import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RasterCache} from '../src/map/rasterTiles';
import {CameraWorkGate} from '../src/performance/framePacing';
import {scheduleIdleSlices,type SliceTimers} from '../src/performance/idleSlices';

class Clock implements SliceTimers {
  now=0;sequence=0;pending=new Map<number,{at:number;run:()=>void}>();
  set(run:()=>void,ms:number){const id=++this.sequence;this.pending.set(id,{at:this.now+ms,run});return id;}
  clear(token:unknown){this.pending.delete(token as number);}
  advance(ms:number){const end=this.now+ms;for(;;){const first=[...this.pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!first||first[1].at>end)break;this.pending.delete(first[0]);this.now=first[1].at;first[1].run();}this.now=end;}
}
test('prefetch never evicts foreground tiles or exceeds either cache limit',()=>{
  const cache=new RasterCache<string>(20,4);cache.set('region-a','A',5);cache.set('region-b','B',5);
  assert.equal(cache.setCold('world','W',5),true);
  assert.equal(cache.setCold('too-large','X',10),false);
  assert.equal(cache.setCold('region-a','wrong',1),false);
  assert.equal(cache.bytes,15);assert.equal(cache.peek('region-a'),'A');
  cache.set('foreground','F',10);
  assert.equal(cache.peek('world'),undefined);assert.equal(cache.peek('region-a'),'A');assert.equal(cache.peek('region-b'),'B');assert.equal(cache.bytes,20);
  const limited=new RasterCache<string>(100,1);limited.set('active','A',5);assert.equal(limited.setCold('idle','I',1),false);assert.equal(limited.peek('active'),'A');
  for(const bad of [-1,NaN,Infinity,.5])assert.equal(cache.canFit(bad),false);
});
test('actually displayed prefetched tile gains normal LRU priority',()=>{
  const cache=new RasterCache<string>(20,2);cache.set('old','O',10);cache.setCold('world','W',10);
  assert.equal(cache.get('world'),'W');cache.set('new','N',10);
  assert.equal(cache.peek('old'),undefined);assert.equal(cache.peek('world'),'W');assert.equal(cache.size,2);assert.equal(cache.bytes,20);
});
test('idle preparation waits through touch and quiet period, then runs one bounded item per slice',()=>{
  const clock=new Clock(),gate=new CameraWorkGate(),at:number[]=[];
  gate.activity(true,clock.now);
  scheduleIdleSlices(()=>!gate.defer(clock.now,750),()=>{at.push(clock.now);return at.length<3;},clock);
  clock.advance(800);assert.deepEqual(at,[]);gate.activity(false,clock.now);
  clock.advance(749);assert.deepEqual(at,[]);
  clock.advance(1);assert.deepEqual(at,[1550]);clock.advance(100);assert.deepEqual(at,[1550,1600,1650]);assert.equal(clock.pending.size,0);
});
test('foreground work blocks idle preparation and cancellation releases timers/stale callbacks',()=>{
  const clock=new Clock();let foreground=true,calls=0;
  const cancel=scheduleIdleSlices(()=>!foreground,()=>{calls++;return true;},clock);
  clock.advance(1000);assert.equal(calls,0);foreground=false;clock.advance(50);assert.equal(calls,1);
  const stale=[...clock.pending.values()][0]!.run;cancel();assert.equal(clock.pending.size,0);stale();clock.advance(1000);assert.equal(calls,1);
});
