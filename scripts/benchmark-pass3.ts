import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {mapSceneFor} from '../src/map/worldScene';
import {findArmyRoute} from '../supabase/functions/_shared/armyOrders';
import {runStrategicAI} from '../supabase/functions/_shared/aiSystem';
import {cloneGameState} from '../supabase/functions/_shared/cloneGameState';
import {encodeSnapshot} from '../supabase/functions/_shared/stateWire';
const started=performance.now();let state=createWorldState('pass3-profile','PASS03','host','Profile',101);const createMs=performance.now()-started;
const t=performance.now(),scene=mapSceneFor(state);const sceneMs=performance.now()-t;
state.phase='running';state.players[0]!.countryId='germany';
const army=state.armies.find(a=>a.ownerId==='germany')!,targets=state.provinces.filter(p=>p.ownerId==='germany'),paths:number[]=[];
for(const p of targets){const t=performance.now();try{findArmyRoute(state,army,p.id);}catch{}paths.push(performance.now()-t);}
const ai=cloneGameState(state);ai.tick=6;const aiStart=performance.now();runStrategicAI(ai,{recruit:()=>{},move:()=>{}});const aiDecisionMs=performance.now()-aiStart;
const local:number[]=[];for(let i=0;i<100;i++){const t=performance.now();state=applyCommand(state,{type:'ADVANCE_TICK'},true);local.push(performance.now()-t);}
const p95=(a:number[])=>a.sort((a,b)=>a-b)[Math.floor(a.length*.95)]!;
console.log(JSON.stringify({provinces:state.provinces.length,cities:state.cities!.length,geometryFeatures:scene.provinceGeometry.size,edges:scene.edges.length,vertices:scene.features.reduce((n,f)=>n+f.polygons.reduce((n,p)=>n+p.reduce((n,r)=>n+r.length,0),0),0),createMs,sceneMs,pathQueries:paths.length,pathP95Ms:p95(paths),aiDecisionMs,localTickP95Ms:p95(local),initialSnapshotBytes:Buffer.byteLength(JSON.stringify(createWorldState('pass3-profile','PASS03','host','Profile',101))),finalSnapshotBytes:Buffer.byteLength(JSON.stringify(state)),dynamicSnapshotBytes:Buffer.byteLength(JSON.stringify(encodeSnapshot({state}))),heapUsed:process.memoryUsage().heapUsed,note:'Host CPU only. AI decision probe uses no-op military callbacks; not full combat tick time. No physical FPS claim.'},null,2));
