import type {Camera,Viewport} from './camera';
import {TILT,visibleBounds} from './camera';
import {WORLD_WIDTH,WORLD_HEIGHT,type Bounds} from './geometry';
export const CAMERA_OVERSCAN=288;
/** Native events are pooled. Capture primitives before React defers the updater. */
export function viewportLayoutUpdate(event:{nativeEvent:{layout:Viewport}}){
  const {width,height}=event.nativeEvent.layout;
  return (previous:Viewport)=>previous.width===width&&previous.height===height?previous:{width,height};
}
/** During a gesture keep prepared detail while zooming in. Downgrade on zoom
 * out to bound the number of fine tiles; refine only once the camera settles. */
export function interactionDetailZoom(prepared:number,current:number,settled:boolean):number{return settled?current:Math.min(prepared,current);}
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
  // Fifteen world replay images replace45 at the same2px/unit resolution.
  // Including gutters the580px side cap remains identical to detail tiles.
  {key:'world',cell:288,scale:2},
  {key:'region',cell:96,scale:4},
  {key:'local',cell:64,scale:8},
  {key:'detail',cell:48,scale:12},
] as const;
/** Source-only grid preserves the accepted CPU coast rasterization; it is not
 * a selectable camera band. Bounded chunks copy these pixels before UI replay. */
export const WORLD_RASTER_SOURCE_LEVEL={key:'world',cell:160,scale:2} as const;
export interface RasterLevel {readonly key:'world'|'region'|'local'|'detail';readonly cell:number;readonly scale:number}
const WORLD_SOURCES=new Map<number,RasterLevel>([[2,WORLD_RASTER_SOURCE_LEVEL],[1,{...WORLD_RASTER_SOURCE_LEVEL,scale:1}],[1.5,{...WORLD_RASTER_SOURCE_LEVEL,scale:1.5}]]);
/** Source and destination must use the same pixel grid, including reduced
 * mobile world tints. Reuse the original small-cell coast clipping contract. */
export function worldRasterSourceLevel(level:RasterLevel):RasterLevel{return WORLD_SOURCES.get(level.scale)??WORLD_RASTER_SOURCE_LEVEL;}
export function rasterLevel(zoom:number):RasterLevel{return RASTER_LEVELS[zoom<2?0:zoom<6?1:zoom<12?2:3]!;}
export function stableRasterLevel(zoom:number,previous:RasterLevel):RasterLevel {
  const index=RASTER_LEVELS.findIndex(l=>l===previous),thresholds=[2,6,12];
  if(index>=0&&zoom>=(index===0?0:thresholds[index-1]!*.88)&&zoom<(index===3?Infinity:thresholds[index]! *1.12))return previous;
  return rasterLevel(zoom);
}
const MOBILE_RASTER_LEVELS={
  Performance:RASTER_LEVELS.map(l=>({...l,scale:l.key==='world'?1:l.scale/2})),
  Balanced:RASTER_LEVELS.map(l=>({...l,scale:l.key==='world'?1.5:l.scale/2})),
};
/** Flat political tint needs fewer pixels than detailed geographic textures.
 * Keep full shared-edge hit geometry and all High/Ultra atlas resolutions. */
export function budgetRasterLevel(level:RasterLevel,preset:string):RasterLevel {
  const levels=preset==='Balanced'?MOBILE_RASTER_LEVELS.Balanced:preset==='Performance'?MOBILE_RASTER_LEVELS.Performance:undefined;
  return levels?.find(l=>l.key===level.key)??level;
}
