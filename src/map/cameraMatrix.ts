import {TILT} from './camera';

export type CameraMatrix=[number,number,number,number,number,number,number,number,number];

/** The existing center/scale/translate camera, composed directly in row-major
 * Skia form. Avoid six temporary transform objects and six4x4 multiplications
 * on every UI-runtime camera update. No native matrix allocation is needed. */
export function cameraMatrix(x:number,y:number,zoom:number,width:number,height:number):CameraMatrix {
  'worklet';
  const vertical=zoom*TILT;
  return [zoom,0,width/2-x*zoom,0,vertical,height/2-y*vertical,0,0,1];
}
