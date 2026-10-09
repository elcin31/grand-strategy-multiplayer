import {createWorldState} from '../supabase/functions/_shared/worldState';
import {mapSceneFor} from '../src/map/worldScene';
import {visibleBounds,TILT} from '../src/map/camera';
import {countryOutlines,renderFeaturesFor} from '../src/map/countryRender';
import {visibleChunks} from '../src/map/renderChunks';
import {selectGeometryLod,geometryForLod} from '../src/map/geometryLod';
import {borderPaths,visibleCities,cityLabelPlacements} from '../src/map/scene';
import {armyCounters,occupationFeatures,warBorderPath} from '../src/map/overlays';
import {clusterArmies} from '../src/map/armyClusters';
import {featurePath} from '../src/map/geometry';
import {cameraCoverage,cameraNeedsCoverage,rasterLevel} from '../src/map/cameraCoverage';
import {visibleRasterTiles} from '../src/map/rasterTiles';
import {borderChunks,bordersInBounds} from '../src/map/borderChunks';
import {budgetArmyMarkers,markerBudgets} from '../src/map/markerBudget';
import {writeFileSync} from 'node:fs';
const state=createWorldState('camera-profile','CAMERA','host','Profile',101),scene=mapSceneFor(state),owners=new Map(state.provinces.map(p=>[p.id,p.ownerId]));
const viewport={width:1280,height:720},scenarios=[['idle',3.5,'Political'],['pan-medium',3.5,'Political'],['pinch-medium',3.5,'Political'],['whole-world',.8,'Political'],['local-labels-armies',9,'Political'],['terrain-pan',5,'Terrain'],['military-pan',3.5,'Military'],['religion-overlay',3.5,'Religion'],['world-military',.8,'Military'],['panel-open',3.5,'Political'],['panel-closed',3.5,'Political']] as const;
const output=[];
for(const implementation of ['before','after'] as const)for(const [name,startZoom,mode] of scenarios){
 const native=new Set<string>(),seenTiles=new Set<string>();let lastGlobal:boolean|undefined,render=scene.features as readonly import('../src/map/geometry').MapFeature[],context=render;
 const staticBorders=implementation==='after'?borderChunks(scene.edges,owners):[];
 let camera:{x:number;y:number;zoom:number}={x:800,y:160,zoom:startZoom},last=-Infinity,updates=0,renderFeatures=0,maxProvinces=0,maxArmies=0,maxLabels=0,stringBytes=0,maxTiles=0,visibleRgbaBytes=0;
 const times:number[]=[]; const startHeap=process.memoryUsage().heapUsed;
 for(let i=0;i<1200;i++){
  const t=i*1000/60,next={x:800+(name==='idle'?0:140*Math.sin(i/120))/startZoom,y:160,zoom:name.startsWith('pinch')?startZoom*Math.exp(.6*Math.sin(i/80)):startZoom};
  const moved=Math.hypot(next.x-camera.x,next.y-camera.y)*next.zoom>96,scaled=Math.abs(Math.log(next.zoom/camera.zoom))>.1;
  const needed=implementation==='before'?moved||scaled:cameraNeedsCoverage(next,camera,viewport);
  if(i!==0&&(!needed||t-last<=(implementation==='before'?100:160)))continue;
  camera=next;last=t;updates++;
  const began=performance.now(),bounds=implementation==='before'?visibleBounds(camera,viewport,140):cameraCoverage(camera,viewport),visible=scene.spatialIndex.query(bounds).filter(f=>f.provinceId),ids=new Set(visible.map(f=>f.provinceId!));
  const global=camera.zoom<3.8&&mode==='Political';if(global!==lastGlobal){render=renderFeaturesFor(scene,owners,global);lastGlobal=global;context=render===scene.features?render:[...scene.features.filter(f=>!f.provinceId),...render];}
  const chunks=implementation==='before'?visibleChunks(render,bounds):[],lod=selectGeometryLod(camera.zoom,'Balanced');
  const tiles=implementation==='after'?visibleRasterTiles(context,bounds,rasterLevel(camera.zoom)):[];
  const newTiles=tiles.filter(tile=>!seenTiles.has(tile.key+lod+global));for(const tile of newTiles)seenTiles.add(tile.key+lod+global);
  for(const chunk of implementation==='before'?chunks:newTiles)for(const f of chunk.features)if(!native.has(f.id+lod)){stringBytes+=featurePath(geometryForLod(f,lod)).length;native.add(f.id+lod);}
  if(implementation==='before'){const outlines=render===scene.features?null:countryOutlines(render,bounds),borders=outlines===null?borderPaths(state,ids,scene.edges,camera.zoom>=3.8):{inner:'',outer:outlines};stringBytes+=borders.inner.length+borders.outer.length;}else for(const tile of newTiles)bordersInBounds(staticBorders,tile.bounds);
  maxTiles=Math.max(maxTiles,tiles.length);visibleRgbaBytes=Math.max(visibleRgbaBytes,tiles.reduce((n,t)=>n+((t.bounds.right-t.bounds.left)*t.level.scale+4)*((t.bounds.bottom-t.bounds.top)*t.level.scale+4)*4,0));
  const rawCounters=clusterArmies(armyCounters(state,ids),scene.provinceGeometry,camera.zoom),counters=implementation==='after'?budgetArmyMarkers(rawCounters,camera.zoom,markerBudgets(camera.zoom,'Balanced').armies):rawCounters,cities=visibleCities(scene.cities,bounds,camera.zoom,'Balanced'),blockers=counters.map(c=>({x:c.x,y:c.y,halfWidth:37/camera.zoom,halfHeight:12/(camera.zoom*TILT)}));
  const labels=cityLabelPlacements(cities,camera.zoom,TILT,s=>s.length*6,blockers,visibleBounds(camera,viewport,0));
  occupationFeatures(state,visible);if(state.wars?.length)warBorderPath(state,ids,scene.edges);
  times.push(performance.now()-began);maxProvinces=Math.max(maxProvinces,visible.length);renderFeatures=Math.max(renderFeatures,implementation==='before'?chunks.reduce((n,c)=>n+c.features.length,0):tiles.length);maxArmies=Math.max(maxArmies,counters.length);maxLabels=Math.max(maxLabels,labels.size);
 }
 const cold=times[0],cpuTotalMs=times.reduce((n,t)=>n+t,0),warm=[...times.slice(1)].sort((a,b)=>a-b);times.sort((a,b)=>a-b);output.push({implementation,name,zoom:startZoom,mode,cullUpdates:updates,coldSelectorMs:cold,cameraWorkCpuMs:cpuTotalMs,warmSelectorP95Ms:warm.length?warm[Math.floor(warm.length*.95)]:null,selectorP50Ms:times[Math.floor(times.length*.5)],selectorP95Ms:times[Math.floor(times.length*.95)],maxProvinces,maxRenderFeatures:renderFeatures,maxArmyMarkers:maxArmies,maxCityLabels:maxLabels,maxTiles,visibleRgbaBytes,geometryAndBorderStringBytes:stringBytes,heapDeltaBytes:process.memoryUsage().heapUsed-startHeap});
}
const report={baselineSource:'0ea39eca80dac8d68d379968f3a7275b874b56ae',fixture:{seed:101,viewport,frames:1200,seconds:20,provinces:state.provinces.length,cities:state.cities!.length,armies:state.armies.length},note:'Host CPU selector/geometry-string workload, old 96px/10%/100ms compared to coverage containment/32%/160ms, stable render feature generations for both; no React, native parsing, GPU or handset FPS claim. Heap deltas include GC noise. Country label layout already cached and excluded.',scenarios:output};
writeFileSync('CAMERA_HOST_PAIRED.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
