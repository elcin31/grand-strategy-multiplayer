export interface SliceTimers {set(run:()=>void,ms:number):unknown;clear(token:unknown):void}
const timers:SliceTimers={set:(run,ms)=>setTimeout(run,ms),clear:token=>clearTimeout(token as ReturnType<typeof setTimeout>)};
/** Background preparation only. One bounded item per quiet slice, never a
 * render-frame callback; foreground work/gestures may defer it indefinitely. */
export function scheduleIdleSlices(canRun:()=>boolean,step:()=>boolean,clock:SliceTimers=timers):()=>void {
  let cancelled=false,token:unknown;
  const run=()=>{
    if(cancelled)return;
    if(!canRun()){token=clock.set(run,100);return;}
    if(step())token=clock.set(run,50);
  };
  token=clock.set(run,750);
  return()=>{cancelled=true;clock.clear(token);};
}
