export interface Metrics{countryTargets:string;armyTargets:string;frameP50Ms:number|null;frameP95Ms:number|null;frameP99Ms:number|null;frameSamples:number;over50Ms:number;over100Ms:number;cullCommits:number;pathBuilds:number;pathBuildMs:number;rasterPrewarmBuilds:number;rasterPrewarmMs:number;rasterBuilds:number;rasterMs:number;rasterBytes:number;rasterTiles:number;tapToActionMs:number;tapToScreenMs:number;renderFeatures:number;benchmarkError:string;benchmarkTicks:number;uiFps:number;frameMs:number;slowFrames:number;cameraUpdates:number;visibleProvinces:number;visibleArmies:number;visibleLabels:number;simulationMs:number;networkMs:number;networkBytes:number;mapRenders:number;geographyRenders:number;preset:string;geometryLod:string;sceneMs:number}
/** Touch coordinates remain in the accessibility HUD. Keeping them out of
 * timing logs prevents Android logcat truncation during dense map workloads. */
export function cameraMetrics(value:Metrics):Omit<Metrics,'countryTargets'|'armyTargets'>{
  const {countryTargets,armyTargets,...timings}=value;
  return {...timings,benchmarkError:timings.benchmarkError.slice(0,160)};
}
let metrics:Metrics={countryTargets:'',armyTargets:'',frameP50Ms:null,frameP95Ms:null,frameP99Ms:null,frameSamples:0,over50Ms:0,over100Ms:0,cullCommits:0,pathBuilds:0,pathBuildMs:0,rasterPrewarmBuilds:0,rasterPrewarmMs:0,rasterBuilds:0,rasterMs:0,rasterBytes:0,rasterTiles:0,tapToActionMs:0,tapToScreenMs:0,renderFeatures:0,benchmarkError:'',benchmarkTicks:0,uiFps:0,frameMs:0,slowFrames:0,cameraUpdates:0,visibleProvinces:0,visibleArmies:0,visibleLabels:0,simulationMs:0,networkMs:0,networkBytes:0,mapRenders:0,geographyRenders:0,preset:'Balanced',geometryLod:'low',sceneMs:0};
const listeners=new Set<()=>void>();let lastNotify=0;const samples:Metrics[]=[];
export function recordMetrics(next:Partial<Metrics>,notify=false){metrics={...metrics,...next};if(notify&&Date.now()-lastNotify>=900){lastNotify=Date.now();samples.push({...metrics});if(samples.length>1800)samples.shift();for(const l of listeners)l();}}
export const getMetrics=()=>metrics;
export function subscribeMetrics(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const metricSamples=()=>samples.slice();
export function resetMetricSamples(){samples.length=0;}
