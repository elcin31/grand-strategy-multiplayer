import type {Bounds} from './geometry';

/** Small pinch/cull jitter must not replace every prepared border snapshot.
 * The four-percent band changes a 1dp stroke by at most .04dp; hit geometry
 * and geography/political LOD thresholds are independent and stay exact. */
export function stableBorderZoom(zoom:number,previous:number):number{
  return zoom>=previous/1.04&&zoom<=previous*1.04?previous:zoom;
}

/** Supersample the existing stroke at the device's actual density. Never
 * downsample to make a tile fit: reject it and keep exact vector drawing. */
export function borderRasterPlan(bounds:Bounds,zoom:number,pixelRatio:number,maxBytes:number){
  const scale=zoom*pixelRatio*1.5,gutter=2/zoom;
  const width=Math.ceil((bounds.right-bounds.left+2*gutter)*scale),height=Math.ceil((bounds.bottom-bounds.top+2*gutter)*scale),bytes=width*height*4;
  if(!Number.isFinite(scale)||scale<=0||width<1||height<1||width>1024||height>1024||!Number.isSafeInteger(bytes)||bytes>maxBytes)return null;
  return {scale,width,height,bytes,left:bounds.left-gutter,top:bounds.top-gutter};
}
export function borderPriority(bounds:Bounds,coverage:Bounds):number{
  const dx=(bounds.left+bounds.right-coverage.left-coverage.right)/2,dy=(bounds.top+bounds.bottom-coverage.top-coverage.bottom)/2;
  return 1+(dx*dx+dy*dy)/10000;
}
