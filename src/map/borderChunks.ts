import type {Edge} from './scene';
import {boundsOf,overlaps,type Bounds} from './geometry';
export interface BorderChunk {key:string;bounds:Bounds;inner:Edge[];outer:Edge[]}
const cache=new WeakMap<readonly Edge[],WeakMap<ReadonlyMap<string,string>,BorderChunk[]>>();
/** Ownership is the only mutable input. Camera, treasury, selection and HUD
 * never concatenate/reparse the complete world border on each cull. */
export function borderChunks(edges:readonly Edge[],owners:ReadonlyMap<string,string>):BorderChunk[]{
  let generations=cache.get(edges);if(!generations){generations=new WeakMap();cache.set(edges,generations);}
  const cached=generations.get(owners);if(cached)return cached;
  const cells=new Map<string,{inner:Edge[];outer:Edge[]}>();
  for(const edge of edges){
    const key=Math.floor((edge.a.x+edge.b.x)/128)+':'+Math.floor((edge.a.y+edge.b.y)/128);
    let chunk=cells.get(key);if(!chunk){chunk={inner:[],outer:[]};cells.set(key,chunk);}
    const outer=edge.provinces.length===1||edge.provinces.some(id=>owners.get(id)!==owners.get(edge.provinces[0]!));
    (outer?chunk.outer:chunk.inner).push(edge);
  }
  const result=[...cells].map(([key,c])=>({key,...c,bounds:boundsOf([...c.inner,...c.outer].flatMap(e=>[e.a,e.b]))}));
  generations.set(owners,result);return result;
}
export function bordersInBounds(chunks:readonly BorderChunk[],bounds:Bounds):BorderChunk[]{return chunks.filter(c=>overlaps(c.bounds,bounds));}
