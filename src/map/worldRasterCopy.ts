import {WORLD_WIDTH,WORLD_HEIGHT,type Bounds} from './geometry';
import type {RasterTile} from './rasterTiles';

/** Copy accepted160-cell raster pixels without repainting coast AA at a new
 * surface clip. All coordinates are exact integer pixels at world scale2.
 * Internal tile gutters are excluded; exterior world gutters are preserved.
 * Nearest + Src copies premultiplied RGBA once, including transparent pixels. */
export function worldRasterCopy(source:Pick<RasterTile,'bounds'|'level'>,target:Pick<RasterTile,'bounds'|'level'>){
  const a=source.bounds,b=target.bounds,s=target.level.scale,gutter=2/s;
  if(source.level.key!=='world'||target.level.key!=='world'||source.level.scale!==s)throw new Error('World raster copy requires the same pixel scale');
  const rect=(bounds:Bounds)=>({x:2+(bounds.left-b.left)*s,y:2+(bounds.top-b.top)*s,width:(bounds.right-bounds.left)*s,height:(bounds.bottom-bounds.top)*s});
  const destination=rect({left:a.left-gutter,top:a.top-gutter,right:a.right+gutter,bottom:a.bottom+gutter});
  const clip=rect({left:a.left-(a.left===0?gutter:0),top:a.top-(a.top===0?gutter:0),right:a.right+(a.right===WORLD_WIDTH?gutter:0),bottom:a.bottom+(a.bottom===WORLD_HEIGHT?gutter:0)});
  return {destination,clip};
}
