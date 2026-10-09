/** Phase-preserving deadlines avoid rounding 60Hz down to 45Hz on a 90Hz
 * display. A long stall drops missed deadlines rather than replaying frames. */
export function nextFrameDeadline(now:number,deadline:number,target:number):number {
  'worklet';
  const period=1000/target;
  if(deadline===0||now-deadline>period*4)return now+period;
  return deadline+period;
}
export const FRAME_BUCKETS=[8,12,16,17,20,25,33,40,50,67,83,100,125,150,200,250,350,500,750,1000,2000,5000] as const;
export function frameBucket(ms:number):number {
  'worklet';
  for(let i=0;i<FRAME_BUCKETS.length;i++)if(ms<=FRAME_BUCKETS[i]!)return i;
  return FRAME_BUCKETS.length;
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
