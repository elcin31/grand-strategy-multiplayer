import {preparedCountryLabels} from '../src/map/labelIndex';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {mapSceneFor} from '../src/map/worldScene';
import {borderPaths,countryLabels} from '../src/map/scene';
import {visibleBounds} from '../src/map/camera';
const state=createWorldState('render-profile','PROFILE','host','Profile',91),scene=mapSceneFor(state),owners=new Map(state.provinces.map(p=>[p.id,p.ownerId]));
const samples=[];const optimized=process.argv.includes('--optimized');if(optimized)preparedCountryLabels(scene.features,owners);
for(let i=0;i<24;i++){
 const bounds=visibleBounds({x:760+i*3,y:170,zoom:3.5},{width:1280,height:720},optimized?140:300),visible=scene.spatialIndex.query(bounds).filter(f=>f.provinceId),ids=new Set(visible.map(f=>f.provinceId!));
 const start=performance.now();borderPaths(state,ids,scene.edges);const bordersMs=performance.now()-start;
 const t=performance.now();const labels=optimized?preparedCountryLabels(scene.features,owners).filter(l=>l.anchor.x>=bounds.left&&l.anchor.x<=bounds.right&&l.anchor.y>=bounds.top&&l.anchor.y<=bounds.bottom):countryLabels(scene.features,owners,[],{height:4},new Set(visible.map(f=>owners.get(f.provinceId!)!)));
 samples.push({visible:visible.length,labels:labels.length,bordersMs,labelsMs:performance.now()-t});
}
const report={source:optimized?'working-tree optimization':'9aa6ea1',kind:'Node CPU render preparation; not device FPS',samples};writeFileSync(optimized?'RENDER_AFTER.json':'RENDER_BASELINE.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
