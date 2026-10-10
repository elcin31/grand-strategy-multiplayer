import type {Camera} from '../map/camera';

/** UI-runtime private data. Pointer bursts replace pending coordinates without
 * dirtying reactive values/coverage mappers for every intermediate event. */
export interface CameraInput extends Camera {pending:boolean;updateZoom:boolean;events:number;commits:number}
export function createCameraInput(camera:Camera):CameraInput {
  return {...camera,pending:false,updateZoom:false,events:0,commits:0};
}
export function queueCameraInput(input:CameraInput,x:number,y:number,zoom:number,updateZoom=true):void {
  'worklet';
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(zoom)||zoom<=0)return;
  input.x=x;input.y=y;input.zoom=zoom;input.updateZoom=updateZoom;input.pending=true;input.events++;
}
/** Called on a scheduled camera frame, or before gesture handoff/inertia.
 * Final pointer position is retained even if no display frame ran meanwhile. */
export function takeCameraInput(input:CameraInput):(Camera&{updateZoom:boolean})|null {
  'worklet';
  if(!input.pending)return null;
  input.pending=false;input.commits++;
  return {x:input.x,y:input.y,zoom:input.zoom,updateZoom:input.updateZoom};
}
