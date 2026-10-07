import {renderFeaturesFor,countryOutlines} from '../src/map/countryRender';
import {writeFileSync,statSync} from 'node:fs';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {mapSceneFor} from '../src/map/worldScene';
import {visibleBounds} from '../src/map/camera';
import {visibleChunks} from '../src/map/renderChunks';
import {visibleCities,borderPaths} from '../src/map/scene';
import {cloneGameState} from '../supabase/functions/_shared/cloneGameState';
const state=createWorldState('province-profile','PROFILE','host','Profile',91),scene=mapSceneFor(state);
const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
const cameras=[{name:'world',x:720,y:300,zoom:.8},{name:'Europe',x:790,y:170,zoom:3.5},{name:'Asia',x:1080,y:230,zoom:3.5},{name:'local',x:790,y:170,zoom:7}];
const samples=cameras.map(camera=>{const bounds=visibleBounds(camera,{width:1000,height:460},140),visible=scene.spatialIndex.query(bounds).filter(f=>f.provinceId),chunks=visibleChunks(scene.features,bounds),ids=new Set(visible.map(f=>f.provinceId!));const reduced=renderFeaturesFor(scene,new Map(state.provinces.map(p=>[p.id,p.ownerId])),camera.zoom<3.8),renderChunks=visibleChunks(reduced,bounds);const reducedStart=performance.now();const outline=countryOutlines(reduced,bounds);const outlineMs=performance.now()-reducedStart;let t=performance.now();const borders=borderPaths(state,ids,scene.edges);const bordersMs=performance.now()-t;return{camera,renderFeaturesAfter:renderChunks.reduce((n,c)=>n+c.features.length,0),outlineBytes:outline===null?null:bytes(outline),outlineMs,visible:visible.length,batchProvinces:chunks.reduce((n,c)=>n+c.features.length,0),chunks:chunks.length,labelCandidates:visibleCities(scene.cities,bounds,camera.zoom,'Balanced').length,borderBytes:bytes(borders),bordersMs};});
const samplesFor=(fn:typeof cloneGameState)=>{const times=[];for(let i=0;i<30;i++){const t=performance.now();fn(state);times.push(performance.now()-t);}times.sort((a,b)=>a-b);return{median:times[15],p95:times[28]};};
const provinces=new Map(state.provinces.map(p=>[p.id,p]));let sameCountry=0,compatible=0;
for(const p of state.provinces)for(const id of p.neighbors){const q=provinces.get(id)!;if(p.id>=id||p.ownerId!==q.ownerId)continue;sameCountry++;if(p.terrain===q.terrain&&p.religion===q.religion&&p.resourceDeposit?.type===q.resourceDeposit?.type&&JSON.stringify(p.buildings)===JSON.stringify(q.buildings))compatible++;}
const report={provinces:state.provinces.length,cities:state.cities!.length,geometryFeatures:scene.features.length,edges:scene.edges.length,vertices:scene.features.reduce((n,f)=>n+f.polygons.reduce((a,p)=>a+p.reduce((b,r)=>b+r.length,0),0),0),geometryFileBytes:statSync('src/world/data/geometry.json').size,snapshotBytes:bytes(state),provinceBytes:bytes(state.provinces),cityBytes:bytes(state.cities),neighborLookupsPerAIIndex:state.provinces.reduce((n,p)=>n+p.neighbors.length,0),sameCountryEdges:sameCountry,initialAttributeCompatibleEdges:compatible,cloneNativeMs:samplesFor(structuredClone),cloneTreeMs:samplesFor(cloneGameState),samples,note:'Host CPU samples; attribute-compatible edges are only merge candidates, not proof of safe resource/building aggregation or measured Android FPS.'};
writeFileSync('PROVINCE_COST_PASS2.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
