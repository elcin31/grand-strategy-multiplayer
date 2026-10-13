import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {Group,Picture,Skia,ClipOp,FilterMode,MipmapMode,type SkImage} from '@shopify/react-native-skia';
import {Image as NativeImage} from 'react-native';
import {atlasTiles} from '../map/atlas22Assets';
import {preparedAtlas} from '../map/atlas221Assets';
import {stableAtlasLevel,atlasSurface,type AtlasLevel,type AtlasTile} from '../map/atlas22';
import {overlaps,type Bounds} from '../map/geometry';
import {RasterCache} from '../map/rasterTiles';
import {mapBudget} from '../map/mobileBudgets';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {mapWorkQueue} from '../performance/mapWorkQueue';
import type {MapScene} from '../map/worldScene';
import type {GraphicsPreset,MapMode} from '../map/settings';

interface AtlasResources {images:RasterCache<SkImage>;canPrepare:()=>boolean}
function useAtlas(source:number,resources:AtlasResources,priority:number){
  const [ready,setReady]=useState<{source:number;image:SkImage}|null>(()=>{const image=resources.images.get(String(source));return image?{source,image}:null;});
  useEffect(()=>{
    const cached=resources.images.get(String(source));if(cached){setReady({source,image:cached});return;}
    let alive=true,cancelDecode:(()=>void)|undefined,encoded:Awaited<ReturnType<typeof Skia.Data.fromURI>>|undefined;
    const cancel=mapWorkQueue.schedule(async()=>{
      const data=await Skia.Data.fromURI(NativeImage.resolveAssetSource(source).uri);
      if(!alive){data.dispose();return;}
      encoded=data;
      const decode=()=>{
        if(!alive)return;
        try{
          // MakeImageFromEncoded creates a lazy SkImage. Force CPU decoding
          // here, while quiet, so first Canvas replay cannot decode WebP on
          // the render thread in the middle of the next gesture.
          const lazy=Skia.Image.MakeImageFromEncoded(data);
          if(lazy)try{const image=lazy.makeNonTextureImage();if(image){resources.images.set(String(source),image,image.width()*image.height()*4);setReady({source,image});}}finally{lazy.dispose();}
        }
        finally{data.dispose();encoded=undefined;}
      };
      // A gesture may have started while the native file read was in flight.
      if(resources.canPrepare())decode();else cancelDecode=mapWorkQueue.schedule(decode,resources.canPrepare,priority);
    },resources.canPrepare,priority);
    return()=>{alive=false;cancel();cancelDecode?.();encoded?.dispose();encoded=undefined;};
  },[source,resources,priority]);
  // Retain the previous surface while switching modes, without bare-land flashes.
  return resources.images.get(String(source))??ready?.image??null;
}
const GeographyTile=memo(function GeographyTile({tile,surface,resources,priority}:{tile:AtlasTile;surface:'terrain'|'relief';resources:AtlasResources;priority:number}){
  const image=useAtlas(preparedAtlas[tile.key]![surface],resources,priority);
  const picture=useMemo(()=>image?withNativeRecordingObjects(own=>{
    const b=tile.bounds,i=tile.imageBounds,r=own(Skia.PictureRecorder()),c=r.beginRecording(Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top));
    c.clipRect(Skia.XYWHRect(b.left,b.top,b.right-b.left,b.bottom-b.top),ClipOp.Intersect,false);
    c.drawImageRectOptions(image,Skia.XYWHRect(0,0,image.width(),image.height()),Skia.XYWHRect(i.left,i.top,i.right-i.left,i.bottom-i.top),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));
    return r.finishRecordingAsPicture();
  }):null,[tile,image]);
  return picture?<Picture picture={picture}/>:null;
});
const Ocean=memo(function Ocean({resources,preset}:{resources:AtlasResources;preset:GraphicsPreset}){
  const source=preset==='Performance'?require('../../assets/map/dominion-2.2.1/ocean-performance.webp'):preset==='Balanced'?require('../../assets/map/dominion-2.2.1/ocean-balanced.webp'):require('../../assets/map/dominion-2.2/water/ocean.webp');
  const image=useAtlas(source,resources,-3);
  const picture=useMemo(()=>image?withNativeRecordingObjects(own=>{const r=own(Skia.PictureRecorder()),c=r.beginRecording(Skia.XYWHRect(0,0,1440,720));c.drawImageRectOptions(image,Skia.XYWHRect(0,0,image.width(),image.height()),Skia.XYWHRect(0,0,1440,720),FilterMode.Linear,MipmapMode.None,own(Skia.Paint()));return r.finishRecordingAsPicture();}):null,[image]);
  return picture?<Picture picture={picture}/>:null;
});
export const MapGeographyLayer=memo(function MapGeographyLayer({scene,bounds,zoom,preset,mode,canPrepare}:{scene:MapScene;bounds:Bounds;zoom:number;preset:GraphicsPreset;mode:MapMode;canPrepare:()=>boolean}){
  const resources=useMemo<AtlasResources>(()=>({images:new RasterCache<SkImage>(mapBudget(preset).atlasBytes,mapBudget(preset).atlasEntries),canPrepare}),[scene,canPrepare]);
  useEffect(()=>{resources.images.resize(mapBudget(preset).atlasBytes,mapBudget(preset).atlasEntries);},[preset,resources]);
  useEffect(()=>()=>resources.images.clear(),[resources]);
  const previous=useRef<AtlasLevel>('world'),requested=stableAtlasLevel(zoom,preset,previous.current);previous.current=requested;
  const surface=atlasSurface(mode),world=atlasTiles[0]!;
  const tiles=useMemo(()=>{
    if(requested==='world')return [];
    let tiles=atlasTiles.filter(t=>t.level===requested&&overlaps(t.bounds,bounds));
    if(tiles.length>mapBudget(preset).detailTiles)tiles=atlasTiles.filter(t=>t.level==='region'&&overlaps(t.bounds,bounds));
    return tiles.length>mapBudget(preset).detailTiles?[]:tiles;
  },[bounds,requested,preset]);
  // Always keep prepared world geography below finer tiles during pan/pinch.
  // No coastline paths, clip masks or offscreen geography surfaces at runtime.
  return <Group><Ocean resources={resources} preset={preset}/><GeographyTile tile={world} surface={surface} resources={resources} priority={-2}/>{tiles.map((tile,i)=><GeographyTile key={tile.key} tile={tile} surface={surface} resources={resources} priority={i}/>)}</Group>;
});
