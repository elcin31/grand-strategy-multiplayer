import {boundsOf,overlaps,type MapFeature,type Bounds} from './geometry';
export interface RenderChunk{key:string;features:MapFeature[];bounds:Bounds}
const cache=new WeakMap<readonly MapFeature[],RenderChunk[]>();
/** Fixed spatial batches: panning changes visible chunk references, never their geometry. */
export function renderChunks(features:readonly MapFeature[]):RenderChunk[]{
 const old=cache.get(features);if(old)return old;
 const cells=new Map<string,MapFeature[]>();for(const f of features){if(!f.provinceId)continue;const key=`${Math.floor(f.anchor.x/60)},${Math.floor(f.anchor.y/60)}`;const cell=cells.get(key)??[];cell.push(f);cells.set(key,cell);}
 const chunks:RenderChunk[]=[];for(const [key,cell]of cells)for(let i=0;i<cell.length;i+=48){const group=cell.slice(i,i+48);chunks.push({key:key+':'+i,features:group,bounds:boundsOf(group.flatMap(f=>[{x:f.bounds.left,y:f.bounds.top},{x:f.bounds.right,y:f.bounds.bottom}]))});}cache.set(features,chunks);return chunks;
}
export function visibleChunks(features:readonly MapFeature[],bounds:Bounds){return renderChunks(features).filter(chunk=>overlaps(chunk.bounds,bounds));}
