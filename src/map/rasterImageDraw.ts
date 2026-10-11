import type {RasterTile} from './rasterTiles';

/** The accepted full-image fill and two-pixel gutter, prepared once per tile.
 * The strict source rect and linear/no-mipmap sampling match Skia's Image node.
 * Record this together with the tile clip rather than refitting on each frame. */
export function rasterImageDraw(tile:Pick<RasterTile,'bounds'|'level'>,width:number,height:number){
  const b=tile.bounds,gutter=2/tile.level.scale;
  return {
    source:{x:0,y:0,width,height},
    destination:{x:b.left-gutter,y:b.top-gutter,width:b.right-b.left+gutter*2,height:b.bottom-b.top+gutter*2},
    clip:{x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top},
  };
}
