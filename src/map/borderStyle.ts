/** Avoid recording new stroke variants for tiny pinch/cull float changes.
 * A four-percent band changes a 1dp stroke by at most .04dp. Geographic
 * detail and authoritative hit geometry retain their existing thresholds. */
export function stableBorderZoom(zoom:number,previous:number):number{
  return zoom>=previous/1.04&&zoom<=previous*1.04?previous:zoom;
}
