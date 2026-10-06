export interface Metrics{benchmarkError:string;uiFps:number;frameMs:number;slowFrames:number;cameraUpdates:number;visibleProvinces:number;visibleArmies:number;visibleLabels:number;simulationMs:number;networkMs:number;networkBytes:number;mapRenders:number;geographyRenders:number;preset:string;geometryLod:string;sceneMs:number}
let metrics:Metrics={benchmarkError:'',uiFps:0,frameMs:0,slowFrames:0,cameraUpdates:0,visibleProvinces:0,visibleArmies:0,visibleLabels:0,simulationMs:0,networkMs:0,networkBytes:0,mapRenders:0,geographyRenders:0,preset:'Balanced',geometryLod:'low',sceneMs:0};
const listeners=new Set<()=>void>();let lastNotify=0;const samples:Metrics[]=[];
export function recordMetrics(next:Partial<Metrics>,notify=false){metrics={...metrics,...next};if(notify&&Date.now()-lastNotify>=900){lastNotify=Date.now();samples.push({...metrics});if(samples.length>1800)samples.shift();for(const l of listeners)l();}}
export const getMetrics=()=>metrics;
export function subscribeMetrics(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const metricSamples=()=>samples.slice();
export function resetMetricSamples(){samples.length=0;}
