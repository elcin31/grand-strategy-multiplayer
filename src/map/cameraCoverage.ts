import type {Camera,Viewport} from './camera';
import {TILT,visibleBounds} from './camera';
import {WORLD_WIDTH,WORLD_HEIGHT,type Bounds} from './geometry';
export const CAMERA_OVERSCAN=288;
/** UI-thread containment test. Only escaping prepared coverage crosses to JS.
 * Clip ocean overscan to the world: a fully visible world needs no pan recull. */
export function cameraNeedsCoverage(camera:Camera,prepared:Camera,viewport:Viewport):boolean {
  'worklet';
  if(Math.abs(Math.log(camera.zoom/prepared.zoom))>Math.log(1.32))return true;
  const hx=(viewport.width/2+24)/camera.zoom,hy=(viewport.height/2+24)/(camera.zoom*TILT);
  const px=(viewport.width/2+CAMERA_OVERSCAN)/prepared.zoom,py=(viewport.height/2+CAMERA_OVERSCAN)/(prepared.zoom*TILT);
  return Math.max(0,camera.x-hx)<Math.max(0,prepared.x-px)||Math.min(WORLD_WIDTH,camera.x+hx)>Math.min(WORLD_WIDTH,prepared.x+px)||Math.max(0,camera.y-hy)<Math.max(0,prepared.y-py)||Math.min(WORLD_HEIGHT,camera.y+hy)>Math.min(WORLD_HEIGHT,prepared.y+py);
}
export function cameraCoverage(camera:Camera,viewport:Viewport):Bounds{return visibleBounds(camera,viewport,CAMERA_OVERSCAN);}
/** Stable camera zoom bands bound raster resolution and texture sizes. */
export const RASTER_LEVELS=[
  {key:'world',cell:160,scale:2},
  {key:'region',cell:96,scale:4},
  {key:'local',cell:64,scale:8},
  {key:'detail',cell:48,scale:12},
] as const;
export type RasterLevel=typeof RASTER_LEVELS[number];
export function rasterLevel(zoom:number):RasterLevel{return RASTER_LEVELS[zoom<2?0:zoom<6?1:zoom<12?2:3]!;}
