import {SpatialIndex,overlaps,type MapFeature,type Bounds,WORLD_WIDTH,WORLD_HEIGHT} from './geometry';
import type {RasterLevel} from './cameraCoverage';
export interface RasterTile {key:string;bounds:Bounds;features:MapFeature[];level:RasterLevel}
const cache=new WeakMap<readonly MapFeature[],Map<RasterLevel,RasterTile[]>>();
/** Spatial selection occurs before recording or drawing. Every fixed tile is
 * reused on pan; long coastal geometry is clipped to small bounded surfaces. */
export function rasterTiles(features:readonly MapFeature[],level:RasterLevel):RasterTile[]{
  let levels=cache.get(features);if(!levels){levels=new Map();cache.set(features,levels);}
  const cached=levels.get(level);if(cached)return cached;
  const index=new SpatialIndex(features),result:RasterTile[]=[];
  for(let y=0;y<WORLD_HEIGHT;y+=level.cell)for(let x=0;x<WORLD_WIDTH;x+=level.cell){
    const bounds={left:x,top:y,right:Math.min(WORLD_WIDTH,x+level.cell),bottom:Math.min(WORLD_HEIGHT,y+level.cell)};
    // Gutter includes AA/strokes at tile boundaries; no visible seams.
    const selected=index.query({left:x-2,top:y-2,right:bounds.right+2,bottom:bounds.bottom+2});
    if(selected.length)result.push({key:level.key+':'+x+':'+y,bounds,features:selected,level});
  }
  levels.set(level,result);return result;
}
export function visibleRasterTiles(features:readonly MapFeature[],bounds:Bounds,level:RasterLevel):RasterTile[]{return rasterTiles(features,level).filter(t=>overlaps(t.bounds,bounds));}
/** A complete LOD transition must fit its cache. Wide viewports near a zoom
 * threshold otherwise evict the first tile before the last tile is prepared. */
export function rasterCoverageForBudget(features:readonly MapFeature[],bounds:Bounds,levels:readonly RasterLevel[],requested:RasterLevel,maxBytes:number,maxEntries=96):{level:RasterLevel;tiles:RasterTile[]} {
  let index=Math.max(0,levels.findIndex(l=>l.key===requested.key));
  while(true){
    const level=levels[index]!,tiles=visibleRasterTiles(features,bounds,level);
    const bytes=tiles.reduce((n,t)=>n+(Math.ceil((t.bounds.right-t.bounds.left)*level.scale)+4)*(Math.ceil((t.bounds.bottom-t.bounds.top)*level.scale)+4)*4,0);
    if(index===0||bytes<=maxBytes&&tiles.length<=maxEntries)return {level,tiles};
    index--;
  }
}
/** LRU bounds retained RGBA bytes. Eviction releases references; images still
 * displayed by Skia remain alive until their display node is replaced. */
export class RasterCache<T>{
  private entries=new Map<string,{value:T;bytes:number;cold?:boolean}>();
  bytes=0;coldBytes=0;
  constructor(public maxBytes=32*1024*1024,public maxEntries=96,readonly maxColdBytes=Math.min(maxBytes,8*1024*1024)){}
  resize(maxBytes:number,maxEntries=this.maxEntries):void{this.maxBytes=maxBytes;this.maxEntries=maxEntries;while(this.bytes>maxBytes||this.entries.size>maxEntries)this.delete(this.entries.keys().next().value!);}
  get(key:string):T|undefined{const item=this.entries.get(key);if(!item)return undefined;if(item.cold){this.coldBytes-=item.bytes;item.cold=false;}this.entries.delete(key);this.entries.set(key,item);return item.value;}
  peek(key:string):T|undefined{return this.entries.get(key)?.value;}
  canFit(bytes:number):boolean{return Number.isSafeInteger(bytes)&&bytes>=0&&this.entries.size<this.maxEntries&&this.bytes+bytes<=this.maxBytes;}
  canFitCold(bytes:number):boolean{return this.canFit(bytes)&&this.coldBytes+bytes<=this.maxColdBytes;}
  /** Idle preparation never displaces visible work. Unused prefetched entries
   * are first to be evicted; a real get promotes them through the normal LRU. */
  setCold(key:string,value:T,bytes:number):boolean{
    if(this.entries.has(key)||!this.canFitCold(bytes))return false;
    this.entries=new Map([[key,{value,bytes,cold:true}],...this.entries]);this.bytes+=bytes;this.coldBytes+=bytes;return true;
  }
  set(key:string,value:T,bytes:number):void{
    const old=this.entries.get(key);if(old){this.bytes-=old.bytes;if(old.cold)this.coldBytes-=old.bytes;}this.entries.delete(key);
    if(bytes>this.maxBytes)return;
    this.entries.set(key,{value,bytes});this.bytes+=bytes;
    while(this.bytes>this.maxBytes||this.entries.size>this.maxEntries){const first=this.entries.keys().next().value!;this.delete(first);}
  }
  delete(key:string):boolean{const old=this.entries.get(key);if(!old)return false;this.entries.delete(key);this.bytes-=old.bytes;if(old.cold)this.coldBytes-=old.bytes;return true;}
  clear():void{this.entries.clear();this.bytes=0;this.coldBytes=0;}
  get size():number{return this.entries.size;}
}
/** Once pixels are retained, the same tile's vector fallback is redundant.
 * Drop only the cache reference: display nodes still own their original
 * picture until their ordinary image commit. Never dispose a live Skia object.
 * Failed/oversized/capacity-rejected rasters retain the recorded fallback. */
export function retainRasterImage<I,P>(images:RasterCache<I>,pictures:RasterCache<P>,key:string,image:I,bytes:number,cold=false):boolean{
  if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>images.maxBytes)return false;
  let retained:boolean;
  if(cold)retained=images.setCold(key,image,bytes);
  else{images.set(key,image,bytes);retained=images.peek(key)===image;}
  if(retained)pictures.delete(key);
  return retained;
}
