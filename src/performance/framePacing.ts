/** Phase-preserving deadlines avoid rounding 60Hz down to 45Hz on a 90Hz
 * display. A long stall drops missed deadlines rather than replaying frames. */
export function nextFrameDeadline(now:number,deadline:number,target:number):number {
  'worklet';
  const period=1000/target;
  if(deadline===0)return now+period;
  // Advance to a future phase. A 2–3 period stall must not leave an overdue
  // deadline that causes a burst of catch-up camera updates on subsequent frames.
  return deadline+Math.max(1,Math.floor((now-deadline+.5)/period)+1)*period;
}
export const FRAME_BUCKETS=[8,12,16,17,20,25,33,40,50,67,83,100,125,150,200,250,350,500,750,1000,2000,5000] as const;
export function frameBucket(ms:number):number {
  'worklet';
  for(let i=0;i<FRAME_BUCKETS.length;i++)if(ms<=FRAME_BUCKETS[i]!)return i;
  return FRAME_BUCKETS.length;
}
export interface FrameAccumulator {
  deadline:number;sampleClock:number;count:number;slow:number;updates:number;lastMotion:number;
  histogram:number[];
}
/** Private UI-runtime state, not reactive values. Nothing observes these
 * counters per frame; only the completed one-second sample crosses to JS. */
export function createFrameAccumulator():FrameAccumulator {
  return {deadline:0,sampleClock:0,count:0,slow:0,updates:0,lastMotion:0,histogram:Array(FRAME_BUCKETS.length+1).fill(0)};
}
export function recordFrameInterval(sample:FrameAccumulator,dt:number,target:number,distribution:boolean):void {
  'worklet';
  sample.count++;if(dt>1000/target*1.5)sample.slow++;
  if(distribution)sample.histogram[frameBucket(dt)]!++;
}
export function finishFrameSample(sample:FrameAccumulator,now:number,distribution:boolean) {
  'worklet';
  const elapsed=now-sample.sampleClock;
  const result={fps:sample.count*1000/elapsed,ms:elapsed/sample.count,slow:sample.slow,updates:sample.updates,histogram:distribution?sample.histogram.slice():undefined};
  sample.sampleClock=now;sample.count=0;sample.slow=0;sample.updates=0;sample.histogram.fill(0);
  return result;
}
/** Histogram upper bounds, not exact quantiles. Overflow remains explicit. */
export function frameQuantile(histogram:readonly number[],q:number):number|null {
  const total=histogram.reduce((n,x)=>n+x,0);if(!total)return null;
  let count=0;for(let i=0;i<histogram.length;i++){count+=histogram[i]!;if(count>=Math.ceil(total*q))return FRAME_BUCKETS[i]??null;}
  return null;
}

/** Low-priority work can wait for a quiet camera, but a local game tick has a
 * bounded delay. Manual/background saves do not use this deferral. */
export class CameraWorkGate {
  private active=0;
  private changedAt=-Infinity;
  activity(active:boolean,now=performance.now()):void {this.active=Math.max(0,this.active+(active?1:-1));this.changedAt=now;}
  defer(now:number,quietMs:number,dueAt?:number,maxDelay=1500):boolean {
    if(dueAt!==undefined&&now-dueAt>=maxDelay)return false;
    return this.active>0||now-this.changedAt<quietMs;
  }
}
