import type {SliceTimers} from './idleSlices';

interface Work {run:()=>void|Promise<void>;canRun:()=>boolean;priority:number;cancelled:boolean}
/** One decode/record/raster at a time. Camera input always has priority.
 * Unmounted tiles remove their queued work instead of building a stale backlog. */
export class MapWorkQueue {
  private pending:Work[]=[];
  private timer:unknown;
  private running=false;
  constructor(private clock:SliceTimers={set:(run,ms)=>setTimeout(run,ms),clear:t=>clearTimeout(t as ReturnType<typeof setTimeout>)}){}
  get size(){return this.pending.length;}
  schedule(run:Work['run'],canRun:()=>boolean,priority=0):()=>void {
    const work={run,canRun,priority,cancelled:false};this.pending.push(work);this.wake();
    return()=>{work.cancelled=true;const i=this.pending.indexOf(work);if(i>=0)this.pending.splice(i,1);};
  }
  private wake(ms=16){if(!this.running&&this.timer===undefined&&this.pending.length)this.timer=this.clock.set(()=>{this.timer=undefined;void this.drain();},ms);}
  private async drain(){
    const available=this.pending.filter(w=>!w.cancelled&&w.canRun()).sort((a,b)=>a.priority-b.priority);
    const work=available[0];if(!work){this.wake(80);return;}
    this.pending.splice(this.pending.indexOf(work),1);this.running=true;
    try{if(!work.cancelled)await work.run();}catch(error){console.warn('Dominion map preparation failed',error);}finally{this.running=false;this.wake();}
  }
}
export const mapWorkQueue=new MapWorkQueue();
