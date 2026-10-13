import {memo,useEffect,useMemo,useState} from 'react';
import {PixelRatio} from 'react-native';
import {Group,Picture,Skia,PaintStyle,FilterMode,MipmapMode,type SkImage,type SkPicture} from '@shopify/react-native-skia';
import {borderChunks,bordersInBounds,type BorderChunk} from '../map/borderChunks';
import {smoothDetail} from '../map/atlas22';
import type {Bounds} from '../map/geometry';
import type {MapScene} from '../map/worldScene';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
import {RasterCache} from '../map/rasterTiles';
import {borderRasterBudget} from '../map/mobileBudgets';
import {borderPriority,borderRasterPlan} from '../map/borderRaster';
import {mapWorkQueue} from '../performance/mapWorkQueue';
const prepared=new WeakMap<BorderChunk,{outer:ReturnType<typeof Skia.Path.Make>;inner?:ReturnType<typeof Skia.Path.Make>}>();
function borderPaths(chunk:BorderChunk,detail:boolean){
  let paths=prepared.get(chunk);if(!paths){const outer=Skia.Path.Make();for(const e of chunk.outer)outer.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);paths={outer};prepared.set(chunk,paths);}
  if(detail&&!paths.inner){paths.inner=Skia.Path.Make();for(const e of chunk.inner)paths.inner.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);}
  return paths;
}
interface BorderResources {images:RasterCache<SkImage>;canPrepare:()=>boolean}
const chunkIds=new WeakMap<BorderChunk,number>();let nextChunkId=0;
function chunkKey(chunk:BorderChunk,zoom:number,preset:GraphicsPreset){let id=chunkIds.get(chunk);if(id===undefined){id=++nextChunkId;chunkIds.set(chunk,id);}return id+'|'+zoom+'|'+preset;}
const pictures=new WeakMap<BorderChunk,Map<string,SkPicture>>();
/** Small, reusable native pictures allow whole offscreen chunks to be culled.
 * Pan never concatenates or records every prepared border again. */
function borderPicture(chunk:BorderChunk,zoom:number,preset:GraphicsPreset):SkPicture{
  let variants=pictures.get(chunk);if(!variants){variants=new Map();pictures.set(chunk,variants);}
  const key=zoom+'|'+preset,cached=variants.get(key);if(cached)return cached;
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
  if(variants.size>=3)variants.delete(variants.keys().next().value!);variants.set(key,picture);return picture;
}
const BorderTile=memo(function BorderTile({chunk,zoom,preset,resources,priority}:{chunk:BorderChunk;zoom:number;preset:GraphicsPreset;resources:BorderResources;priority:number}){
  const key=chunkKey(chunk,zoom,preset),vector=useMemo(()=>borderPicture(chunk,zoom,preset),[chunk,zoom,preset]);
  const [,refresh]=useState(0);
  const plan=useMemo(()=>borderRasterPlan(chunk.bounds,zoom,PixelRatio.get(),resources.images.maxBytes),[chunk,zoom,resources]);
  // Coverage/priority changes cancel queued work, without releasing a ready
  // image for the same mounted chunk. Only content/lifetime changes retire it.
  useEffect(()=>()=>{resources.images.delete(key);},[key,resources]);
  useEffect(()=>{
    if(!plan||resources.images.peek(key))return;
    const cancel=mapWorkQueue.schedule(()=>{
      // All retained entries belong to mounted chunks. Do not evict them or
      // keep an uncached image in React state outside the byte accounting.
      if(!resources.images.canFit(plan.bytes))return;
      const surface=Skia.Surface.Make(plan.width,plan.height);if(!surface)return;
      try{
        const c=surface.getCanvas();c.clear(Skia.Color('transparent'));c.scale(plan.scale,plan.scale);c.translate(-plan.left,-plan.top);c.drawPicture(vector);surface.flush();
        const image=surface.makeImageSnapshot();resources.images.set(key,image,plan.bytes);refresh(n=>n+1);
      }finally{surface.dispose();}
    },resources.canPrepare,priority);
    return cancel;
  },[key,vector,plan,resources,priority]);
  const image=resources.images.peek(key);
  const display=useMemo(()=>!image||!plan?vector:withNativeRecordingObjects(own=>{
    const r=own(Skia.PictureRecorder()),c=r.beginRecording(Skia.XYWHRect(plan.left,plan.top,plan.width/plan.scale,plan.height/plan.scale));
    c.drawImageRectOptions(image,Skia.XYWHRect(0,0,plan.width,plan.height),Skia.XYWHRect(plan.left,plan.top,plan.width/plan.scale,plan.height/plan.scale),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));
    return r.finishRecordingAsPicture();
  }),[image,plan,vector]);
  return <Picture picture={display}/>;
});
export const MapBorderLayer=memo(function MapBorderLayer({scene,owners,bounds,zoom,preset,canPrepare}:{scene:MapScene;owners:ReadonlyMap<string,string>;bounds:Bounds;zoom:number;preset:GraphicsPreset;canPrepare:()=>boolean}){
  const resources=useMemo<BorderResources>(()=>({images:new RasterCache<SkImage>(borderRasterBudget(preset),160),canPrepare}),[scene,preset,canPrepare]);
  useEffect(()=>()=>resources.images.clear(),[resources]);
  const chunks=useMemo(()=>bordersInBounds(borderChunks(scene.edges,owners),bounds),[scene,owners,bounds]);
  return <Group>{chunks.map(chunk=><BorderTile key={chunk.key} chunk={chunk} zoom={zoom} preset={preset} resources={resources} priority={borderPriority(chunk.bounds,bounds)}/>)}</Group>;
});
