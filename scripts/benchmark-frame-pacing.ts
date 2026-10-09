import {writeFileSync} from 'node:fs';
import {nextFrameDeadline} from '../src/performance/framePacing';
const scenarios=[];
for(const displayHz of [60,90,120])for(const target of [30,60])for(const jitter of [false,true]){
  const row:{displayHz:number;target:number;jitter:boolean;before?:object;after?:object}={displayHz,target,jitter};
  for(const implementation of ['before','after'] as const){
    let clock=0,last=0,now=0,updates=0;const intervals:number[]=[];
    for(let i=0;i<displayHz*20;i++){
      now+=1000/displayHz+(jitter?(i%2?.9:-.9):0);
      if(implementation==='before'?now-clock>=1000/target-.5:now>=clock-.5){
        clock=implementation==='before'?now:nextFrameDeadline(now,clock,target);
        if(last)intervals.push(now-last);last=now;updates++;
      }
    }
    intervals.sort((a,b)=>a-b);row[implementation]={updates,updatesPerSecond:updates/20,intervalP50Ms:intervals[Math.floor(intervals.length*.5)],intervalP95Ms:intervals[Math.floor(intervals.length*.95)],intervalP99Ms:intervals[Math.floor(intervals.length*.99)]};
  }
  scenarios.push(row);
}
const report={baselineSource:'dbb354ab038713c3e54b969b34a6fc88bf2de11f',note:'Deterministic 20-second callback replay of the exact old reset-clock condition versus the new phase-preserving deadline. Isolates the pacing algorithm. Does not measure GPU presentation, Android FPS or Redmi hardware. Irregular callbacks can still produce physical microstutter.',scenarios};
writeFileSync('EXPANSION_FRAME_PACING.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
