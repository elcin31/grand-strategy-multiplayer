import type {MapFeature,Point} from './geometry';
export type GeometryLod='low'|'medium'|'high';
const cache=new WeakMap<MapFeature,Partial<Record<GeometryLod,MapFeature>>>();
/** Radial simplification is render-only. Authoritative hit geometry stays untouched. */
function ringLod(ring:Point[],tolerance:number):Point[]{
 if(ring.length<=5)return ring;const result:Point[]=[ring[0]!];let last=ring[0]!;
 for(let i=1;i<ring.length-1;i++){const p=ring[i]!;if(Math.hypot(p.x-last.x,p.y-last.y)>=tolerance){result.push(p);last=p;}}
 if(result.length<3)return ring;
 result.push(result[0]!);return result;
}
export function geometryForLod(feature:MapFeature,lod:GeometryLod):MapFeature{
 if(lod==='high')return feature;let entry=cache.get(feature);if(!entry){entry={};cache.set(feature,entry);}if(entry[lod])return entry[lod]!;
 const tolerance=lod==='low'?.65:.18;
 const result={...feature,polygons:feature.polygons.map(p=>p.map(r=>ringLod(r,tolerance)))};entry[lod]=result;return result;
}
export function selectGeometryLod(zoom:number,preset:string):GeometryLod{return zoom>=7?'high':zoom>=3&&(preset==='High'||preset==='Ultra')?'medium':'low';}
