import {boundsOf,featurePath,overlaps,type Bounds,type MapFeature,type Point} from './geometry';
import type {MapScene} from './worldScene';
interface CountryShape {id:string;countryId:string;provinceId:string;anchor:number[];polygons:number[][][][]}
const cache=new WeakMap<MapScene,MapFeature[]>();
const ownershipShapes=new WeakMap<MapScene,Map<string,readonly MapFeature[]>>();
/** Static country silhouettes, independent of mutable campaign state. */
export function countryRenderFeatures(scene:MapScene):MapFeature[]{
 let features=cache.get(scene);if(features)return features;
 // Legacy mini-world has no matching catalogue and retains its existing renderer.
 if(scene.provinceGeometry.size<1000)return [];
 const data=require('../world/data/country-lod.json') as CountryShape[];
 features=data.map(g=>{const polygons:Point[][][]=g.polygons.map(p=>p.map(r=>r.map(v=>({x:v[0]!,y:v[1]!}))));return{id:g.id,countryId:g.countryId,provinceId:g.provinceId,name:g.countryId,anchor:{x:g.anchor[0]!,y:g.anchor[1]!},polygons,bounds:boundsOf(polygons.flat(2))};});
 cache.set(scene,features);return features;
}
/** Only intact countries use merged geometry. Changed ownership falls back exactly
 * to the original provinces; occupations/armies/selection stay separate layers. */
export function renderFeaturesFor(scene:MapScene,owners:ReadonlyMap<string,string>,global:boolean):readonly MapFeature[]{
 if(!global)return scene.features;
 const merged=countryRenderFeatures(scene);if(!merged.length)return scene.features;
 const changed=new Set<string>();
 for(const f of scene.features)if(f.provinceId&&owners.get(f.provinceId)!==f.countryId)changed.add(f.countryId!);
 // Geometry depends on which countries need exact province fallback, while
 // their current colors/owners remain separate inputs. Handle mutable callers
 // too, and keep the same array when returning to a previously prepared zoom.
 let variants=ownershipShapes.get(scene);if(!variants){variants=new Map();ownershipShapes.set(scene,variants);}
 const key=[...changed].sort().join(',');const saved=variants.get(key);if(saved)return saved;
 const result=[...merged.filter(f=>!changed.has(f.countryId!)),...scene.features.filter(f=>f.provinceId&&changed.has(f.countryId!))];
 if(variants.size>=16)variants.delete(variants.keys().next().value!);variants.set(key,result);return result;
}

const outlinePaths=new WeakMap<MapFeature,string>();
export function countryOutlines(features:readonly MapFeature[],bounds:Bounds):string|null {
 if(features.some(f=>f.provinceId&&!f.id.startsWith('render-country-')))return null;
 let path='';for(const f of features){if(!overlaps(f.bounds,bounds))continue;let part=outlinePaths.get(f);if(part===undefined){part=featurePath(f);outlinePaths.set(f,part);}path+=part;}return path;
}
