import {memo,useMemo,useRef} from 'react';
import {Group,Picture,Skia,PaintStyle,type SkPicture} from '@shopify/react-native-skia';
import {borderChunks,bordersInBounds,type BorderChunk} from '../map/borderChunks';
import {smoothDetail} from '../map/atlas22';
import type {Bounds} from '../map/geometry';
import type {MapScene} from '../map/worldScene';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
import {stableBorderZoom} from '../map/borderStyle';
import {recordMetrics,getMetrics} from '../performance/telemetry';
const prepared=new WeakMap<BorderChunk,{outer:ReturnType<typeof Skia.Path.Make>;inner?:ReturnType<typeof Skia.Path.Make>}>();
function borderPaths(chunk:BorderChunk,detail:boolean){
  let paths=prepared.get(chunk);if(!paths){const outer=Skia.Path.Make();for(const e of chunk.outer)outer.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);paths={outer};prepared.set(chunk,paths);}
  if(detail&&!paths.inner){paths.inner=Skia.Path.Make();for(const e of chunk.inner)paths.inner.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);}
  return paths;
}
const pictures=new WeakMap<BorderChunk,Map<string,SkPicture>>();
/** Small, reusable native pictures allow whole offscreen chunks to be culled.
 * Pan never concatenates or records every prepared border again. */
function borderPicture(chunk:BorderChunk,zoom:number,preset:GraphicsPreset):SkPicture{
  let variants=pictures.get(chunk);if(!variants){variants=new Map();pictures.set(chunk,variants);}
  const key=zoom+'|'+preset,cached=variants.get(key);if(cached)return cached;
  const start=performance.now();
  const picture=withNativeRecordingObjects(own=>{
    const b=chunk.bounds,gutter=2/zoom,recorder=own(Skia.PictureRecorder()),c=recorder.beginRecording(Skia.XYWHRect(b.left-gutter,b.top-gutter,b.right-b.left+2*gutter,b.bottom-b.top+2*gutter));
    const paint=own(Skia.Paint());paint.setAntiAlias(true);paint.setStyle(PaintStyle.Stroke);
    const detail=smoothDetail(zoom,preset==='Performance'?4:2.7,7);
    const paths=borderPaths(chunk,detail>0);
    if(detail>0&&paths.inner){paint.setColor(Skia.Color('#232b29'));paint.setAlphaf(.48*detail);paint.setStrokeWidth(.65/zoom);c.drawPath(paths.inner,paint);}
    paint.setAlphaf(.9);paint.setColor(Skia.Color('#131e23'));paint.setStrokeWidth(GRAPHICS[preset].borderWidth*1.65/zoom);c.drawPath(paths.outer,paint);
    paint.setAlphaf(.42);paint.setColor(Skia.Color('#e3c991'));paint.setStrokeWidth(.5/zoom);c.drawPath(paths.outer,paint);
    return recorder.finishRecordingAsPicture();
  });
  // Cache references only; native display nodes can still own older pictures.
  if(variants.size>=3)variants.delete(variants.keys().next().value!);variants.set(key,picture);
  const m=getMetrics();recordMetrics({borderVectorBuilds:m.borderVectorBuilds+1,borderVectorMs:m.borderVectorMs+performance.now()-start});
  return picture;
}
const BorderTile=memo(function BorderTile({chunk,zoom,preset}:{chunk:BorderChunk;zoom:number;preset:GraphicsPreset}){
  const picture=useMemo(()=>borderPicture(chunk,zoom,preset),[chunk,zoom,preset]);
  return <Picture picture={picture}/>;
});
export const MapBorderLayer=memo(function MapBorderLayer({scene,owners,bounds,zoom,preset}:{scene:MapScene;owners:ReadonlyMap<string,string>;bounds:Bounds;zoom:number;preset:GraphicsPreset}){
  const previousZoom=useRef(zoom),styleZoom=preset==='Balanced'||preset==='Performance'?stableBorderZoom(zoom,previousZoom.current):zoom;previousZoom.current=styleZoom;
  const chunks=useMemo(()=>bordersInBounds(borderChunks(scene.edges,owners),bounds),[scene,owners,bounds]);
  // Exact paths keep the accepted appearance. The measured transparent
  // snapshot experiment added a full-area image pass and failed pinch/LOD
  // gates. Reuse native vector pictures without extra RGBA/GPU image caches.
  return <Group>{chunks.map(chunk=><BorderTile key={chunk.key} chunk={chunk} zoom={styleZoom} preset={preset}/>)}</Group>;
});
