import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {Group,Picture,Skia,PaintStyle,FilterMode,MipmapMode,ClipOp,BlendMode,type SkCanvas,type SkImage,type SkPath,type SkPicture} from '@shopify/react-native-skia';
import {rasterLevel,WORLD_RASTER_SOURCE_LEVEL} from '../map/cameraCoverage';
import {visibleRasterTiles,rasterTiles,RasterCache,retainRasterImage,type RasterTile} from '../map/rasterTiles';
import {scheduleIdleSlices} from '../performance/idleSlices';
import {geometryForLod,type GeometryLod} from '../map/geometryLod';
import {featurePath,type Bounds,type MapFeature} from '../map/geometry';
import {type GraphicsPreset,type MapMode} from '../map/settings';
import type {MapScene} from '../map/worldScene';
import {recordMetrics,getMetrics} from '../performance/telemetry';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {RecordingPathCache} from '../map/recordingPathCache';
import {rasterImageDraw} from '../map/rasterImageDraw';
import {worldRasterCopy} from '../map/worldRasterCopy';

const generations=new WeakMap<object,number>();let generation=0;
function identity(value:object){let id=generations.get(value);if(id===undefined){id=++generation;generations.set(value,id);}return id;}
interface Resources {paths:RecordingPathCache<SkPath>;pictures:RasterCache<SkPicture>;images:RasterCache<SkImage>}
interface Drawing {scene:MapScene;features:readonly MapFeature[];context:readonly MapFeature[];owners:ReadonlyMap<string,string>;colors:ReadonlyMap<string,string>;lod:GeometryLod;preset:GraphicsPreset;mode:MapMode;detail:boolean;resources:Resources}
function appendNativePath(f:MapFeature,d:Drawing,group:SkPath){
  d.resources.paths.withPath(d.lod+':'+f.id,()=>{
    const t=performance.now(),p=Skia.Path.MakeFromSVGString(featurePath(geometryForLod(f,d.lod)))??Skia.Path.Make();p.setFillType(1);
    recordMetrics({pathBuilds:getMetrics().pathBuilds+1,pathBuildMs:getMetrics().pathBuildMs+performance.now()-t});return p;
  },path=>{group.addPath(path);});
}
function drawTile(tile:RasterTile,d:Drawing,canvas:SkCanvas){
  withNativeRecordingObjects(own=>{
    const paints=new Map<string,ReturnType<typeof Skia.Paint>>();
    const paint=(color:string,opacity=1,stroke=0)=>{
      const key=color+'|'+opacity+'|'+stroke;let p=paints.get(key);if(p)return p;
      p=own(Skia.Paint());p.setAntiAlias(true);p.setColor(Skia.Color(color));p.setAlphaf(opacity);if(stroke){p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(stroke);}paints.set(key,p);return p;
    };
    const grouped=new Map<string,SkPath>();
    for(const f of tile.features){const color=f.provinceId?d.colors.get(f.provinceId)??'#adab88':'#c6c0a4';let group=grouped.get(color);if(!group){group=own(Skia.Path.Make());group.setFillType(1);grouped.set(color,group);}appendNativePath(f,d,group);}
    for(const [color,path]of grouped)canvas.drawPath(path,paint(color));

  });
}
function tileKey(tile:RasterTile,d:Drawing){return [identity(d.colors),identity(d.owners),identity(d.features),d.lod,d.preset,d.mode,Number(d.detail),tile.key].join('|');}
function tilePicture(tile:RasterTile,d:Drawing,key:string){
  const cached=d.resources.pictures.get(key);if(cached)return cached;
  return withNativeRecordingObjects(own=>{
    const recorder=own(Skia.PictureRecorder()),b=tile.bounds,gutter=2/tile.level.scale;
    const canvas=recorder.beginRecording(Skia.XYWHRect(b.left-gutter,b.top-gutter,b.right-b.left+gutter*2,b.bottom-b.top+gutter*2));
    drawTile(tile,d,canvas);const picture=recorder.finishRecordingAsPicture();
    d.resources.pictures.set(key,picture,1);return picture;
  });
}
function tileImage(tile:RasterTile,drawing:Drawing,key:string,picture:SkPicture,cold=false):SkImage|undefined{
  const b=tile.bounds,s=tile.level.scale,w=Math.ceil((b.right-b.left)*s)+4,h=Math.ceil((b.bottom-b.top)*s)+4,bytes=w*h*4;
  if(cold&&!drawing.resources.images.canFitCold(bytes))return;
  const start=performance.now(),surface=Skia.Surface.Make(w,h);if(!surface)return;
  try{
    const canvas=surface.getCanvas();canvas.clear(Skia.Color('transparent'));
    if(tile.level.key==='world'&&tile.level.cell>WORLD_RASTER_SOURCE_LEVEL.cell){
      // A larger surface changes Skia's clipping/AA of acute coast vertices.
      // Copy original small-surface pixels rather than repainting those paths.
      // Source snapshots are exclusively owned, never cached or displayed.
      const completed=withNativeRecordingObjects(own=>{
        const paint=own(Skia.Paint());paint.setBlendMode(BlendMode.Src);
        const sources=visibleRasterTiles(drawing.context,{left:b.left-1,top:b.top-1,right:b.right+1,bottom:b.bottom+1},WORLD_RASTER_SOURCE_LEVEL);
        for(const sourceTile of sources){
          const a=sourceTile.bounds,k=sourceTile.level.scale,sw=Math.ceil((a.right-a.left)*k)+4,sh=Math.ceil((a.bottom-a.top)*k)+4;
          const sourceSurface=Skia.Surface.Make(sw,sh);if(!sourceSurface)return false;
          try{
            const sourceCanvas=sourceSurface.getCanvas();sourceCanvas.clear(Skia.Color('transparent'));sourceCanvas.translate(2-a.left*k,2-a.top*k);sourceCanvas.scale(k,k);drawTile(sourceTile,drawing,sourceCanvas);sourceSurface.flush();
            const sourceImage=sourceSurface.makeImageSnapshot();
            try{
              const plan=worldRasterCopy(sourceTile,tile),c=plan.clip,d=plan.destination;
              canvas.save();canvas.clipRect(Skia.XYWHRect(c.x,c.y,c.width,c.height),ClipOp.Intersect,false);
              canvas.drawImageRectOptions(sourceImage,Skia.XYWHRect(0,0,sw,sh),Skia.XYWHRect(d.x,d.y,d.width,d.height),FilterMode.Nearest,MipmapMode.None,paint);canvas.restore();
              // Both surfaces are immediate CPU rasters. Flush the copied
              // pixels before releasing this unpublished owned source image.
              surface.flush();
            }finally{sourceImage.dispose();}
          }finally{sourceSurface.dispose();}
        }
        return true;
      });
      if(!completed)return; // Preserve the real vector fallback on allocation failure.
    }else{canvas.translate(2-b.left*s,2-b.top*s);canvas.scale(s,s);canvas.drawPicture(picture);}
    surface.flush();
    const image=surface.makeImageSnapshot();
    retainRasterImage(drawing.resources.images,drawing.resources.pictures,key,image,bytes,cold);
    const elapsed=performance.now()-start,m=getMetrics();
    recordMetrics({rasterBuilds:m.rasterBuilds+1,rasterMs:m.rasterMs+elapsed,rasterBytes:drawing.resources.images.bytes,...(cold?{rasterPrewarmBuilds:m.rasterPrewarmBuilds+1,rasterPrewarmMs:m.rasterPrewarmMs+elapsed}:{})});
    return image;
  }finally{surface.dispose();}
}
type Work={run:()=>void;cancelled:boolean};const queue:Work[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
function drain(){timer=undefined;const work=queue.shift();if(work&&!work.cancelled)work.run();if(queue.length)timer=setTimeout(drain,8);}
/** At most one bounded surface per slice; touch transforms remain on UI thread. */
function scheduleRaster(run:()=>void){const work={run,cancelled:false};queue.push(work);if(!timer)timer=setTimeout(drain,8);return()=>{work.cancelled=true;const index=queue.indexOf(work);if(index>=0)queue.splice(index,1);};}
const RasterTileNode=memo(function RasterTileNode({tile,drawing}:{tile:RasterTile;drawing:Drawing}){
  const key=tileKey(tile,drawing);
  const [ready,setReady]=useState<{key:string;image:SkImage}|null>(()=>{const image=drawing.resources.images.get(key);return image?{key,image}:null;});
  const cached=ready?.key===key?ready.image:drawing.resources.images.get(key);
  // A ready image does not need a new vector recording, even if its old
  // picture was evicted. Keep geometry preparation out of warm camera visits.
  const hasImage=!!cached;
  const picture=useMemo(()=>hasImage?null:tilePicture(tile,drawing,key),[tile,drawing,key,hasImage]);
  useEffect(()=>{
    if(cached){setReady(previous=>previous?.key===key&&previous.image===cached?previous:{key,image:cached});return;}
    return scheduleRaster(()=>{
      // A JS-thread GPU snapshot belongs to that thread's GrDirectContext.
      // Retain a raster image instead; the Canvas uploads it once in its own
      // render context. Small bounded surfaces also avoid GPU locks on pinch.
      const image=drawing.resources.images.get(key)??tileImage(tile,drawing,key,picture!);if(image)setReady({key,image});
    });
  },[key,tile,drawing,picture,cached]);
  // The UI camera only replays this immutable native picture. Keep Image fit,
  // paint and clip command preparation off its animated parent recorder.
  const display=useMemo(()=>withNativeRecordingObjects(own=>{
    const b=tile.bounds,gutter=2/tile.level.scale,recorder=own(Skia.PictureRecorder());
    const canvas=recorder.beginRecording(Skia.XYWHRect(b.left-gutter,b.top-gutter,b.right-b.left+gutter*2,b.bottom-b.top+gutter*2));
    canvas.clipRect(Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top),ClipOp.Intersect,false);
    if(cached){
      const rectangles=rasterImageDraw(tile,cached.width(),cached.height());
      const {source:s,destination:d}=rectangles;
      canvas.drawImageRectOptions(cached,Skia.XYWHRect(s.x,s.y,s.width,s.height),Skia.XYWHRect(d.x,d.y,d.width,d.height),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));
    }else canvas.drawPicture(picture!);
    return recorder.finishRecordingAsPicture();
  }),[tile,cached,picture]);
  return <Picture picture={display}/>;
});
export const MapRasterLayer=memo(function MapRasterLayer({scene,features,owners,colors,lod,preset,mode,detail,bounds,zoom,canPrewarm}:{scene:MapScene;features:readonly MapFeature[];owners:ReadonlyMap<string,string>;colors:ReadonlyMap<string,string>;lod:GeometryLod;preset:GraphicsPreset;mode:MapMode;detail:boolean;bounds:Bounds;zoom:number;canPrewarm:()=>boolean}){
  const resources=useMemo<Resources>(()=>({paths:new RecordingPathCache<SkPath>(),pictures:new RasterCache<SkPicture>(1000,96),images:new RasterCache<SkImage>()}),[scene]);
  useEffect(()=>()=>{resources.paths.clear();resources.pictures.clear();resources.images.clear();},[resources]);
  const context=useMemo(()=>features===scene.features?features:[...scene.features.filter(f=>!f.provinceId),...features],[scene,features]);
  const drawing=useMemo<Drawing>(()=>({scene,features,context,owners,colors,lod,preset,mode,detail,resources}),[scene,features,context,owners,colors,lod,preset,mode,detail,resources]);
  const level=rasterLevel(zoom);
  useEffect(()=>{
    if(mode!=='Political'||detail||lod!=='low')return;
    let world:RasterTile[]|undefined,index=0;
    return scheduleIdleSlices(()=>queue.length===0&&canPrewarm(),()=>{
      world??=rasterTiles(context,rasterLevel(.5));
      while(index<world.length){
        const tile=world[index++]!,key=tileKey(tile,drawing);
        if(resources.images.peek(key))continue;
        const b=tile.bounds,s=tile.level.scale,bytes=(Math.ceil((b.right-b.left)*s)+4)*(Math.ceil((b.bottom-b.top)*s)+4)*4;
        if(!resources.images.canFitCold(bytes))return false;
        const image=tileImage(tile,drawing,key,tilePicture(tile,drawing,key),true);
        return !!image&&index<world.length;
      }
      return false;
    });
  },[drawing,context,canPrewarm,mode,detail,lod,resources]);
  const tiles=visibleRasterTiles(context,bounds,level),previous=useRef(tiles);
  if(previous.current.length!==tiles.length||tiles.some((t,i)=>t!==previous.current[i]))previous.current=tiles;
  useEffect(()=>{recordMetrics({geographyRenders:getMetrics().geographyRenders+1,rasterTiles:previous.current.length});});
  return <Group>{previous.current.map(tile=><RasterTileNode key={tile.key} tile={tile} drawing={drawing}/>)}</Group>;
});
