import {memo,useEffect,useMemo,useState} from 'react';
import {Group,Picture,Skia,ClipOp,FilterMode,MipmapMode,PaintStyle,type SkImage,type SkPath} from '@shopify/react-native-skia';
import {Image as NativeImage} from 'react-native';
import {atlasTiles} from '../map/atlas22Assets';
import {atlasLevel,atlasSurface,type AtlasTile} from '../map/atlas22';
import {featurePath,overlaps,type Bounds} from '../map/geometry';
import {countryRenderFeatures} from '../map/countryRender';
import {worldCountries} from '../world/catalog';
import {RasterCache} from '../map/rasterTiles';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import type {MapScene} from '../map/worldScene';
import type {GraphicsPreset,MapMode} from '../map/settings';
import {scheduleRaster} from './MapRasterLayer';
interface Vector {id:string;rank:number;type:string;coordinates:number[][]|number[][][]|number[][][][];bounds:Bounds}
const geography=require('../map/geography22.json') as {rivers:Vector[];lakes:Vector[]};
const masks=new WeakMap<MapScene,Map<string,SkPath>>();
const vectorPaths=new Map<string,SkPath>();
const modernCountries=new Set(worldCountries.map(c=>c.sourceCode));
function vectorPath(v:Vector):SkPath {
  let cached=vectorPaths.get(v.id);if(cached)return cached;
  const p=Skia.Path.Make();p.setFillType(1);
  const line=(coords:number[][],close=false)=>{coords.forEach((c,i)=>i?p.lineTo(c[0]!,c[1]!):p.moveTo(c[0]!,c[1]!));if(close)p.close();};
  if(v.type==='LineString')line(v.coordinates as number[][]);
  else if(v.type==='MultiLineString')(v.coordinates as number[][][]).forEach(c=>line(c));
  else if(v.type==='Polygon')(v.coordinates as number[][][]).forEach(c=>line(c,true));
  else if(v.type==='MultiPolygon')(v.coordinates as number[][][][]).forEach(c=>c.forEach(r=>line(r,true)));
  vectorPaths.set(v.id,p);return p;
}
function landMask(scene:MapScene,tile:AtlasTile):SkPath {
  let cache=masks.get(scene);if(!cache){cache=new Map();masks.set(scene,cache);}
  const cached=cache.get(tile.key);if(cached)return cached;
  const modern=scene.provinceGeometry.size>1000;
  const merged=tile.level==='world'?countryRenderFeatures(scene):[];
  // The legacy background catalogue duplicates 169 countries now represented
  // by real world provinces. An even-odd compound mask would erase those lands.
  // Retain only background regions absent from the modern roster (e.g. Antarctica).
  const context=scene.features.filter(f=>!f.provinceId&&!modernCountries.has(f.id));
  const features=merged.length?[...context,...merged]:scene.spatialIndex.query(tile.imageBounds).filter(f=>!modern||f.provinceId||!modernCountries.has(f.id));
  const p=Skia.Path.Make();p.setFillType(1);
  for(const f of features)if(overlaps(f.bounds,tile.imageBounds)){
    const path=Skia.Path.MakeFromSVGString(featurePath(f));if(path){p.addPath(path);path.dispose();}
  }
  // Immutable native masks only, independent of ownership/day/selection.
  cache.set(tile.key,p);return p;
}
interface AtlasResources {images:RasterCache<SkImage>;pending:Map<number,Promise<SkImage|null>>}
function loadAtlas(source:number,resources:AtlasResources){
  const cached=resources.images.get(String(source));if(cached)return Promise.resolve(cached);
  const pending=resources.pending.get(source);if(pending)return pending;
  const promise=Skia.Data.fromURI(NativeImage.resolveAssetSource(source).uri).then(data=>Skia.Image.MakeImageFromEncoded(data)).then(image=>{
    if(image)resources.images.set(String(source),image,image.width()*image.height()*4);
    return image;
  }).catch(()=>null).finally(()=>resources.pending.delete(source));
  resources.pending.set(source,promise);return promise;
}
function useAtlas(source:number|null,resources:AtlasResources){
  const [ready,setReady]=useState<{source:number;image:SkImage}|null>(()=>{if(source===null)return null;const image=resources.images.get(String(source));return image?{source,image}:null;});
  useEffect(()=>{if(source===null){setReady(null);return;}let alive=true;void loadAtlas(source,resources).then(image=>{if(alive&&image)setReady({source,image});});return()=>{alive=false;};},[source,resources]);
  return ready?.source===source?ready.image:resources.images.get(String(source))??null;
}
const GeographyTile=memo(function GeographyTile({scene,tile,surface,resources,preset}:{scene:MapScene;tile:AtlasTile;surface:'terrain'|'relief';resources:AtlasResources;preset:GraphicsPreset}){
  const key='geography|'+tile.key+'|'+surface+'|'+preset;
  const [ready,setReady]=useState<{key:string;image:SkImage}|null>(()=>{const image=resources.images.get(key);return image?{key,image}:null;});
  const composed=ready?.key===key?ready.image:resources.images.get(key);
  const image=useAtlas(composed?null:tile[surface],resources);
  const picture=useMemo(()=>withNativeRecordingObjects(own=>{
    const b=tile.bounds,i=tile.imageBounds,recorder=own(Skia.PictureRecorder()),c=recorder.beginRecording(Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top));
    c.clipRect(Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top),ClipOp.Intersect,false);
    if(composed){c.drawImageRectOptions(composed,Skia.XYWHRect(0,0,composed.width(),composed.height()),Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));return recorder.finishRecordingAsPicture();}
    const mask=landMask(scene,tile),paint=own(Skia.Paint());paint.setAntiAlias(true);
    // A narrow coastal shelf follows authoritative geometry at every scale.
    paint.setColor(Skia.Color('#31596a'));paint.setStyle(PaintStyle.Stroke);paint.setStrokeWidth(tile.level==='world'?1.2:.65);c.drawPath(mask,paint);
    c.save();c.clipPath(mask,ClipOp.Intersect,true);paint.setStyle(PaintStyle.Fill);paint.setColor(Skia.Color(surface==='terrain'?'#9d9d6c':'#ded5b5'));c.drawPath(mask,paint);
    if(image)c.drawImageRectOptions(image,Skia.XYWHRect(0,0,image.width(),image.height()),Skia.XYWHRect(i.left,i.top,i.right-i.left,i.bottom-i.top),FilterMode.Linear,MipmapMode.None,paint);
    const rank=tile.level==='world'?2:tile.level==='region'?5:10;
    if(preset!=='Performance'){
      paint.setColor(Skia.Color('#17455c'));
      for(const lake of geography.lakes)if(lake.rank<=rank&&overlaps(lake.bounds,b))c.drawPath(vectorPath(lake),paint);
      const zoom=tile.level==='world'?1:tile.level==='region'?4:12;
      paint.setStyle(PaintStyle.Stroke);paint.setStrokeWidth(.85/zoom);paint.setColor(Skia.Color(surface==='terrain'?'#3d94b4':'#47788b'));
      for(const river of geography.rivers)if(river.rank<=rank&&overlaps(river.bounds,b))c.drawPath(vectorPath(river),paint);
    }
    c.restore();return recorder.finishRecordingAsPicture();
  }),[scene,tile,image,surface,preset,composed]);
  useEffect(()=>{
    if(composed||!image)return;
    return scheduleRaster(()=>{
      const b=tile.bounds,scale=tile.level==='world'?1:tile.level==='region'?3:6,w=Math.ceil((b.right-b.left)*scale),h=Math.ceil((b.bottom-b.top)*scale);
      const raster=Skia.Surface.Make(w,h);if(!raster)return;
      try{const c=raster.getCanvas();c.clear(Skia.Color('transparent'));c.translate(-b.left*scale,-b.top*scale);c.scale(scale,scale);c.drawPicture(picture);raster.flush();const atlas=raster.makeImageSnapshot();resources.images.delete(String(tile[surface]));resources.images.set(key,atlas,w*h*4);setReady({key,image:atlas});}finally{raster.dispose();}
    });
  },[composed,image,picture,tile,surface,key,resources]);
  return <Picture picture={picture}/>;
});
const Ocean=memo(function Ocean({resources}:{resources:AtlasResources}){
  const image=useAtlas(require('../../assets/map/dominion-2.2/water/ocean.webp'),resources);
  const picture=useMemo(()=>{if(!image)return null;return withNativeRecordingObjects(own=>{const r=own(Skia.PictureRecorder()),c=r.beginRecording(Skia.XYWHRect(0,0,1440,720));c.drawImageRectOptions(image,Skia.XYWHRect(0,0,image.width(),image.height()),Skia.XYWHRect(0,0,1440,720),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));return r.finishRecordingAsPicture();});},[image]);
  return picture?<Picture picture={picture}/>:null;
});
export const MapGeographyLayer=memo(function MapGeographyLayer({scene,bounds,zoom,preset,mode}:{scene:MapScene;bounds:Bounds;zoom:number;preset:GraphicsPreset;mode:MapMode}){
  const resources=useMemo<AtlasResources>(()=>({images:new RasterCache<SkImage>(32*1024*1024,20),pending:new Map()}),[scene]);
  useEffect(()=>()=>{resources.images.clear();},[resources]);
  const requested=atlasLevel(zoom,preset),surface=atlasSurface(mode);
  const tiles=useMemo(()=>{let level=requested,tiles=atlasTiles.filter(t=>t.level===level&&overlaps(t.bounds,bounds));if(tiles.length>8&&level==='province'){level='region';tiles=atlasTiles.filter(t=>t.level===level&&overlaps(t.bounds,bounds));}if(tiles.length>8)tiles=atlasTiles.filter(t=>t.level==='world');return tiles;},[bounds,requested]);
  return <Group><Ocean resources={resources}/>{tiles.map(tile=><GeographyTile key={tile.key} scene={scene} tile={tile} surface={surface} resources={resources} preset={preset}/>)}</Group>;
});
