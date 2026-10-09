import {execFileSync} from 'node:child_process';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {initializePopulation} from '../supabase/functions/_shared/populationSystem';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {mapSceneFor} from '../src/map/worldScene';
import {visibleCities} from '../src/map/scene';
import {pointsInBounds} from '../src/map/pointIndex';
import {visibleBounds} from '../src/map/camera';
import {GRAPHICS,type GraphicsPreset} from '../src/map/settings';
import oldCityData from '../tests/fixtures/cities-v4.json';
const originalPoints=JSON.parse(execFileSync('git',['show','9dc0dec:src/world/data/city-points.json'],{encoding:'utf8',maxBuffer:4e6})) as {id:string;point:number[]}[];
const points=new Map(originalPoints.map(c=>[c.id,{x:c.point[0]!,y:c.point[1]!}]));
const oldCities=oldCityData.map(c=>({id:c.id,name:c.name,population:c.population,capital:c.isCapital,point:points.get(c.id)!}));
const after=createWorldState('pass3-profile','PASS03','host','Profile',101),before=structuredClone(after);before.stateVersion=11;before.cities=structuredClone(oldCityData);for(const p of before.provinces)p.cityIds=before.cities.filter(c=>c.provinceId===p.id).map(c=>c.id);initializePopulation(before);
const originalBudgets={Performance:8,Balanced:24,High:60,Ultra:100};
const oldQuery=(bounds:ReturnType<typeof visibleBounds>,zoom:number,preset:GraphicsPreset)=>pointsInBounds(oldCities,bounds).filter(c=>(c.capital||(zoom>=5&&(c.population>=250000||zoom>=9)))&&c.point.x>=bounds.left&&c.point.x<=bounds.right&&c.point.y>=bounds.top&&c.point.y<=bounds.bottom).sort((a,b)=>Number(b.capital)-Number(a.capital)||b.population-a.population).slice(0,originalBudgets[preset]);
const scene=mapSceneFor(after),p95=(a:number[])=>[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)]!,qBefore:number[]=[],qAfter:number[]=[];
let markersBefore=0,markersAfter=0;
for(let i=0;i<1200;i++){const zoom=[.8,3.5,7,12][i%4]!,bounds=visibleBounds({x:i*71%1440,y:i*37%720,zoom},{width:1280,height:720},140);let t=performance.now();markersBefore+=oldQuery(bounds,zoom,'Balanced').length;qBefore.push(performance.now()-t);t=performance.now();markersAfter+=visibleCities(scene.cities,bounds,zoom,'Balanced').length;qAfter.push(performance.now()-t);}
let old=before,now=after;for(const s of [old,now]){s.phase='running';s.players[0]!.countryId='germany';}
const tickBefore:number[]=[],tickAfter:number[]=[];
for(let i=0;i<100;i++){let t=performance.now();old=applyCommand(old,{type:'ADVANCE_TICK'},true);tickBefore.push(performance.now()-t);t=performance.now();now=applyCommand(now,{type:'ADVANCE_TICK'},true);tickAfter.push(performance.now()-t);}
console.log(JSON.stringify({fixture:{id:before.id,seed:101,ticks:100,cameraQueries:1200,viewport:[1280,720],preset:'Balanced'},before:{cities:before.cities.length,initialSnapshotBytes:Buffer.byteLength(JSON.stringify(before)),finalSnapshotBytes:Buffer.byteLength(JSON.stringify(old)),cityQueryP95Ms:p95(qBefore),localTickP95Ms:p95(tickBefore),markersAcrossQueries:markersBefore},after:{cities:after.cities!.length,initialSnapshotBytes:Buffer.byteLength(JSON.stringify(after)),finalSnapshotBytes:Buffer.byteLength(JSON.stringify(now)),cityQueryP95Ms:p95(qAfter),localTickP95Ms:p95(tickAfter),markersAcrossQueries:markersAfter},presetBudgets:{before:originalBudgets,after:Object.fromEntries(Object.entries(GRAPHICS).map(([k,v])=>[k,v.cityBudget]))},note:'Paired host CPU workload, original v4 city-culling algorithm and old catalogue compared with reduced catalogue/tier indexes; trusted simulation skips schema migrations for both. No native FPS or Android memory claim.'},null,2));
