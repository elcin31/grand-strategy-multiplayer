import { RELIGIONS } from '../supabase/functions/_shared/religionSystem';
import { performance } from 'node:perf_hooks';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand } from '../supabase/functions/_shared/game';
import { mapSceneFor } from '../src/map/worldScene';
import { countryLabels } from '../src/map/scene';
const start=performance.now();let state=createWorldState('benchmark','WORLD1','host','Benchmark');const createMs=performance.now()-start;
const beforeScene=performance.now();const scene=mapSceneFor(state);const sceneMs=performance.now()-beforeScene;
const labelStart=performance.now();const labels=countryLabels(scene.features,new Map(state.provinces.map(p=>[p.id,p.ownerId])),[],{height:4},new Set(['germany','france','poland','italy','uk','esp','nld','bel','che','aut','cze']));const labelMs=performance.now()-labelStart;
const snapshotBytes=Buffer.byteLength(JSON.stringify(state));
state.players[0]!.countryId='usa';state.players[0]!.ready=true;state.phase='running';
const ticks=Number(process.argv[2]??100);if(!Number.isSafeInteger(ticks)||ticks<1||ticks>10000)throw Error('Invalid tick count');
const durations:number[]=[];
for(let i=0;i<ticks;i++){
 const before=performance.now();state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');durations.push(performance.now()-before);
 if(state.tick!==i+1)throw Error('Clock stopped');
 for(const c of Object.values(state.countries))for(const n of [c.treasury,c.income,c.population,c.manpower,c.army])if(!Number.isFinite(n)||n<0)throw Error('Invalid country value');
 for(const c of Object.values(state.countries)){
  for(const n of [c.debt,c.bankruptcyCount,c.bankruptcyUntilTick])if(!Number.isFinite(n)||n!<0)throw Error('Invalid financial state');
  const b=c.economy!;for(const n of Object.values(b))if(!Number.isFinite(n))throw Error('Invalid financial budget');
  if(b.monthlyIncome!==Math.round((b.taxIncome+b.tradeIncome+b.resourceIncome)*1000)/1000||b.monthlyBalance!==Math.round((b.monthlyIncome-b.armyMaintenance-b.buildingMaintenance-b.interest)*1000)/1000)throw Error('Inconsistent financial budget');
  if(b.armyMaintenance!==Math.round(c.army/1000*1.25*1000)/1000)throw Error('Inconsistent army upkeep');
 }
 for(const c of Object.values(state.countries))for(const n of [c.technology,c.stability,c.unrest,c.religiousUnity])if(!Number.isFinite(n)||n!<0||n!>100)throw Error('Invalid capped country value');
 for(const c of Object.values(state.countries))if(!Number.isFinite(c.politicalPower)||c.politicalPower!<0||c.politicalPower!>500)throw Error('Invalid political power');
 if(new Set(state.provinces.map(p=>p.id)).size!==state.provinces.length)throw Error('Duplicate provinces');
 for(const p of state.provinces)if(!Object.hasOwn(RELIGIONS,p.religion!)||!Number.isFinite(p.unrest)||p.unrest!<0||p.unrest!>100||!state.countries[p.ownerId])throw Error('Invalid religious province');
 const provinceById=new Map(state.provinces.map(p=>[p.id,p]));const urban=new Map<string,number>();const population=new Map<string,number>();const births=new Map<string,number>();
 for(const p of state.provinces){if(!Number.isSafeInteger(p.population)||p.population<0||!Number.isFinite(p.populationGrowthCarry)||p.populationGrowthCarry!<0||p.populationGrowthCarry!>=1)throw Error('Invalid province population');population.set(p.ownerId,(population.get(p.ownerId)??0)+p.population);births.set(p.ownerId,(births.get(p.ownerId)??0)+p.monthlyPopulationGrowth!);}
 for(const c of state.cities!){if(!Number.isSafeInteger(c.population)||c.population<0||!Number.isFinite(c.populationGrowthCarry)||c.populationGrowthCarry!<0||c.populationGrowthCarry!>=1||!provinceById.has(c.provinceId))throw Error('Invalid city population');urban.set(c.provinceId,(urban.get(c.provinceId)??0)+c.population);}
 for(const [id,count]of urban)if(count>provinceById.get(id)!.population)throw Error('Urban population exceeds province');
 for(const c of Object.values(state.countries))if(c.population!==(population.get(c.id)??0)||c.monthlyPopulationGrowth!==(births.get(c.id)??0))throw Error('Inconsistent country population');
 if(new Set(state.armies.map(a=>a.id)).size!==state.armies.length||state.armies.some(a=>!Number.isSafeInteger(a.troops)||a.troops<=0))throw Error('Invalid armies');
 if(state.battleLog.length>20)throw Error('Unbounded battle history');
}
durations.sort((a,b)=>a-b);
console.log(JSON.stringify({countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length,armies:state.armies.length,ticks:state.tick,createMs:+createMs.toFixed(2),sceneMs:+sceneMs.toFixed(2),visibleCountryLabels:labels.length,labelMs:+labelMs.toFixed(2),tickP95Ms:+durations[Math.min(ticks-1,Math.floor(ticks*.95))]!.toFixed(2),snapshotBytes,finalSnapshotBytes:Buffer.byteLength(JSON.stringify(state)),note:'CPU/data simulation only; no native FPS, networking chaos, or completed AI 2.0 claim'},null,2));
