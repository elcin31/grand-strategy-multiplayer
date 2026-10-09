import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {Group,Image as MapImage,Picture,Skia,PaintStyle,type SkCanvas,type SkImage,type SkPath,type SkPicture} from '@shopify/react-native-skia';
import {borderChunks,bordersInBounds,type BorderChunk} from '../map/borderChunks';
import {rasterLevel} from '../map/cameraCoverage';
import {visibleRasterTiles,RasterCache,type RasterTile} from '../map/rasterTiles';
import {geometryForLod,type GeometryLod} from '../map/geometryLod';
import {featurePath,overlaps,type Bounds,type MapFeature} from '../map/geometry';
import {GRAPHICS,type GraphicsPreset,type MapMode} from '../map/settings';
import type {MapScene} from '../map/worldScene';
import {lakes,rivers,terrainPatches} from '../map/terrain';
import {recordMetrics,getMetrics} from '../performance/telemetry';

const generations=new WeakMap<object,number>();let generation=0;
function identity(value:object){let id=generations.get(value);if(id===undefined){id=++generation;generations.set(value,id);}return id;}
const borderPaths=new WeakMap<BorderChunk,{inner:SkPath;outer:SkPath}>();
function nativeBorder(chunk:BorderChunk){
  let result=borderPaths.get(chunk);if(result)return result;
  result={inner:Skia.Path.Make(),outer:Skia.Path.Make()};
  for(const kind of ['inner','outer'] as const)for(const edge of chunk[kind])result[kind].moveTo(edge.a.x,edge.a.y).lineTo(edge.b.x,edge.b.y);
  borderPaths.set(chunk,result);return result;
}
const terrainPaths=new Map<string,SkPath>();
function terrainPath(kind:string){
  let path=terrainPaths.get(kind);if(path)return path;path=Skia.Path.Make();
  if(kind==='rivers'){for(const river of rivers)river.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));}
  else for(const patch of terrainPatches.filter(p=>p.type===kind)){
    if(kind==='desert')patch.points.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));
    else for(const p of patch.points){const w=kind==='mountain'?1.8:1;path.moveTo(p.x-w,p.y+1.1).lineTo(p.x,p.y-1.8).lineTo(p.x+w,p.y+1.1).close();}
  }
  terrainPaths.set(kind,path);return path;
}
function paint(color:string,opacity=1,stroke=0){const p=Skia.Paint();p.setAntiAlias(true);p.setColor(Skia.Color(color));p.setAlphaf(opacity);if(stroke){p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(stroke);}return p;}
interface Resources {paths:Map<string,SkPath>;pictures:RasterCache<SkPicture>;images:RasterCache<SkImage>}
interface Drawing {scene:MapScene;features:readonly MapFeature[];owners:ReadonlyMap<string,string>;colors:ReadonlyMap<string,string>;lod:GeometryLod;preset:GraphicsPreset;mode:MapMode;detail:boolean;resources:Resources}
function nativePath(f:MapFeature,d:Drawing){const key=d.lod+':'+f.id;let p=d.resources.paths.get(key);if(!p){const t=performance.now();p=Skia.Path.MakeFromSVGString(featurePath(geometryForLod(f,d.lod)))??Skia.Path.Make();p.setFillType(1);d.resources.paths.set(key,p);recordMetrics({pathBuilds:getMetrics().pathBuilds+1,pathBuildMs:getMetrics().pathBuildMs+performance.now()-t});}return p;}
function drawTile(tile:RasterTile,d:Drawing,canvas:SkCanvas){
  const grouped=new Map<string,SkPath>();
  for(const f of tile.features){const color=f.provinceId?d.colors.get(f.provinceId)??'#37423f':'#354440';let group=grouped.get(color);if(!group){group=Skia.Path.Make();group.setFillType(1);grouped.set(color,group);}group.addPath(nativePath(f,d));}
  for(const [color,path]of grouped)canvas.drawPath(path,paint(color));
  if(GRAPHICS[d.preset].terrain&&(d.mode==='Political'||d.mode==='Terrain')){
    canvas.drawPath(terrainPath('mountain'),paint('#d1cfbc',.32));canvas.drawPath(terrainPath('mountain'),paint('#273b36',.8,.3));
    canvas.drawPath(terrainPath('forest'),paint('#183f32',.5));canvas.drawPath(terrainPath('desert'),paint('#c4b185',.3,6));canvas.drawPath(terrainPath('rivers'),paint('#6594a5',.7,.4));
    for(const lake of lakes)if(overlaps(tile.bounds,{left:lake.point.x-lake.radius,right:lake.point.x+lake.radius,top:lake.point.y-lake.radius,bottom:lake.point.y+lake.radius}))canvas.drawCircle(lake.point.x,lake.point.y,lake.radius,paint('#203c4c'));
  }
  const lineZoom=tile.level.key==='world'?1:tile.level.key==='region'?4:tile.level.key==='local'?8:15;
  const width=GRAPHICS[d.preset].borderWidth/lineZoom;
  for(const chunk of bordersInBounds(borderChunks(d.scene.edges,d.owners),tile.bounds)){
    const paths=nativeBorder(chunk);if(d.detail)canvas.drawPath(paths.inner,paint('#273638',.65,width));
    canvas.drawPath(paths.outer,paint('#101922',1,width*2));
  }
}
function tileKey(tile:RasterTile,d:Drawing){return [identity(d.colors),identity(d.owners),identity(d.features),d.lod,d.preset,d.mode,Number(d.detail),tile.key].join('|');}
function tilePicture(tile:RasterTile,d:Drawing,key:string){
  const cached=d.resources.pictures.get(key);if(cached)return cached;
  const recorder=Skia.PictureRecorder(),b=tile.bounds,gutter=2/tile.level.scale;
  const canvas=recorder.beginRecording(Skia.XYWHRect(b.left-gutter,b.top-gutter,b.right-b.left+gutter*2,b.bottom-b.top+gutter*2));
  drawTile(tile,d,canvas);const picture=recorder.finishRecordingAsPicture();
  d.resources.pictures.set(key,picture,1);return picture;
}
type Work={run:()=>void;cancelled:boolean};const queue:Work[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
function drain(){timer=undefined;const work=queue.shift();if(work&&!work.cancelled)work.run();if(queue.length)timer=setTimeout(drain,8);}
/** At most one bounded surface per slice; touch transforms remain on UI thread. */
function scheduleRaster(run:()=>void){const work={run,cancelled:false};queue.push(work);if(!timer)timer=setTimeout(drain,8);return()=>{work.cancelled=true;const index=queue.indexOf(work);if(index>=0)queue.splice(index,1);};}
const RasterTileNode=memo(function RasterTileNode({tile,drawing}:{tile:RasterTile;drawing:Drawing}){
  const key=tileKey(tile,drawing),picture=useMemo(()=>tilePicture(tile,drawing,key),[tile,drawing,key]);
  const [ready,setReady]=useState<{key:string;image:SkImage}|null>(()=>{const image=drawing.resources.images.get(key);return image?{key,image}:null;});
  useEffect(()=>{
    const cached=drawing.resources.images.get(key);if(cached){setReady({key,image:cached});return;}
    return scheduleRaster(()=>{
      const start=performance.now(),b=tile.bounds,s=tile.level.scale,w=Math.ceil((b.right-b.left)*s)+4,h=Math.ceil((b.bottom-b.top)*s)+4;
      // A JS-thread GPU snapshot belongs to that thread's GrDirectContext.
      // Retain a raster image instead; the Canvas uploads it once in its own
      // render context. Small bounded surfaces also avoid GPU locks on pinch.
      const surface=Skia.Surface.Make(w,h);if(!surface)return;
      const canvas=surface.getCanvas();canvas.clear(Skia.Color('transparent'));canvas.translate(2-b.left*s,2-b.top*s);canvas.scale(s,s);canvas.drawPicture(picture);surface.flush();
      const image=surface.makeImageSnapshot();drawing.resources.images.set(key,image,w*h*4);setReady({key,image});
      recordMetrics({rasterBuilds:getMetrics().rasterBuilds+1,rasterMs:getMetrics().rasterMs+performance.now()-start,rasterBytes:drawing.resources.images.bytes});
      // Snapshot has its own ownership. Only the temporary surface is disposed.
      surface.dispose();
    });
  },[key,tile,drawing,picture]);
  const b=tile.bounds,gutter=2/tile.level.scale;
  return <Group clip={Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top)}>{ready?.key===key?<MapImage fit="fill" image={ready.image} x={b.left-gutter} y={b.top-gutter} width={b.right-b.left+gutter*2} height={b.bottom-b.top+gutter*2}/>:<Picture picture={picture}/>}</Group>;
});
export const MapRasterLayer=memo(function MapRasterLayer({scene,features,owners,colors,lod,preset,mode,detail,bounds,zoom}:{scene:MapScene;features:readonly MapFeature[];owners:ReadonlyMap<string,string>;colors:ReadonlyMap<string,string>;lod:GeometryLod;preset:GraphicsPreset;mode:MapMode;detail:boolean;bounds:Bounds;zoom:number}){
  const resources=useMemo<Resources>(()=>({paths:new Map(),pictures:new RasterCache<SkPicture>(1000,96),images:new RasterCache<SkImage>()}),[scene]);
  useEffect(()=>()=>{resources.paths.clear();resources.pictures.clear();resources.images.clear();},[resources]);
  const drawing=useMemo<Drawing>(()=>({scene,features,owners,colors,lod,preset,mode,detail,resources}),[scene,features,owners,colors,lod,preset,mode,detail,resources]);
  const level=rasterLevel(zoom),context=useMemo(()=>features===scene.features?features:[...scene.features.filter(f=>!f.provinceId),...features],[scene,features]);
  const tiles=visibleRasterTiles(context,bounds,level),previous=useRef(tiles);
  if(previous.current.length!==tiles.length||tiles.some((t,i)=>t!==previous.current[i]))previous.current=tiles;
  useEffect(()=>{recordMetrics({geographyRenders:getMetrics().geographyRenders+1,rasterTiles:previous.current.length});});
  return <Group>{previous.current.map(tile=><RasterTileNode key={tile.key} tile={tile} drawing={drawing}/>)}</Group>;
});
